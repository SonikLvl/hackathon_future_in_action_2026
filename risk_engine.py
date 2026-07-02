import asyncio
import time
import math
import uuid
from datetime import datetime, UTC
from state import active_devices, state_lock
from connection_manager import manager 
from db import AsyncSessionLocal
from models import Incident
from schemas import AlertDirection, AlertSeverity, RiskAlertEvent

EARTH_RADIUS = 6371000 # метри

# Словник для зберігання часу останнього сповіщення (Cooldown)
# Формат: {"pedestrian_id_vehicle_id": timestamp}
last_alerts: dict[str, float] = {}

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Обчислює відстань у метрах між двома координатами"""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = math.sin(delta_phi / 2.0)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return EARTH_RADIUS * c

def calculate_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Повертає кут (азимут) у градусах від точки 1 до точки 2.
    0° - Північ, 90° - Схід, 180° - Південь, 270° - Захід.
    """
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    delta_lon = lon2 - lon1
    
    x = math.sin(delta_lon) * math.cos(lat2)
    y = math.cos(lat1) * math.sin(lat2) - (math.sin(lat1) * math.cos(lat2) * math.cos(delta_lon))
    
    initial_bearing = math.atan2(x, y)
    
    # Переводимо радіани в градуси та нормалізуємо до 0-360
    initial_bearing = math.degrees(initial_bearing)
    return (initial_bearing + 360) % 360

def get_direction_string(bearing: float) -> str:
    """Перетворює градуси у зрозумілий текст напрямку."""
    if 45 <= bearing < 135: return "справа"
    if 135 <= bearing < 225: return "ззаду"
    if 225 <= bearing < 315: return "зліва"
    return "спереду"


def get_direction_code(bearing: float) -> AlertDirection:
    """Перетворює кут у стандартизовану англомовну мітку напрямку."""
    if 45 <= bearing < 135:
        return "right"
    if 135 <= bearing < 225:
        return "back"
    if 225 <= bearing < 315:
        return "left"
    return "front"


def estimate_time_to_conflict(distance_m: float, vehicle_speed_mps: float, pedestrian_speed_mps: float) -> float | None:
    """
    Оцінка часу до потенційного конфлікту.
    Для MVP використовуємо спрощену модель "назустріч / зближення",
    яка дає стабільний, пояснюваний індикатор для демо.
    """
    closing_speed = max(vehicle_speed_mps - pedestrian_speed_mps, 0.1)
    if closing_speed <= 0:
        return None
    return round(distance_m / closing_speed, 1)


def classify_risk(distance_m: float, vehicle_speed_mps: float, ttc_s: float | None) -> tuple[AlertSeverity, int]:
    """
    Повертає (severity, risk_score).
    Severity шкала: safe -> caution -> warning -> critical.
    """
    speed_kmh = vehicle_speed_mps * 3.6

    if distance_m <= 8 or (ttc_s is not None and ttc_s <= 1.5):
        return "critical", 92 if speed_kmh >= 20 else 88
    if distance_m <= 14 or (ttc_s is not None and ttc_s <= 3.0):
        return "warning", 78 if speed_kmh >= 15 else 72
    if distance_m <= 22 or (ttc_s is not None and ttc_s <= 5.0):
        return "caution", 62 if speed_kmh >= 10 else 56
    return "safe", 18


def infer_vehicle_type(vehicle_id: str) -> str:
    normalized = vehicle_id.lower()
    if "car" in normalized:
        return "car"
    if "motor" in normalized:
        return "motorcycle"
    if "bike" in normalized:
        return "bicycle"
    if "scooter" in normalized:
        return "scooter"
    return "unknown"


def get_vibration_pattern(severity: AlertSeverity) -> list[int]:
    if severity == "critical":
        return [180, 70, 180, 70, 180]
    if severity == "warning":
        return [140, 90, 140]
    if severity == "caution":
        return [100, 100, 100]
    return []


