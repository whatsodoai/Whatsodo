from pydantic import BaseModel


class HealthOut(BaseModel):
    status: str
    version: str
    environment: str


class ReadinessOut(BaseModel):
    status: str
    database: str
    redis: str
