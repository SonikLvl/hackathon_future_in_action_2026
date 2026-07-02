import asyncio
import math
from state import active_devices, state_lock

ALERT_RADIUS_METERS = 50  # поки статичний, потім зробимо динамічним

def distance_meters(lat1, lon1, lat2, lon2) -> float:
    # спрощена формула (достатньо для MVP в межах міста)
    R = 6_371_000
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

async def risk_engine_loop(manager):
    while True:
        async with state_lock:
            snapshot = dict(active_devices)

        transports  = {k: v for k, v in snapshot.items() if v.get("type") == "transport"}
        pedestrians = {k: v for k, v in snapshot.items() if v.get("type") == "pedestrian"}

        for ped_id, ped in pedestrians.items():
            for tr_id, tr in transports.items():
                dist = distance_meters(
                    ped["lat"], ped["lon"],
                    tr["lat"],  tr["lon"]
                )
                if dist <= ALERT_RADIUS_METERS:
                    await manager.send(ped_id, f"DANGER:{tr_id}:{dist:.1f}m")

        await asyncio.sleep(1)