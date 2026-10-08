import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from . import dns
from .db import Base, SessionLocal, engine, get_db, migrate
from .models import DNSRecord, HostedZone, HostedZoneTag, utcnow
from .schemas import (
    AcceleratedRecoveryInput,
    BulkRecordInput,
    BulkTtlInput,
    DnssecInput,
    ImportInput,
    LoginInput,
    QueryLoggingInput,
    RecordBatchInput,
    RecordInput,
    TagInput,
    TagsInput,
    TestRecordInput,
    ZoneCreate,
    ZoneUpdate,
)

SESSION_TOKEN = "route53-demo-session"


def current_user(authorization: str | None = Header(default=None)) -> str:
    if authorization != f"Bearer {SESSION_TOKEN}":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sign in required")
    return "demo@aws.local"


# ---------------------------------------------------------------- serializers

def zone_dict(zone: HostedZone) -> dict:
    apex_ns = next((r for r in zone.records if r.type == "NS" and r.name == zone.name), None)
    return {
        "id": zone.id,
        "name": zone.name,
        "comment": zone.comment,
        "private_zone": zone.private_zone,
        "vpc_region": zone.vpc_region,
        "vpc_id": zone.vpc_id,
        "created_at": zone.created_at,
        "record_count": len(zone.records),
        "tags": [{"key": tag.key, "value": tag.value} for tag in zone.tags],
        "name_servers": apex_ns.value.splitlines() if apex_ns else [],
        "query_log_group": zone.query_log_group,
        "accelerated_recovery": zone.accelerated_recovery,
        "dnssec": {
            "enabled": zone.dnssec_enabled,
            "status": "Signing" if zone.dnssec_enabled else "Not signing",
            "keys": [{"name": zone.dnssec_ksk_name, "status": "Active", "created_at": zone.dnssec_enabled_at}]
            if zone.dnssec_enabled
            else [],
        },
    }


def record_dict(zone: HostedZone, record: DNSRecord) -> dict:
    return {
        "id": record.id,
        "zone_id": record.zone_id,
        "name": record.name,
        "type": record.type,
        "value": record.value,
        "ttl": record.ttl,
        "routing_policy": record.routing_policy,
        "alias": record.alias,
        "evaluate_target_health": record.evaluate_target_health,
        "set_identifier": record.set_identifier,
        "protected": dns.is_protected(zone, record),
    }


# -------------------------------------------------------------------- helpers

def get_zone(db: Session, zone_id: str) -> HostedZone:
    zone = db.get(HostedZone, zone_id)
    if not zone:
        raise HTTPException(404, "Hosted zone not found")
    return zone


def get_record(db: Session, record_id: int) -> DNSRecord:
    record = db.get(DNSRecord, record_id)
    if not record:
        raise HTTPException(404, "Record not found")
    return record


def clean_tags(tags: list[TagInput]) -> list[HostedZoneTag]:
    seen: set[str] = set()
    result = []
    for tag in tags:
        key = tag.key.strip()
        if not key:
            continue
        if key in seen:
            raise HTTPException(400, f"Duplicate tag key “{key}”. Tag keys must be unique.")
        seen.add(key)
        result.append(HostedZoneTag(key=key, value=tag.value.strip()))
    return result


def record_fields(zone: HostedZone, payload: RecordInput, existing: DNSRecord | None = None) -> dict:
    """Validate a record payload against its zone and return normalized column values.

    The zone's own SOA record can be edited (value and TTL) but never created.
    """
    record_type = payload.type.strip().upper()
    editing_soa = existing is not None and existing.type == "SOA" and record_type == "SOA"
    if record_type not in dns.RECORD_TYPES and not editing_soa:
        raise dns.DNSValidationError(f"Record type {payload.type} is not supported.")
    if payload.routing_policy not in dns.ROUTING_POLICIES:
        raise dns.DNSValidationError(f"Routing policy {payload.routing_policy} is not supported.")
    name = dns.record_fqdn(zone, payload.name)
    if record_type == "CNAME" and name == zone.name:
        raise dns.DNSValidationError(f"RRSet of type CNAME with DNS name {name} is not permitted at apex in zone {zone.name}")
    set_identifier = payload.set_identifier.strip()
    if payload.routing_policy != "Simple" and not set_identifier:
        raise dns.DNSValidationError(f"Record ID is required for the {payload.routing_policy} routing policy.")
    return {
        "name": name,
        "type": record_type,
        "value": payload.value.strip() if editing_soa else dns.normalize_value(record_type, payload.value, alias=payload.alias),
        "ttl": 0 if payload.alias else payload.ttl,
        "routing_policy": payload.routing_policy,
        "alias": payload.alias,
        "evaluate_target_health": payload.alias and payload.evaluate_target_health,
        "set_identifier": set_identifier if payload.routing_policy != "Simple" else "",
    }


