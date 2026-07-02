from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Enum, Boolean
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.sql import func
import enum

Base = declarative_base()

class DeviceType(str, enum.Enum):
    WEB_APP = "web_app"             # Фронтенд-застосунок пішохода
    VEHICLE_TRACKER = "vehicle_tracker" # GPS-модуль на транспорті

class VehicleType(str, enum.Enum):
    SCOOTER = "scooter"
    BICYCLE = "bicycle"
    MOTORCYCLE = "motorcycle"
    CAR = "car" # Можна ще щось додати за потреби

# 2. Таблиці
class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    full_name = Column(String, nullable=True)
    # За потреби тут можна додати телефон або email для реєстрації
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Один користувач може мати і веб-застосунок (бути пішоходом), і зареєстрований транспорт (бути водієм).
    devices = relationship("Device", back_populates="owner")

class Device(Base):
    __tablename__ = "devices"

    id = Column(String, primary_key=True, index=True) 
    device_type = Column(Enum(DeviceType), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User", back_populates="devices")
    vehicle_info = relationship("Vehicle", back_populates="device", uselist=False)

class Vehicle(Base):
    """
    Цей запис існує ТІЛЬКИ якщо DeviceType == VEHICLE_TRACKER
    """
    __tablename__ = "vehicles"

    id = Column(String, primary_key=True, index=True)
    device_id = Column(String, ForeignKey("devices.id"), unique=True, nullable=False)
    vehicle_type = Column(Enum(VehicleType), nullable=False)
    
    # Наприклад: "Bolt", "Private", "Uklon"
    operator = Column(String, nullable=True) 
    
    device = relationship("Device", back_populates="vehicle_info")

class Incident(Base):
    __tablename__ = "incidents"

    id = Column(String, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    
    pedestrian_device_id = Column(String, ForeignKey("devices.id"))
    vehicle_device_id = Column(String, ForeignKey("devices.id"))
    # Координати інциденту (для теплових карт)
    lat = Column(Float, nullable=False) #Latitude 
    lon = Column(Float, nullable=False) #Longitude
    # Дистанція, на якій спрацювала тривога (в метрах) (між пішоходом та ТЗ)
    distance_meters = Column(Float, nullable=False)