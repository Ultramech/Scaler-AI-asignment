"""End-to-end API smoke suite. Boots the API on a temporary SQLite file and drives it over HTTP.

Run from backend/:  .venv/bin/python tests/smoke.py
"""
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
TOKEN = "route53-demo-session"


def free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


class Client:
    def __init__(self, base: str):
        self.base = base

    def call(self, method: str, path: str, body=None, auth: bool = True):
        data = json.dumps(body).encode() if body is not None else None
        request = urllib.request.Request(self.base + path, data=data, method=method)
        request.add_header("Content-Type", "application/json")
        if auth:
            request.add_header("Authorization", f"Bearer {TOKEN}")
        try:
            with urllib.request.urlopen(request) as response:
                raw = response.read().decode()
                return response.status, (json.loads(raw) if raw and "json" in response.headers.get("content-type", "") else raw)
        except urllib.error.HTTPError as error:
            raw = error.read().decode()
            return error.code, (json.loads(raw) if raw else None)

    def ok(self, method: str, path: str, body=None):
        status, payload = self.call(method, path, body)
        assert status < 300, f"{method} {path} -> {status}: {payload}"
        return payload


def expect(client: Client, status: int, method: str, path: str, body=None):
    code, payload = client.call(method, path, body)
    assert code == status, f"{method} {path}: expected {status}, got {code}: {payload}"
    return payload


