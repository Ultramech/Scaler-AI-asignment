from pydantic import BaseModel, Field


class LoginInput(BaseModel):
    email: str = ""


class TagInput(BaseModel):
    key: str = Field(min_length=1, max_length=128)
    value: str = Field(default="", max_length=256)


class ZoneCreate(BaseModel):
    name: str = Field(min_length=1, max_length=260)
    comment: str = Field(default="", max_length=256)
    private_zone: bool = False
    vpc_region: str = ""
    vpc_id: str = ""
    tags: list[TagInput] = Field(default_factory=list, max_length=50)


class ZoneUpdate(BaseModel):
    """Only the description and tags of a hosted zone can change after creation."""

    comment: str = Field(default="", max_length=256)
    tags: list[TagInput] | None = Field(default=None, max_length=50)


class TagsInput(BaseModel):
    tags: list[TagInput] = Field(default_factory=list, max_length=50)


class QueryLoggingInput(BaseModel):
    log_group: str = Field(min_length=1, max_length=512, pattern=r"^[A-Za-z0-9._/#-]+$")


class AcceleratedRecoveryInput(BaseModel):
    enabled: bool


class DnssecInput(BaseModel):
    enabled: bool
    ksk_name: str = Field(default="", max_length=128)


class RecordInput(BaseModel):
    name: str = Field(default="", max_length=255)
    type: str
    value: str = Field(min_length=1)
    ttl: int = Field(default=300, ge=0, le=2147483647)
    routing_policy: str = "Simple"
    alias: bool = False
    evaluate_target_health: bool = False
    set_identifier: str = Field(default="", max_length=128)


class RecordBatchInput(BaseModel):
    records: list[RecordInput] = Field(min_length=1, max_length=100)


class ImportInput(BaseModel):
    content: str = Field(min_length=1)


class BulkRecordInput(BaseModel):
    ids: list[int] = Field(min_length=1)


class BulkTtlInput(BaseModel):
    ids: list[int] = Field(min_length=1)
    ttl: int = Field(ge=0, le=2147483647)


class TestRecordInput(BaseModel):
    name: str = ""
    type: str = "A"
    resolver_ip: str = ""