async def save_incident_to_db(pedestrian_id: str, vehicle_id: str, lat: float, lon: float, distance: float):
    """
    Асинхронно зберігає інцидент у базу даних.
    Створює власну коротку сесію, щоб не блокувати глобальний стан.
    """
    async with AsyncSessionLocal() as session:
        try:
            new_incident = Incident(
                id=str(uuid.uuid4()),
                pedestrian_device_id=pedestrian_id,
                vehicle_device_id=vehicle_id,
                lat=lat,
                lon=lon,
                distance_meters=round(distance, 2)
            )
            session.add(new_incident)
            await session.commit()
            print(f"Інцидент успішно записано в БД (Дистанція: {round(distance, 2)}м)")
        except Exception as e:
            # Відловлюємо помилку, щоб вона не поклала весь Risk Engine
            print(f"Помилка запису інциденту в БД: {e}")

async def risk_engine_loop():
    while True:
        current_time = time.time()
        
        async with state_lock:
            # 1. Очищення старих даних (GDPR compliance)
            stale_keys = [
                device_id for device_id, data in active_devices.items() 
                if current_time - data["last_updated"] > 60
            ]
            for key in stale_keys:
                del active_devices[key]

            # 2. Розділення об'єктів
            pedestrians = {k: v for k, v in active_devices.items() if v["is_pedestrian"]}
            vehicles = {k: v for k, v in active_devices.items() if not v["is_pedestrian"]}
            
            # 3. Пошук небезпечних зближень
            for p_id, p_data in pedestrians.items():
                for v_id, v_data in vehicles.items():
                    dist = calculate_distance(p_data["lat"], p_data["lon"], v_data["lat"], v_data["lon"])
                    
                    # Базовий тригер: якщо ТЗ ближче ніж 22 метри і має швидкість > 2 м/с (7 км/год)
                    v_speed = v_data.get("speed", 0)
                    p_speed = p_data.get("speed", 0)
                    
                    if dist < 22.0 and v_speed > 2.0:
                        alert_key = f"{p_id}_{v_id}"
                        
                        # Перевірка Cooldown (не частіше ніж раз на 5 секунд для цієї пари)
                        last_alert_time = last_alerts.get(alert_key, 0)
                        if current_time - last_alert_time > 5:
                            # Визначаємо напрямок
                            bearing = calculate_bearing(p_data["lat"], p_data["lon"], v_data["lat"], v_data["lon"])
                            direction_str = get_direction_string(bearing)
                            direction_code = get_direction_code(bearing)
                            ttc_s = estimate_time_to_conflict(dist, v_speed, p_speed)
                            severity, risk_score = classify_risk(dist, v_speed, ttc_s)
                            speed_kmh = round(v_speed * 3.6, 1)
                            vehicle_type = infer_vehicle_type(v_id)
                            
                            if severity == "safe":
                                continue
                            
                            alert_msg = f"УВАГА! Транспорт наближається {direction_str} ({round(dist)} м)"
                            print(f"[{time.strftime('%X')}] {alert_msg} (ТЗ: {v_id})")

                            ttc_text = f"{ttc_s}с" if ttc_s is not None else "невідомо"
                            reason = (
                                f"Vehicle approaching from {direction_code}; "
                                f"distance {round(dist, 1)}m; "
                                f"speed {speed_kmh} km/h; "
                                f"estimated conflict in {ttc_text}."
                            )
                            event = RiskAlertEvent(
                                timestamp=datetime.now(UTC).isoformat().replace("+00:00", "Z"),
                                deviceId=p_id,
                                vehicleId=v_id,
                                severity=severity,
                                riskScore=risk_score,
                                message=alert_msg,
                                direction=direction_code,
                                distanceMeters=round(dist, 1),
                                timeToConflictSeconds=ttc_s,
                                vehicleType=vehicle_type,
                                speedKmh=speed_kmh,
                                reason=reason,
                                vibrationPattern=get_vibration_pattern(severity),
                            )
                            
                            # 1. Відправляємо пуш через WebSockets
                            await manager.send_personal_message(event.model_dump_json(), p_id)
                            
                            # 2. ФОНОВИЙ ЗАПИС У БАЗУ ДАНИХ
                            # Запускаємо як окрему таску, щоб не чекати завершення INSERT-запиту
                            asyncio.create_task(
                                save_incident_to_db(
                                    pedestrian_id=p_id, 
                                    vehicle_id=v_id, 
                                    lat=p_data["lat"], 
                                    lon=p_data["lon"], 
                                    distance=dist
                                )
                            )
                            
                            # Оновлюємо час останнього сповіщення
                            last_alerts[alert_key] = current_time
                        
                        
        
        # Затримка між циклами
        await asyncio.sleep(0.5)