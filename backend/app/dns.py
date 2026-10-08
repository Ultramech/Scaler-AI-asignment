"""DNS rules shared by the API: name/value validation, default records, BIND import/export."""
import ipaddress
import random
import re

from .models import DNSRecord, HostedZone

RECORD_TYPES = ("A", "AAAA", "CNAME", "TXT", "MX", "NS", "PTR", "SRV", "CAA")
ROUTING_POLICIES = (
    "Simple",
    "Weighted",
    "Latency",
    "Failover",
    "Geolocation",
    "Geoproximity",
    "Multivalue answer",
    "IP-based",
)
ALIAS_TYPES = ("A", "AAAA", "CNAME")
NAMESERVER_SUFFIXES = ("org", "net", "com", "co.uk")

_LABEL = re.compile(r"^[a-z0-9!#$%&'()*+,/:;<=>?@\[\\\]^_`{|}~-]{1,63}$")
_TTL_UNITS = {"s": 1, "m": 60, "h": 3600, "d": 86400, "w": 604800}


class DNSValidationError(ValueError):
    pass


def with_trailing_dot(name: str) -> str:
    return name.rstrip(".") + "."


def normalize_domain(raw: str, *, private: bool = False) -> str:
    name = raw.strip().lower().rstrip(".")
    if not name:
        raise DNSValidationError("Domain name is required.")
    if len(name) > 253:
        raise DNSValidationError("Domain name can be at most 253 characters long.")
    labels = name.split(".")
    if any(not _LABEL.match(label) or label.startswith("-") or label.endswith("-") for label in labels):
        raise DNSValidationError(
            f"“{raw.strip()}” is not a valid DNS name. Each label must be 1-63 characters and cannot start or end with a hyphen."
        )
    if len(labels) < 2 and not private:
        raise DNSValidationError("Enter a fully qualified domain name such as example.com.")
    return name + "."


def record_fqdn(zone: HostedZone, raw: str) -> str:
    """Accept either a relative name ("www"), the apex ("@" or blank) or an FQDN inside the zone."""
    name = raw.strip().lower()
    if name in ("", "@"):
        return zone.name
    name = with_trailing_dot(name)
    if name == zone.name or name.endswith("." + zone.name):
        fqdn = name
    elif raw.strip().endswith("."):
        raise DNSValidationError(f"The record name {name} is not in the hosted zone {zone.name}")
    else:
        fqdn = f"{name}{zone.name}"
    if len(fqdn) > 254:
        raise DNSValidationError("Record name is too long.")
    for label in fqdn.rstrip(".").split("."):
        if not _LABEL.match(label) or label.startswith("-"):
            raise DNSValidationError(f"“{label}” is not a valid DNS label.")
    return fqdn


def _hostname(value: str, *, what: str = "domain name") -> str:
    host = value.strip().lower()
    candidate = host.rstrip(".")
    if not candidate or any(not _LABEL.match(label) for label in candidate.split(".")):
        raise DNSValidationError(f"“{value.strip()}” is not a valid {what}.")
    return host


def _each_line(value: str) -> list[str]:
    lines = [line.strip() for line in value.splitlines() if line.strip()]
    if not lines:
        raise DNSValidationError("Value is required.")
    return lines


def normalize_value(record_type: str, value: str, *, alias: bool = False) -> str:
    """Validate a record value for its type and return the canonical newline-joined form."""
    if alias:
        if record_type not in ALIAS_TYPES:
            raise DNSValidationError(f"Alias records are not supported for type {record_type}.")
        lines = _each_line(value)
        if len(lines) != 1:
            raise DNSValidationError("An alias record has exactly one target.")
        return _hostname(lines[0], what="alias target")
    result = []
    for line in _each_line(value):
        if record_type == "A":
            try:
                ipaddress.IPv4Address(line)
            except ValueError:
                raise DNSValidationError(f"“{line}” is not a valid IPv4 address.") from None
            result.append(line)
        elif record_type == "AAAA":
            try:
                ipaddress.IPv6Address(line)
            except ValueError:
                raise DNSValidationError(f"“{line}” is not a valid IPv6 address.") from None
            result.append(line)
        elif record_type in ("CNAME", "NS", "PTR"):
            result.append(_hostname(line))
        elif record_type == "MX":
            parts = line.split()
            if len(parts) != 2 or not parts[0].isdigit() or not 0 <= int(parts[0]) <= 65535:
                raise DNSValidationError(f"“{line}” is not valid. MX values look like “10 mail.example.com”.")
            result.append(f"{parts[0]} {_hostname(parts[1], what='mail server name')}")
        elif record_type == "SRV":
            parts = line.split()
            if len(parts) != 4 or not all(part.isdigit() for part in parts[:3]):
                raise DNSValidationError(f"“{line}” is not valid. SRV values look like “1 10 5269 xmpp.example.com”.")
            result.append(" ".join(parts[:3] + [_hostname(parts[3])]))
        elif record_type == "CAA":
            parts = line.split(maxsplit=2)
            if len(parts) != 3 or not parts[0].isdigit() or not re.fullmatch(r"[A-Za-z0-9]+", parts[1]):
                raise DNSValidationError(f"“{line}” is not valid. CAA values look like “0 issue \"letsencrypt.org\"”.")
            tag_value = parts[2] if parts[2].startswith('"') else f'"{parts[2]}"'
            result.append(f"{parts[0]} {parts[1]} {tag_value}")
        elif record_type == "TXT":
            quoted = line if line.startswith('"') and line.endswith('"') and len(line) > 1 else '"' + line.replace('"', '\\"') + '"'
            result.append(quoted)
        else:
            raise DNSValidationError(f"Record type {record_type} is not supported.")
    return "\n".join(result)


