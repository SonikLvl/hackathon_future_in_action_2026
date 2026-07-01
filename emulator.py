import asyncio
import aiohttp
import websockets
import json

API_URL = "http://127.0.0.1:8000/api/telemetry"
WS_URL = "ws://127.0.0.1:8000/ws/pedestrian_1"

async def listen_to_alerts():
    """Фонова задача: імітує смарт-браслет пішохода, який чекає на пуш-сповіщення"""
    try:
        async with websockets.connect(WS_URL) as ws:
            print("🎧 [ПІШОХІД] Браслет підключено. Слухаємо ефір...")
            while True:
                msg = await ws.recv()
                print(f"\n[ВІБРАЦІЯ БРАСЛЕТА]: {msg}\n")
    except Exception as e:
        print(f"[ПІШОХІД] З'єднання втрачено: {e}")

async def simulate_movement():
    """Фонова задача: відправляє координати, імітуючи рух назустріч"""
    
    # Початкові координати (наприклад, умовна вулиця)
    # 1 градус широти ~ 111 км, отже 1 метр ~ 0.000009 градусів
    p_lat, p_lon = 50.450000, 30.523400  # Пішохід
    s_lat, s_lon = 50.450500, 30.523400  # Самокат (десь за 55 метрів на північ від пішохода)

    async with aiohttp.ClientSession() as session:
        print("[ТЕЛЕМЕТРІЯ] Починаємо рух...")
        
        for step in range(30):  # Симулюємо 30 секунд реального часу
            # 1. Дані пішохода
            pedestrian_data = {
                "device_id": "pedestrian_1",
                "is_pedestrian": True,
                "lat": p_lat,
                "lon": p_lon,
                "speed": 1.0,  # Пішохід іде 1 м/с
                "azimuth": 0.0
            }
            
            # 2. Дані самоката
            scooter_data = {
                "device_id": "scooter_1",
                "is_pedestrian": False,
                "lat": s_lat,
                "lon": s_lon,
                "speed": 5.0,  # Самокат їде 5 м/с (18 км/год)
                "azimuth": 180.0
            }

            # Відправляємо телеметрію
            await session.post(API_URL, json=pedestrian_data)
            await session.post(API_URL, json=scooter_data)
            
            print(f"[{step} сек] Координати оновлено. ТЗ та пішохід наближаються...")

            # 3. Рухаємо об'єкти назустріч одне одному
            p_lat += 0.000009 * 1.0  # Пішохід іде на північ (+1 метр)
            s_lat -= 0.000009 * 5.0  # Самокат їде на південь назустріч (-5 метрів)

            await asyncio.sleep(1) # Чекаємо 1 секунду перед наступним "пінгом"
            
        print("🏁 Симуляція завершена.")

async def main():
    # Запускаємо слухача веб-сокетів та генератор телеметрії одночасно
    await asyncio.gather(
        listen_to_alerts(),
        simulate_movement()
    )

if __name__ == "__main__":
    asyncio.run(main())