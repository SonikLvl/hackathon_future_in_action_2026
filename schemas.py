from pydantic import BaseModel, Field
from typing import Literal, Optional

class TelemetryInput(BaseModel):
    device_id: str = Field(..., description="Унікальний ID пристрою (з таблиці devices)")
    is_pedestrian: bool = Field(..., description="True - якщо це пішохід (веб-апка), False - якщо транспорт")
    lat: float = Field(..., description="Широта")
    lon: float = Field(..., description="Довгота")
    speed: Optional[float] = Field(0.0, description="Швидкість у м/с (опціонально для пішоходів)")
    azimuth: Optional[float] = Field(None, description="Вектор руху в градусах (0-360)")
    
# ---------- Схеми для відповідей (DTO) ----------
class UserResponse(BaseModel):
    id: str
    full_name: Optional[str]
    is_active: bool

    class Config:
        from_attributes = True

class DeviceResponse(BaseModel):
    id: str
    device_type: str
    user_id: Optional[str]

    class Config:
        from_attributes = True

class IncidentResponse(BaseModel):
    id: str
    pedestrian_device_id: Optional[str]
    vehicle_device_id: Optional[str]
    lat: float
    lon: float
    distance_meters: float

    class Config:
        from_attributes = True

class ActiveDeviceState(BaseModel):
    device_id: str
    is_pedestrian: bool
    lat: float
    lon: float
    speed: float = 0.0
    azimuth: Optional[float] = None
    last_updated: float

class ActiveDevicesResponse(BaseModel):
    devices: list[ActiveDeviceState]


AlertSeverity = Literal["safe", "caution", "warning", "critical"]
AlertDirection = Literal["front", "back", "left", "right", "unknown"]
EventType = Literal["risk_alert", "risk_clear"]


class RiskAlertEvent(BaseModel):
    type: Literal["risk_alert"] = "risk_alert"
    version: int = 1
    timestamp: str
    deviceId: str
    vehicleId: str
    severity: AlertSeverity
    riskScore: int = Field(..., ge=0, le=100)
    message: str
    direction: AlertDirection
    distanceMeters: float = Field(..., ge=0)
    timeToConflictSeconds: Optional[float] = Field(default=None, ge=0)
    vehicleType: Optional[str] = None
    speedKmh: float = Field(..., ge=0)
    reason: str
    vibrationPattern: list[int] = Field(default_factory=list)


class RiskClearEvent(BaseModel):
    """Emitted once when a previously active pedestrian/vehicle threat is resolved."""

    type: Literal["risk_clear"] = "risk_clear"
    version: int = 1
    timestamp: str
    deviceId: str
    vehicleId: str
    reason: str = "Threat resolved"