def assert_no_conflict(db: Session, zone: HostedZone, fields: dict, exclude_id: int | None = None) -> None:
    siblings = db.scalars(
        select(DNSRecord).where(DNSRecord.zone_id == zone.id, DNSRecord.name == fields["name"])
    ).all()
    for other in siblings:
        if other.id == exclude_id:
            continue
        if other.type == fields["type"] and other.set_identifier == fields["set_identifier"]:
            raise HTTPException(
                409,
                f"Tried to create resource record set [name='{fields['name']}', type='{fields['type']}'] but it already exists",
            )
        if "CNAME" in (other.type, fields["type"]) and other.type != fields["type"] and not (other.set_identifier or fields["set_identifier"]):
            raise HTTPException(
                400,
                f"RRSet of type CNAME with DNS name {fields['name']} is not permitted as it conflicts with other records with the same DNS name in zone {zone.name}",
            )


# ------------------------------------------------------------------------ app

def seed() -> None:
    with SessionLocal() as db:
        if db.scalar(select(HostedZone.id).limit(1)):
            return
        zone = HostedZone(name="example.com.", comment="Primary public zone")
        db.add(zone)
        db.flush()
        db.add_all(dns.default_zone_records(zone))
        db.add_all(
            [
                DNSRecord(zone_id=zone.id, name="example.com.", type="A", value="198.51.100.42", ttl=300),
                DNSRecord(zone_id=zone.id, name="www.example.com.", type="CNAME", value="example.com.", ttl=300),
                DNSRecord(zone_id=zone.id, name="example.com.", type="MX", value="10 mail.example.com.", ttl=3600),
            ]
        )
        db.commit()


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(engine)
    migrate()
    seed()
    yield


# Comma-separated list of browser origins allowed to call the API (set to the deployed frontend URL).
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ROUTE53_CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
    if origin.strip()
]

# Optional regex for preview/production URLs that change per deployment, e.g. https://.*\.vercel\.app
ALLOWED_ORIGIN_REGEX = os.getenv("ROUTE53_CORS_ORIGIN_REGEX") or None

