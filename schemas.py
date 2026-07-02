from pydantic import BaseModel, Field
from typing import Optional

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