def verify(client: Client) -> None:
    assert client.call("GET", "/zones", auth=False)[0] == 401
    assert client.call("POST", "/auth/login", {"email": "a@b.co"}, auth=False)[1]["token"] == TOKEN

    # ---- hosted zones: create / read / search / update / delete
    expect(client, 400, "POST", "/zones", {"name": "-bad-.com"})
    expect(client, 400, "POST", "/zones", {"name": "localonly"})
    zone = client.ok("POST", "/zones", {"name": "Smoke.Example.", "comment": "Smoke test", "tags": [{"key": "Env", "value": "test"}]})
    assert zone["name"] == "smoke.example."
    assert zone["id"].startswith("Z") and len(zone["id"]) == 20
    assert zone["record_count"] == 2 and len(zone["name_servers"]) == 4
    assert zone["tags"] == [{"key": "Env", "value": "test"}]
    expect(client, 409, "POST", "/zones", {"name": "smoke.example"})
    zid = zone["id"]
    assert client.ok("GET", f"/zones/{zid}")["id"] == zid
    expect(client, 404, "GET", "/zones/NOPE")
    assert any(z["id"] == zid for z in client.ok("GET", "/zones?q=smoke"))
    assert any(z["id"] == zid for z in client.ok("GET", f"/zones?q={zid.lower()}"))
    assert not any(z["id"] == zid for z in client.ok("GET", "/zones?q=private"))
    assert any(r["zone_id"] == zid for r in client.ok("GET", "/search?q=smoke"))

    updated = client.ok("PUT", f"/zones/{zid}", {"comment": "Updated", "tags": [{"key": "Owner", "value": "platform"}]})
    assert updated["comment"] == "Updated" and updated["name"] == "smoke.example."
    assert updated["tags"] == [{"key": "Owner", "value": "platform"}]
    expect(client, 400, "PUT", f"/zones/{zid}/tags", {"tags": [{"key": "a"}, {"key": "a"}]})
    assert client.ok("PUT", f"/zones/{zid}/tags", {"tags": []})["tags"] == []

    private = client.ok("POST", "/zones", {"name": "corp.internal", "private_zone": True, "vpc_id": "vpc-1", "vpc_region": "us-east-1"})
    assert private["private_zone"] and private["vpc_id"] == "vpc-1"
    expect(client, 400, "POST", "/zones", {"name": "novpc.internal", "private_zone": True})
    expect(client, 400, "PUT", f"/zones/{private['id']}/dnssec", {"enabled": True})
    client.ok("DELETE", f"/zones/{private['id']}")

    # ---- zone settings
    assert client.ok("PUT", f"/zones/{zid}/accelerated-recovery", {"enabled": True})["accelerated_recovery"] is True
    signed = client.ok("PUT", f"/zones/{zid}/dnssec", {"enabled": True, "ksk_name": "my-ksk"})
    assert signed["dnssec"]["status"] == "Signing" and signed["dnssec"]["keys"][0]["name"] == "my-ksk"
    assert client.ok("PUT", f"/zones/{zid}/dnssec", {"enabled": False})["dnssec"]["keys"] == []
    expect(client, 422, "PUT", f"/zones/{zid}/query-logging", {"log_group": "bad group!"})
    assert client.ok("PUT", f"/zones/{zid}/query-logging", {"log_group": "/aws/route53/smoke"})["query_log_group"] == "/aws/route53/smoke"
    assert client.ok("DELETE", f"/zones/{zid}/query-logging")["query_log_group"] == ""

    # ---- default and protected records
    defaults = client.ok("GET", f"/zones/{zid}/records")
    assert {r["type"] for r in defaults} == {"NS", "SOA"} and all(r["protected"] for r in defaults)
    for protected in defaults:
        expect(client, 400, "DELETE", f"/records/{protected['id']}")
    expect(client, 400, "DELETE", f"/zones/{zid}/records", {"ids": [r["id"] for r in defaults]})

    # ---- records: create / read / update / delete
    www = client.ok("POST", f"/zones/{zid}/records", {"name": "www", "type": "a", "value": "198.51.100.10", "ttl": 60})
    assert www["name"] == "www.smoke.example." and www["type"] == "A"
    expect(client, 409, "POST", f"/zones/{zid}/records", {"name": "www.smoke.example.", "type": "A", "value": "198.51.100.11"})
    expect(client, 400, "POST", f"/zones/{zid}/records", {"name": "www", "type": "CNAME", "value": "x.example.com"})
    expect(client, 400, "POST", f"/zones/{zid}/records", {"name": "", "type": "CNAME", "value": "x.example.com"})
    expect(client, 400, "POST", f"/zones/{zid}/records", {"name": "bad", "type": "A", "value": "999.1.1.1"})
    expect(client, 400, "POST", f"/zones/{zid}/records", {"name": "bad", "type": "MX", "value": "mail.example.com"})
    expect(client, 400, "POST", f"/zones/{zid}/records", {"name": "bad", "type": "SOA", "value": "x"})
    expect(client, 400, "POST", f"/zones/{zid}/records", {"name": "other.example.com.", "type": "A", "value": "1.1.1.1"})
    expect(client, 400, "POST", f"/zones/{zid}/records", {"name": "w", "type": "A", "value": "1.1.1.1", "routing_policy": "Weighted"})
    weighted = client.ok("POST", f"/zones/{zid}/records", {"name": "www", "type": "A", "value": "198.51.100.12", "routing_policy": "Weighted", "set_identifier": "blue"})
    assert weighted["set_identifier"] == "blue"
    txt = client.ok("POST", f"/zones/{zid}/records", {"name": "", "type": "TXT", "value": "v=spf1 -all"})
    assert txt["value"] == '"v=spf1 -all"' and txt["name"] == "smoke.example."
    alias = client.ok("POST", f"/zones/{zid}/records", {"name": "cdn", "type": "A", "value": "d111.cloudfront.net", "alias": True, "evaluate_target_health": True})
    assert alias["alias"] and alias["ttl"] == 0 and alias["evaluate_target_health"]
    multi = client.ok("POST", f"/zones/{zid}/records", {"name": "multi", "type": "A", "value": "1.1.1.1\n2.2.2.2"})
    assert multi["value"] == "1.1.1.1\n2.2.2.2"
    for record_type, value in [("AAAA", "2001:db8::1"), ("MX", "10 mail.smoke.example."), ("NS", "ns.other.example."), ("PTR", "host.example.com."), ("SRV", "1 10 5269 xmpp.example.com."), ("CAA", '0 issue "letsencrypt.org"')]:
        client.ok("POST", f"/zones/{zid}/records", {"name": f"t-{record_type.lower()}", "type": record_type, "value": value})

    changed = client.ok("PUT", f"/records/{www['id']}", {"name": "www", "type": "A", "value": "198.51.100.99", "ttl": 120})
    assert changed["value"] == "198.51.100.99" and changed["ttl"] == 120
    expect(client, 409, "PUT", f"/records/{multi['id']}", {"name": "www", "type": "A", "value": "1.1.1.1"})
    expect(client, 404, "PUT", "/records/999999", {"name": "www", "type": "A", "value": "1.1.1.1"})
    ns_record = next(r for r in defaults if r["type"] == "NS")
    assert client.ok("PUT", f"/records/{ns_record['id']}", {"name": "", "type": "NS", "value": ns_record["value"], "ttl": 3600})["ttl"] == 3600
    expect(client, 400, "PUT", f"/records/{ns_record['id']}", {"name": "sub", "type": "NS", "value": ns_record["value"]})
    soa_record = next(r for r in defaults if r["type"] == "SOA")
    assert client.ok("PUT", f"/records/{soa_record['id']}", {"name": "", "type": "SOA", "value": soa_record["value"], "ttl": 600})["ttl"] == 600
    assert [r["name"] for r in client.ok("GET", f"/zones/{zid}/records?q=198.51.100.99")] == ["www.smoke.example."]

    batch = client.ok("POST", f"/zones/{zid}/records/batch", {"records": [{"name": "b1", "type": "A", "value": "10.0.0.1"}, {"name": "b2", "type": "A", "value": "10.0.0.2"}]})
    assert batch["created"] == 2
    failure = expect(client, 400, "POST", f"/zones/{zid}/records/batch", {"records": [{"name": "b3", "type": "A", "value": "10.0.0.3"}, {"name": "b4", "type": "A", "value": "nope"}]})
    assert failure["detail"]["index"] == 1
    assert not client.ok("GET", f"/zones/{zid}/records?q=b3.smoke"), "failed batch must roll back"

    # ---- test record
    answer = client.ok("POST", f"/zones/{zid}/test-record", {"name": "www", "type": "A"})
    assert answer["response_code"] == "NOERROR" and "198.51.100.99" in answer["values"]
    assert client.ok("POST", f"/zones/{zid}/test-record", {"name": "missing", "type": "A"})["response_code"] == "NXDOMAIN"

    # ---- import / export
    zone_file = "$TTL 1h\nsub1 0s A 10.0.0.1\nsub1 0s A 10.0.0.2\nsub2 IN CNAME smoke.example.\n@ IN NS ns1.ignored.example.\n"
    preview = client.ok("POST", f"/zones/{zid}/records/import/preview", {"content": zone_file})
    assert preview["error"] is None and len(preview["records"]) == 2 and preview["conflicts"] == []
    assert preview["records"][0]["value"] == "10.0.0.1\n10.0.0.2"
    assert client.ok("POST", f"/zones/{zid}/records/import/preview", {"content": "bad A nope"})["error"]
    imported = client.ok("POST", f"/zones/{zid}/records/import", {"content": zone_file})
    assert imported["imported"] == 2
    expect(client, 409, "POST", f"/zones/{zid}/records/import", {"content": zone_file})
    expect(client, 400, "POST", f"/zones/{zid}/records/import", {"content": "; nothing here"})
    assert "MX" in client.call("GET", f"/zones/{zid}/export?format=bind")[1]
    assert len(client.ok("GET", f"/zones/{zid}/export")["records"]) == len(client.ok("GET", f"/zones/{zid}/records"))

    # ---- bulk TTL
    bulk = client.ok("PATCH", f"/zones/{zid}/records", {"ids": [multi["id"], alias["id"]], "ttl": 45})
    assert bulk == {"updated": 1, "skipped": 1}
    assert client.ok("GET", f"/records/{multi['id']}")["ttl"] == 45
    expect(client, 404, "PATCH", f"/zones/{zid}/records", {"ids": [999999], "ttl": 45})
    expect(client, 422, "PATCH", f"/zones/{zid}/records", {"ids": [multi["id"]], "ttl": -1})

    # ---- deletes
    client.ok("DELETE", f"/records/{www['id']}")
    expect(client, 404, "DELETE", f"/records/{www['id']}")
    client.ok("DELETE", f"/zones/{zid}/records", {"ids": [weighted["id"], txt["id"]]})
    remaining = {r["id"] for r in client.ok("GET", f"/zones/{zid}/records")}
    assert www["id"] not in remaining and weighted["id"] not in remaining and txt["id"] not in remaining
    client.ok("DELETE", f"/zones/{zid}")
    expect(client, 404, "GET", f"/zones/{zid}")
    expect(client, 404, "GET", f"/zones/{zid}/records")


def main() -> None:
    port = free_port()
    with tempfile.TemporaryDirectory() as directory:
        env = {**os.environ, "ROUTE53_DATABASE_URL": f"sqlite:///{directory}/smoke.db"}
        server = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "app.main:app", "--port", str(port), "--log-level", "warning"],
            cwd=BACKEND,
            env=env,
        )
        try:
            client = Client(f"http://127.0.0.1:{port}")
            for _ in range(60):
                try:
                    urllib.request.urlopen(client.base + "/health")
                    break
                except OSError:
                    time.sleep(0.25)
            verify(client)
        finally:
            server.terminate()
            server.wait()
    print("Route 53 API smoke suite passed")


if __name__ == "__main__":
    main()
