"""Dependency-free API smoke suite. Run from backend/: .venv/bin/python tests/smoke.py"""
import asyncio
import sys
from pathlib import Path
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import (
    BulkRecordInput,
    ImportInput,
    RecordInput,
    SessionLocal,
    ZoneInput,
    app,
    bulk_delete_records,
    create_record,
    create_zone,
    delete_zone,
    export_zone,
    import_records,
    list_records,
    update_record,
    update_zone,
)


async def verify() -> None:
    async with app.router.lifespan_context(app):
        database = SessionLocal()
        user = "demo@aws.local"
        domain = f"smoke-{uuid4().hex[:8]}.example"
        zone = create_zone(ZoneInput(name=domain, comment="Smoke test", private_zone=False), database, user)
        updated = update_zone(zone["id"], ZoneInput(name=domain, comment="Updated", private_zone=True), database, user)
        assert updated["private_zone"] is True
        record = create_record(zone["id"], RecordInput(name=f"www.{domain}.", type="A", value="198.51.100.10", ttl=60, routing_policy="Weighted"), database, user)
        changed = update_record(record["id"], RecordInput(name=f"www.{domain}.", type="A", value="198.51.100.11", ttl=120, routing_policy="Failover"), database, user)
        assert changed["routing_policy"] == "Failover"
        imported = import_records(zone["id"], ImportInput(content=f"$ORIGIN {domain}.\n$TTL 300\nmail IN MX 10 mail.{domain}."), database, user)
        assert imported["imported"] == 1
        assert "MX" in export_zone(zone["id"], "bind", database, user).body.decode()
        assert len(list_records(zone["id"], "", database, user)) == 2
        bulk_delete_records(zone["id"], BulkRecordInput(ids=[record["id"], imported["records"][0]["id"]]), database, user)
        assert list_records(zone["id"], "", database, user) == []
        delete_zone(zone["id"], database, user)
        database.close()


if __name__ == "__main__":
    asyncio.run(verify())
    print("Route 53 API smoke suite passed")
