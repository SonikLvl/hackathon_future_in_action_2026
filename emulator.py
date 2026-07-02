import asyncio
import argparse
import aiohttp
import websockets
from dataclasses import dataclass

API_URL = "http://127.0.0.1:8000/api/telemetry"
WS_URL = "ws://127.0.0.1:8000/ws/pedestrian_1"
FINAL_ALERT_GRACE_SECONDS = 3
TICK_SECONDS = 0.5
LAT_PER_METER = 0.000009
LON_PER_METER_AT_50_LAT = 0.000014


@dataclass
class Actor:
    device_id: str
    is_pedestrian: bool
    lat: float
    lon: float
    speed_mps: float
    azimuth_deg: float
    dlat_mps: float
    dlon_mps: float

    def to_payload(self) -> dict:
        return {
            "device_id": self.device_id,
            "is_pedestrian": self.is_pedestrian,
            "lat": round(self.lat, 7),
            "lon": round(self.lon, 7),
            "speed": self.speed_mps,
            "azimuth": self.azimuth_deg,
        }

    def tick(self, dt_seconds: float):
        self.lat += LAT_PER_METER * self.dlat_mps * dt_seconds
        self.lon += LON_PER_METER_AT_50_LAT * self.dlon_mps * dt_seconds

async def listen_to_alerts(stop_event: asyncio.Event):
    """Фонова задача: імітує смарт-браслет пішохода, який чекає на пуш-сповіщення"""
    try:
        async with websockets.connect(WS_URL) as ws:
            print("🎧 [ПІШОХІД] Браслет підключено. Слухаємо ефір...")
            while not stop_event.is_set():
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=0.5)
                    print(f"\n[ВІБРАЦІЯ БРАСЛЕТА]: {msg}\n")
                except TimeoutError:
                    # Перевіряємо stop_event кожні 0.5 секунди
                    continue
    except Exception as e:
        print(f"[ПІШОХІД] З'єднання втрачено: {e}")

def build_scenario(name: str) -> tuple[list[Actor], int]:
    """
    Return actors and duration in ticks.
    - headon: one scooter approaches pedestrian head-on
    - realistic: two vehicles create richer demo geometry
    """
    pedestrian = Actor(
        device_id="pedestrian_1",
        is_pedestrian=True,
        lat=50.450000,
        lon=30.523400,
        speed_mps=1.1,
        azimuth_deg=0.0,
        dlat_mps=1.1,  # north
        dlon_mps=0.0,
    )
    scooter = Actor(
        device_id="scooter_1",
        is_pedestrian=False,
        lat=50.450520,
        lon=30.523400,
        speed_mps=6.2,
        azimuth_deg=180.0,
        dlat_mps=-6.2,  # south
        dlon_mps=0.0,
    )

    if name == "headon":
        return [pedestrian, scooter], 50

    # Secondary vehicle crossing from right to left.
    bicycle = Actor(
        device_id="bike_1",
        is_pedestrian=False,
        lat=50.450110,
        lon=30.523880,
        speed_mps=4.0,
        azimuth_deg=270.0,
        dlat_mps=0.0,
        dlon_mps=-4.0,
    )
    return [pedestrian, scooter, bicycle], 60


async def post_actor(session: aiohttp.ClientSession, actor: Actor):
    response = await session.post(API_URL, json=actor.to_payload())
    if response.status >= 400:
        body = await response.text()
        raise RuntimeError(f"Telemetry POST failed for {actor.device_id}: {response.status} {body}")


async def simulate_movement(scenario_name: str):
    """Фонова задача: відправляє координати, імітуючи рух реалістичного сценарію."""
    actors, total_ticks = build_scenario(scenario_name)

    async with aiohttp.ClientSession() as session:
        print(f"[ТЕЛЕМЕТРІЯ] Сценарій '{scenario_name}' запущено. actors={len(actors)} tick={TICK_SECONDS}s")

        for tick in range(total_ticks):
            for actor in actors:
                await post_actor(session, actor)

            if tick % 4 == 0:
                elapsed = round(tick * TICK_SECONDS, 1)
                print(f"[{elapsed:>5}s] frame sent: {[actor.device_id for actor in actors]}")

            for actor in actors:
                actor.tick(TICK_SECONDS)

            await asyncio.sleep(TICK_SECONDS)

        print("🏁 Симуляція завершена.")

async def main():
    parser = argparse.ArgumentParser(description="VARTA telemetry emulator")
    parser.add_argument(
        "--scenario",
        choices=["headon", "realistic"],
        default="realistic",
        help="Scenario preset",
    )
    args = parser.parse_args()

    stop_event = asyncio.Event()
    listener_task = asyncio.create_task(listen_to_alerts(stop_event))

    try:
        await simulate_movement(args.scenario)

        # Даємо час на доставку фінальних алертів з бекенду
        print(f"⌛ Очікуємо фінальні алерти ще {FINAL_ALERT_GRACE_SECONDS}с...")
        await asyncio.sleep(FINAL_ALERT_GRACE_SECONDS)
    finally:
        # Коректно завершуємо слухача вебсокета
        stop_event.set()
        await listener_task
        print("✅ Емулятор завершив роботу.")

if __name__ == "__main__":
    asyncio.run(main())