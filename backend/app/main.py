from contextlib import asynccontextmanager
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, Header, Response, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship, sessionmaker

engine = create_engine("sqlite:///./route53.db", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False)

class Base(DeclarativeBase): pass

class HostedZone(Base):
    __tablename__ = "hosted_zones"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: "Z" + uuid4().hex[:13].upper())
    name: Mapped[str] = mapped_column(String, unique=True, index=True)
    comment: Mapped[str] = mapped_column(String, default="")
    private_zone: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    records: Mapped[list["DNSRecord"]] = relationship(back_populates="zone", cascade="all, delete-orphan")

class DNSRecord(Base):
    __tablename__ = "dns_records"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    zone_id: Mapped[str] = mapped_column(ForeignKey("hosted_zones.id"), index=True)
    name: Mapped[str] = mapped_column(String, index=True)
    type: Mapped[str] = mapped_column(String)
    value: Mapped[str] = mapped_column(String)
    ttl: Mapped[int] = mapped_column(Integer, default=300)
    routing_policy: Mapped[str] = mapped_column(String, default="Simple")
    zone: Mapped[HostedZone] = relationship(back_populates="records")

class Login(BaseModel): email: str
class ZoneInput(BaseModel):
    name: str = Field(min_length=2, max_length=253)
    comment: str = ""
    private_zone: bool = False
class RecordInput(BaseModel):
    name: str = Field(min_length=1)
    type: str
    value: str = Field(min_length=1)
    ttl: int = Field(default=300, ge=0, le=2147483647)
    routing_policy: str = "Simple"
class ImportInput(BaseModel):
    content: str = Field(min_length=1)
class BulkRecordInput(BaseModel):
    ids: list[int] = Field(min_length=1)

def db_session():
    db = SessionLocal()
    try: yield db
    finally: db.close()

def user(authorization: str | None = Header(default=None)):
    if authorization != "Bearer route53-demo-session":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sign in required")
    return "demo@aws.local"

def zone_dict(z: HostedZone):
    return {"id": z.id, "name": z.name, "comment": z.comment, "private_zone": z.private_zone, "created_at": z.created_at, "record_count": len(z.records)}
def record_dict(r: DNSRecord):
    return {"id": r.id, "zone_id": r.zone_id, "name": r.name, "type": r.type, "value": r.value, "ttl": r.ttl, "routing_policy": r.routing_policy}

def bind_zone(zone: HostedZone):
    lines = [f"$ORIGIN {zone.name}", "$TTL 300", f"; {zone.comment or 'Exported from Route 53 clone'}"]
    for record in zone.records:
        name = "@" if record.name == zone.name else record.name.removesuffix("." + zone.name.rstrip("."))
        lines.append(f"{name:<24} {record.ttl:<6} IN {record.type:<6} {record.value}")
    return "\n".join(lines) + "\n"

def parse_bind(content: str, zone: HostedZone):
    origin, default_ttl, records = zone.name, 300, []
    allowed = {"A", "AAAA", "CNAME", "TXT", "MX", "NS", "PTR", "SRV", "CAA"}
    for raw in content.splitlines():
        line = raw.strip()
        if not line or line.startswith(";"): continue
        if line.upper().startswith("$ORIGIN"):
            value = line.split(maxsplit=1)[1].rstrip(".")
            origin = value + "."
            continue
        if line.upper().startswith("$TTL"):
            try: default_ttl = int(line.split(maxsplit=1)[1])
            except ValueError: pass
            continue
        parts = line.split()
        type_index = next((i for i, value in enumerate(parts) if value.upper() in allowed), None)
        if type_index is None: continue
        name = parts[0]
        ttl = next((int(value) for value in parts[1:type_index] if value.isdigit()), default_ttl)
        value = " ".join(parts[type_index + 1:])
        if not value: continue
        fqdn = origin if name == "@" else (name if name.endswith(".") else f"{name}.{origin}")
        records.append(DNSRecord(zone_id=zone.id, name=fqdn, type=parts[type_index].upper(), value=value, ttl=ttl))
    return records

def seed():
    with SessionLocal() as db:
        if db.scalar(select(HostedZone.id).limit(1)): return
        zone = HostedZone(name="example.com.", comment="Primary public zone")
        db.add(zone); db.flush()
        db.add_all([
          DNSRecord(zone_id=zone.id, name="example.com.", type="A", value="198.51.100.42", ttl=300),
          DNSRecord(zone_id=zone.id, name="www.example.com.", type="CNAME", value="example.com.", ttl=300),
          DNSRecord(zone_id=zone.id, name="example.com.", type="MX", value="10 mail.example.com.", ttl=3600),
        ]); db.commit()

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine); seed(); yield

app = FastAPI(title="Route 53 Clone API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000"], allow_methods=["*"], allow_headers=["*"])