app = FastAPI(title="Route 53 Clone API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=ALLOWED_ORIGIN_REGEX,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(dns.DNSValidationError)
async def dns_validation_handler(_: Request, error: dns.DNSValidationError):
    return JSONResponse(status_code=400, content={"detail": str(error)})


# ----------------------------------------------------------------------- auth

@app.get("/health")
def health():
    # RENDER_GIT_COMMIT is set by Render; it shows which revision is serving traffic.
    return {"status": "ok", "commit": os.getenv("RENDER_GIT_COMMIT", "")[:7]}


@app.post("/auth/login")
def login(payload: LoginInput):
    return {"token": SESSION_TOKEN, "user": {"email": payload.email or "demo@aws.local", "name": "Demo Administrator"}}


# ---------------------------------------------------------------- hosted zones

@app.get("/zones")
def list_zones(q: str = "", db: Session = Depends(get_db), _: str = Depends(current_user)):
    needle = q.strip().lower()
    # Load tags and records in two extra queries instead of two per zone.
    zones = db.scalars(
        select(HostedZone).options(selectinload(HostedZone.tags), selectinload(HostedZone.records)).order_by(HostedZone.name)
    ).all()

    def matches(zone: HostedZone) -> bool:
        haystack = " ".join(
            [zone.name, zone.id, zone.comment, "private" if zone.private_zone else "public", "route 53"]
        ).lower()
        return needle in haystack

    return [zone_dict(zone) for zone in zones if matches(zone)]


@app.post("/zones", status_code=201)
def create_zone(payload: ZoneCreate, db: Session = Depends(get_db), _: str = Depends(current_user)):
    name = dns.normalize_domain(payload.name, private=payload.private_zone)
    if payload.private_zone and not payload.vpc_id.strip():
        raise HTTPException(400, "A private hosted zone must be associated with a VPC.")
    if db.scalar(select(HostedZone).where(HostedZone.name == name)):
        raise HTTPException(409, f"A hosted zone named {name.rstrip('.')} already exists.")
    zone = HostedZone(
        name=name,
        comment=payload.comment.strip(),
        private_zone=payload.private_zone,
        vpc_region=payload.vpc_region if payload.private_zone else "",
        vpc_id=payload.vpc_id.strip() if payload.private_zone else "",
    )
    db.add(zone)
    db.flush()
    zone.tags = clean_tags(payload.tags)
    db.add_all(dns.default_zone_records(zone))
    db.commit()
    db.refresh(zone)
    return zone_dict(zone)


@app.get("/zones/{zone_id}")
def read_zone(zone_id: str, db: Session = Depends(get_db), _: str = Depends(current_user)):
    return zone_dict(get_zone(db, zone_id))


@app.put("/zones/{zone_id}")
def update_zone(zone_id: str, payload: ZoneUpdate, db: Session = Depends(get_db), _: str = Depends(current_user)):
    zone = get_zone(db, zone_id)
    zone.comment = payload.comment.strip()
    if payload.tags is not None:
        zone.tags = clean_tags(payload.tags)
    db.commit()
    db.refresh(zone)
    return zone_dict(zone)


@app.delete("/zones/{zone_id}", status_code=204)
def delete_zone(zone_id: str, db: Session = Depends(get_db), _: str = Depends(current_user)):
    db.delete(get_zone(db, zone_id))
    db.commit()


@app.put("/zones/{zone_id}/tags")
def update_tags(zone_id: str, payload: TagsInput, db: Session = Depends(get_db), _: str = Depends(current_user)):
    zone = get_zone(db, zone_id)
    zone.tags = clean_tags(payload.tags)
    db.commit()
    db.refresh(zone)
    return zone_dict(zone)


@app.put("/zones/{zone_id}/query-logging")
def configure_query_logging(zone_id: str, payload: QueryLoggingInput, db: Session = Depends(get_db), _: str = Depends(current_user)):
    zone = get_zone(db, zone_id)
    if zone.private_zone:
        raise HTTPException(400, "Query logging for private hosted zones is configured through Resolver query logging.")
    zone.query_log_group = payload.log_group
    db.commit()
    db.refresh(zone)
    return zone_dict(zone)


@app.delete("/zones/{zone_id}/query-logging")
def remove_query_logging(zone_id: str, db: Session = Depends(get_db), _: str = Depends(current_user)):
    zone = get_zone(db, zone_id)
    zone.query_log_group = ""
    db.commit()
    db.refresh(zone)
    return zone_dict(zone)


@app.put("/zones/{zone_id}/accelerated-recovery")
def set_accelerated_recovery(zone_id: str, payload: AcceleratedRecoveryInput, db: Session = Depends(get_db), _: str = Depends(current_user)):
    zone = get_zone(db, zone_id)
    if zone.private_zone:
        raise HTTPException(400, "Accelerated recovery is only available for public hosted zones.")
    zone.accelerated_recovery = payload.enabled
    db.commit()
    db.refresh(zone)
    return zone_dict(zone)


@app.put("/zones/{zone_id}/dnssec")
def set_dnssec(zone_id: str, payload: DnssecInput, db: Session = Depends(get_db), _: str = Depends(current_user)):
    zone = get_zone(db, zone_id)
    if zone.private_zone:
        raise HTTPException(400, "DNSSEC signing is only available for public hosted zones.")
    zone.dnssec_enabled = payload.enabled
    zone.dnssec_ksk_name = (payload.ksk_name.strip() or f"ksk_{zone.id[-6:].lower()}") if payload.enabled else ""
    zone.dnssec_enabled_at = utcnow() if payload.enabled else None
    db.commit()
    db.refresh(zone)
    return zone_dict(zone)


@app.post("/zones/{zone_id}/test-record")
def test_record(zone_id: str, payload: TestRecordInput, db: Session = Depends(get_db), _: str = Depends(current_user)):
    """Simulate how Route 53 would answer a query. No DNS traffic is sent."""
    zone = get_zone(db, zone_id)
    record_type = payload.type.strip().upper()
    if record_type not in dns.RECORD_TYPES + ("SOA",):
        raise HTTPException(400, f"Record type {payload.type} is not supported.")
    name = dns.record_fqdn(zone, payload.name)
    records = [r for r in zone.records if r.name == name]
    if not records:
        wildcard = "*." + name.split(".", 1)[1] if "." in name.rstrip(".") else ""
        records = [r for r in zone.records if r.name == wildcard]
    answers = [r for r in records if r.type == record_type] or [r for r in records if r.type == "CNAME" and record_type != "CNAME"]
    code = "NOERROR" if records else "NXDOMAIN"
    return {
        "response_code": code,
        "protocol": "UDP",
        "record_name": name,
        "record_type": answers[0].type if answers else record_type,
        "resolver_ip": payload.resolver_ip.strip(),
        "ttl": answers[0].ttl if answers else None,
        "values": [value for record in answers for value in record.value.splitlines()],
    }


# -------------------------------------------------------------------- records

@app.get("/zones/{zone_id}/records")
def list_records(zone_id: str, q: str = "", db: Session = Depends(get_db), _: str = Depends(current_user)):
    zone = get_zone(db, zone_id)
    needle = q.strip().lower()
    records = db.scalars(
        select(DNSRecord).where(DNSRecord.zone_id == zone_id).order_by(DNSRecord.name, DNSRecord.type, DNSRecord.id)
    ).all()

    def matches(record: DNSRecord) -> bool:
        haystack = " ".join(
            [record.name, record.type, record.value, record.routing_policy, record.set_identifier, str(record.ttl)]
        ).lower()
        return needle in haystack

    return [record_dict(zone, record) for record in records if matches(record)]


@app.get("/records/{record_id}")
def read_record(record_id: int, db: Session = Depends(get_db), _: str = Depends(current_user)):
    record = get_record(db, record_id)
    return record_dict(record.zone, record)


@app.post("/zones/{zone_id}/records", status_code=201)
def create_record(zone_id: str, payload: RecordInput, db: Session = Depends(get_db), _: str = Depends(current_user)):
    zone = get_zone(db, zone_id)
    fields = record_fields(zone, payload)
    assert_no_conflict(db, zone, fields)
    record = DNSRecord(zone_id=zone.id, **fields)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record_dict(zone, record)


@app.post("/zones/{zone_id}/records/batch", status_code=201)
def create_records(zone_id: str, payload: RecordBatchInput, db: Session = Depends(get_db), _: str = Depends(current_user)):
    """Create several records atomically; the first invalid one aborts the whole batch."""
    zone = get_zone(db, zone_id)
    created = []
    for index, item in enumerate(payload.records):
        try:
            fields = record_fields(zone, item)
            assert_no_conflict(db, zone, fields)
        except (dns.DNSValidationError, HTTPException) as error:
            db.rollback()
            message = error.detail if isinstance(error, HTTPException) else str(error)
            code = error.status_code if isinstance(error, HTTPException) else 400
            raise HTTPException(code, {"message": message, "index": index}) from None
        record = DNSRecord(zone_id=zone.id, **fields)
        db.add(record)
        db.flush()
        created.append(record)
    db.commit()
    return {"created": len(created), "records": [record_dict(zone, record) for record in created]}


@app.put("/records/{record_id}")
def update_record(record_id: int, payload: RecordInput, db: Session = Depends(get_db), _: str = Depends(current_user)):
    record = get_record(db, record_id)
    zone = record.zone
    fields = record_fields(zone, payload, existing=record)
    if dns.is_protected(zone, record) and (fields["name"] != record.name or fields["type"] != record.type or fields["alias"]):
        raise HTTPException(400, f"The {record.type} record named {zone.name} can only have its value and TTL changed.")
    assert_no_conflict(db, zone, fields, exclude_id=record.id)
    for key, value in fields.items():
        setattr(record, key, value)
    db.commit()
    db.refresh(record)
    return record_dict(zone, record)


@app.delete("/records/{record_id}", status_code=204)
def delete_record(record_id: int, db: Session = Depends(get_db), _: str = Depends(current_user)):
    record = get_record(db, record_id)
    if dns.is_protected(record.zone, record):
        raise HTTPException(400, f"You can't delete the {record.type} record named {record.zone.name}")
    db.delete(record)
    db.commit()


@app.delete("/zones/{zone_id}/records", status_code=204)
def bulk_delete_records(zone_id: str, payload: BulkRecordInput, db: Session = Depends(get_db), _: str = Depends(current_user)):
    zone = get_zone(db, zone_id)
    records = db.scalars(select(DNSRecord).where(DNSRecord.zone_id == zone_id, DNSRecord.id.in_(payload.ids))).all()
    if len(records) != len(set(payload.ids)):
        raise HTTPException(404, "One or more records were not found in this hosted zone")
    if any(dns.is_protected(zone, record) for record in records):
        raise HTTPException(400, f"You can't delete the SOA record or the NS record named {zone.name}")
    for record in records:
        db.delete(record)
    db.commit()


@app.patch("/zones/{zone_id}/records")
def bulk_update_ttl(zone_id: str, payload: BulkTtlInput, db: Session = Depends(get_db), _: str = Depends(current_user)):
    """Set the TTL of many records at once. Alias records have no TTL and are skipped."""
    zone = get_zone(db, zone_id)
    records = db.scalars(select(DNSRecord).where(DNSRecord.zone_id == zone.id, DNSRecord.id.in_(payload.ids))).all()
    if len(records) != len(set(payload.ids)):
        raise HTTPException(404, "One or more records were not found in this hosted zone")
    updated = [record for record in records if not record.alias]
    for record in updated:
        record.ttl = payload.ttl
    db.commit()
    return {"updated": len(updated), "skipped": len(records) - len(updated)}


# ------------------------------------------------------------ import / export

def _import_conflicts(zone: HostedZone, records: list[DNSRecord]) -> list[str]:
    existing = {(r.name, r.type) for r in zone.records if not r.set_identifier}
    return [f"{r.name.rstrip('.')} {r.type}" for r in records if (r.name, r.type) in existing]


@app.post("/zones/{zone_id}/records/import/preview")
def preview_import(zone_id: str, payload: ImportInput, db: Session = Depends(get_db), _: str = Depends(current_user)):
    zone = get_zone(db, zone_id)
    try:
        records = dns.parse_bind(payload.content, zone)
    except dns.DNSValidationError as error:
        return {"records": [], "conflicts": [], "error": str(error)}
    preview = [{"name": r.name, "type": r.type, "value": r.value, "ttl": r.ttl} for r in records]
    return {"records": preview, "conflicts": _import_conflicts(zone, records), "error": None}


@app.post("/zones/{zone_id}/records/import", status_code=201)
def import_records(zone_id: str, payload: ImportInput, db: Session = Depends(get_db), _: str = Depends(current_user)):
    zone = get_zone(db, zone_id)
    records = dns.parse_bind(payload.content, zone)
    if not records:
        raise HTTPException(400, "No supported DNS records were found in this zone file")
    conflicts = _import_conflicts(zone, records)
    if conflicts:
        raise HTTPException(409, "The hosted zone already contains these records: " + ", ".join(conflicts))
    db.add_all(records)
    db.commit()
    return {"imported": len(records), "records": [record_dict(zone, record) for record in records]}


@app.get("/zones/{zone_id}/export")
def export_zone(zone_id: str, format: str = "json", db: Session = Depends(get_db), _: str = Depends(current_user)):
    zone = get_zone(db, zone_id)
    if format == "bind":
        return Response(
            dns.bind_zone(zone),
            media_type="text/plain",
            headers={"Content-Disposition": f'attachment; filename="{zone.name.rstrip(".")}.zone"'},
        )
    if format != "json":
        raise HTTPException(400, "format must be json or bind")
    return {"hosted_zone": zone_dict(zone), "records": [record_dict(zone, record) for record in zone.records]}


# --------------------------------------------------------------------- search

@app.get("/search")
def search_resources(q: str = "", db: Session = Depends(get_db), _: str = Depends(current_user)):
    query = q.strip().lower()
    if not query:
        return []
    results = []
    zones = db.scalars(select(HostedZone).options(selectinload(HostedZone.records)).order_by(HostedZone.name)).all()
    for zone in zones:
        if query in zone.name.lower() or query in zone.comment.lower():
            kind = "Private" if zone.private_zone else "Public"
            results.append({"kind": "Hosted zone", "label": zone.name.rstrip("."), "detail": zone.comment or f"{kind} hosted zone", "zone_id": zone.id})
        for record in zone.records:
            if query in f"{record.name} {record.type} {record.value} {record.routing_policy}".lower():
                results.append(
                    {"kind": "Record", "label": record.name.rstrip("."), "detail": f"{record.type} · {record.value.splitlines()[0]}", "zone_id": zone.id, "record_id": record.id}
                )
    return results[:20]