def parse_ttl(token: str) -> int | None:
    match = re.fullmatch(r"(\d+)([smhdw]?)", token.lower())
    if not match:
        return None
    return int(match.group(1)) * _TTL_UNITS.get(match.group(2) or "s", 1)


def name_servers(zone_id: str) -> list[str]:
    """Deterministic, AWS-looking name servers, one per awsdns TLD."""
    rng = random.Random(zone_id)
    return [f"ns-{rng.randint(1, 2047)}.awsdns-{rng.randint(0, 63):02d}.{suffix}." for suffix in NAMESERVER_SUFFIXES]


def default_zone_records(zone: HostedZone) -> list[DNSRecord]:
    """Every hosted zone starts with an apex NS and SOA record, like Route 53."""
    servers = name_servers(zone.id)
    soa = f"{servers[0]} awsdns-hostmaster.amazon.com. 1 7200 900 1209600 86400"
    return [
        DNSRecord(zone_id=zone.id, name=zone.name, type="NS", value="\n".join(servers), ttl=172800),
        DNSRecord(zone_id=zone.id, name=zone.name, type="SOA", value=soa, ttl=900),
    ]


def is_protected(zone: HostedZone, record: DNSRecord) -> bool:
    """The apex NS and SOA records cannot be deleted or re-typed."""
    return record.name == zone.name and record.type in ("NS", "SOA")


def bind_zone(zone: HostedZone) -> str:
    lines = [f"$ORIGIN {zone.name}", "$TTL 300", f"; {zone.comment or 'Exported from Route 53 clone'}"]
    for record in zone.records:
        name = "@" if record.name == zone.name else record.name.removesuffix("." + zone.name)
        for value in record.value.splitlines():
            lines.append(f"{name:<24} {record.ttl:<6} IN {record.type:<6} {value}")
    return "\n".join(lines) + "\n"


def parse_bind(content: str, zone: HostedZone) -> list[DNSRecord]:
    """Parse a BIND zone file. Records sharing a name and type are merged into one multi-value record.

    Like Route 53, the apex NS and SOA records in the file are ignored.
    """
    origin, default_ttl = zone.name, 300
    last_name = origin
    merged: dict[tuple[str, str], DNSRecord] = {}
    for raw in content.splitlines():
        line = raw.split(";", 1)[0].strip()
        if not line:
            continue
        upper = line.upper()
        if upper.startswith("$ORIGIN"):
            origin = with_trailing_dot(line.split(maxsplit=1)[1].lower())
            continue
        if upper.startswith("$TTL"):
            default_ttl = parse_ttl(line.split(maxsplit=1)[1]) or default_ttl
            continue
        if upper.startswith("$"):
            continue
        parts = line.split()
        type_index = next((i for i, token in enumerate(parts) if token.upper() in RECORD_TYPES or token.upper() == "SOA"), None)
        if type_index is None:
            continue
        # A line may start without an owner name (it then reuses the previous one).
        has_owner = raw[:1] not in (" ", "\t") and type_index > 0
        name = parts[0] if has_owner else None
        record_type = parts[type_index].upper()
        value = " ".join(parts[type_index + 1:])
        if not value or record_type == "SOA":
            continue
        ttl = next((parse_ttl(token) for token in parts[(1 if has_owner else 0):type_index] if parse_ttl(token) is not None), default_ttl)
        if name is None:
            fqdn = last_name
        elif name == "@":
            fqdn = origin
        else:
            fqdn = name.lower() if name.endswith(".") else f"{name.lower()}.{origin}"
        last_name = fqdn
        if fqdn == zone.name and record_type == "NS":
            continue
        try:
            normalized = normalize_value(record_type, value)
        except DNSValidationError as error:
            raise DNSValidationError(f"{fqdn} {record_type}: {error}") from None
        key = (fqdn, record_type)
        if key in merged:
            merged[key].value += "\n" + normalized
        else:
            merged[key] = DNSRecord(zone_id=zone.id, name=fqdn, type=record_type, value=normalized, ttl=ttl)
    return list(merged.values())