@app.get("/health")
def health(): return {"status": "ok"}
@app.post("/auth/login")
def login(payload: Login): return {"token": "route53-demo-session", "user": {"email": payload.email or "demo@aws.local", "name": "Demo Administrator"}}
@app.get("/zones")
def list_zones(q: str = "", db: Session = Depends(db_session), _: str = Depends(user)):
    zones = db.scalars(select(HostedZone).order_by(HostedZone.name)).all()
    return [zone_dict(z) for z in zones if q.lower() in z.name.lower()]
@app.post("/zones", status_code=201)
def create_zone(payload: ZoneInput, db: Session = Depends(db_session), _: str = Depends(user)):
    name = payload.name.rstrip(".") + "."
    if db.scalar(select(HostedZone).where(HostedZone.name == name)): raise HTTPException(409, "A hosted zone with this name already exists")
    z = HostedZone(name=name, comment=payload.comment, private_zone=payload.private_zone); db.add(z); db.commit(); db.refresh(z); return zone_dict(z)
@app.put("/zones/{zone_id}")
def update_zone(zone_id: str, payload: ZoneInput, db: Session = Depends(db_session), _: str = Depends(user)):
    z = db.get(HostedZone, zone_id)
    if not z: raise HTTPException(404, "Hosted zone not found")
    z.name, z.comment, z.private_zone = payload.name.rstrip(".") + ".", payload.comment, payload.private_zone; db.commit(); db.refresh(z); return zone_dict(z)
@app.delete("/zones/{zone_id}", status_code=204)
def delete_zone(zone_id: str, db: Session = Depends(db_session), _: str = Depends(user)):
    z = db.get(HostedZone, zone_id)
    if not z: raise HTTPException(404, "Hosted zone not found")
    db.delete(z); db.commit()
@app.get("/zones/{zone_id}/records")
def list_records(zone_id: str, q: str = "", db: Session = Depends(db_session), _: str = Depends(user)):
    records = db.scalars(select(DNSRecord).where(DNSRecord.zone_id == zone_id).order_by(DNSRecord.name)).all()
    return [record_dict(r) for r in records if q.lower() in (r.name + r.type + r.value).lower()]
@app.get("/zones/{zone_id}/export")
def export_zone(zone_id: str, format: str = "json", db: Session = Depends(db_session), _: str = Depends(user)):
    zone = db.get(HostedZone, zone_id)
    if not zone: raise HTTPException(404, "Hosted zone not found")
    if format == "bind":
        return Response(bind_zone(zone), media_type="text/plain", headers={"Content-Disposition": f'attachment; filename="{zone.name.rstrip(".")}.zone"'})
    if format != "json": raise HTTPException(400, "format must be json or bind")
    return {"hosted_zone": zone_dict(zone), "records": [record_dict(record) for record in zone.records]}
@app.post("/zones/{zone_id}/records/import", status_code=201)
def import_records(zone_id: str, payload: ImportInput, db: Session = Depends(db_session), _: str = Depends(user)):
    zone = db.get(HostedZone, zone_id)
    if not zone: raise HTTPException(404, "Hosted zone not found")
    records = parse_bind(payload.content, zone)
    if not records: raise HTTPException(400, "No supported DNS records were found in this BIND file")
    db.add_all(records); db.commit()
    return {"imported": len(records), "records": [record_dict(record) for record in records]}
@app.post("/zones/{zone_id}/records", status_code=201)
def create_record(zone_id: str, payload: RecordInput, db: Session = Depends(db_session), _: str = Depends(user)):
    if not db.get(HostedZone, zone_id): raise HTTPException(404, "Hosted zone not found")
    r = DNSRecord(zone_id=zone_id, **payload.model_dump()); db.add(r); db.commit(); db.refresh(r); return record_dict(r)
@app.put("/records/{record_id}")
def update_record(record_id: int, payload: RecordInput, db: Session = Depends(db_session), _: str = Depends(user)):
    r = db.get(DNSRecord, record_id)
    if not r: raise HTTPException(404, "Record not found")
    for k, v in payload.model_dump().items(): setattr(r, k, v)
    db.commit(); db.refresh(r); return record_dict(r)
@app.delete("/records/{record_id}", status_code=204)
def delete_record(record_id: int, db: Session = Depends(db_session), _: str = Depends(user)):
    r = db.get(DNSRecord, record_id)
    if not r: raise HTTPException(404, "Record not found")
    db.delete(r); db.commit()
@app.delete("/zones/{zone_id}/records", status_code=204)
def bulk_delete_records(zone_id: str, payload: BulkRecordInput, db: Session = Depends(db_session), _: str = Depends(user)):
    records = db.scalars(select(DNSRecord).where(DNSRecord.zone_id == zone_id, DNSRecord.id.in_(payload.ids))).all()
    if len(records) != len(set(payload.ids)): raise HTTPException(404, "One or more records were not found in this hosted zone")
    for record in records: db.delete(record)
    db.commit()
