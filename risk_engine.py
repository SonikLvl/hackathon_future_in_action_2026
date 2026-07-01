import asyncio
import time
import math
import uuid
from state import active_devices, state_lock
from connection_manager import manager 
from db import AsyncSessionLocal
from models import Incident

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
                    
                    # Проста евристика: якщо ТЗ ближче ніж 20 метрів і має швидкість > 2 м/с (7 км/год)
                    # (У повноцінній версії тут буде розрахунок перетину векторів на основі azimuth)
                    v_speed = v_data.get("speed", 0)
                    
                    if dist < 20.0 and v_speed > 2.0:
                        alert_key = f"{p_id}_{v_id}"
                        
                        # Перевірка Cooldown (не частіше ніж раз на 5 секунд для цієї пари)
                        last_alert_time = last_alerts.get(alert_key, 0)
                        if current_time - last_alert_time > 5:
                            # Визначаємо напрямок
                            bearing = calculate_bearing(p_data["lat"], p_data["lon"], v_data["lat"], v_data["lon"])
                            direction_str = get_direction_string(bearing)
                            
                            alert_msg = f"УВАГА! Транспорт наближається {direction_str} ({round(dist)} м)"
                            print(f"[{time.strftime('%X')}] {alert_msg} (ТЗ: {v_id})")
                            
                            # 1. Відправляємо пуш через WebSockets
                            await manager.send_personal_message(alert_msg, p_id)
                            
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