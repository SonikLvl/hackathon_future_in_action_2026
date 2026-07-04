import asyncio
import time
import math
import uuid
from dataclasses import dataclass
from datetime import datetime, UTC
from state import active_devices, state_lock
from connection_manager import manager
from db import AsyncSessionLocal
from models import Incident
from schemas import AlertDirection, AlertSeverity, RiskAlertEvent, RiskClearEvent

EARTH_RADIUS = 6371000  # метри

# ---------------------------------------------------------------------------
# Risk engine configuration
# ---------------------------------------------------------------------------
# Severity is driven primarily by distance bands (interpretable + demo-stable),
# escalated by time-to-conflict. The numeric risk score is a continuous 0-100
# gauge blended from distance/TTC/speed and kept consistent with the band.
LOOP_INTERVAL_SECONDS = 0.5
STALE_DEVICE_SECONDS = 60

# Distance bands (metres) for severity classification.
CRITICAL_DISTANCE_M = 7.0
WARNING_DISTANCE_M = 14.0
CAUTION_DISTANCE_M = 24.0

# Time-to-conflict escalation thresholds (seconds).
CRITICAL_TTC_S = 1.5
WARNING_TTC_S = 3.0
CAUTION_TTC_S = 5.0

# A vehicle must be moving and actively closing to be considered a threat.
MIN_VEHICLE_SPEED_MPS = 1.5
CLOSING_EPSILON_M = 0.3

# Score gauge tuning.
DISTANCE_SCORE_RANGE_M = 28.0
TTC_SCORE_HORIZON_S = 8.0
SPEED_SCORE_REF_KMH = 35.0

# Emission policy.
# Same-severity alerts are re-sent at most this often (to refresh distance/TTC).
REFRESH_INTERVAL_SECONDS = 2.5

SEVERITY_ORDER: dict[AlertSeverity, int] = {
    "safe": 0,
    "caution": 1,
    "warning": 2,
    "critical": 3,
}

# Continuous score band per severity so the gauge stays consistent with the label.
SEVERITY_SCORE_BAND: dict[AlertSeverity, tuple[int, int]] = {
    "safe": (0, 40),
    "caution": (45, 64),
    "warning": (65, 84),
    "critical": (85, 100),
}


@dataclass
class PairState:
    """Tracks the ongoing relationship between one pedestrian and one vehicle."""

    last_distance: float | None = None
    # Highest severity currently latched for this episode. De-escalation is
    # suppressed until the pair fully clears, to avoid flapping alerts.
    emitted_severity: AlertSeverity = "safe"
    last_emit_time: float = 0.0
    critical_logged: bool = False


# Per-pair state cache, keyed by "<pedestrian_id>__<vehicle_id>".
pair_states: dict[str, PairState] = {}


def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Обчислює відстань у метрах між двома координатами."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
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
    initial_bearing = math.degrees(initial_bearing)
    return (initial_bearing + 360) % 360


def relative_bearing(absolute_bearing: float, pedestrian_heading: float | None) -> float:
    """
    Азимут ТЗ відносно напрямку руху пішохода.
    Якщо пішохід не має заданого курсу, вважаємо, що він дивиться на північ (0°).
    """
    heading = pedestrian_heading if pedestrian_heading is not None else 0.0
    return (absolute_bearing - heading + 360) % 360


def get_direction_string(bearing: float) -> str:
    """Перетворює кут (відносний до пішохода) у зрозумілий текст напрямку."""
    if 45 <= bearing < 135:
        return "справа"
    if 135 <= bearing < 225:
        return "ззаду"
    if 225 <= bearing < 315:
        return "зліва"
    return "спереду"


def get_direction_code(bearing: float) -> AlertDirection:
    """Перетворює кут (відносний до пішохода) у стандартизовану мітку напрямку."""
    if 45 <= bearing < 135:
        return "right"
    if 135 <= bearing < 225:
        return "back"
    if 225 <= bearing < 315:
        return "left"
    return "front"


def estimate_time_to_conflict(
    distance_m: float, vehicle_speed_mps: float, pedestrian_speed_mps: float
) -> float | None:
    """
    Оцінка часу до потенційного конфлікту (спрощена модель зближення).
    Повертає None, якщо об'єкти не зближуються.
    """
    closing_speed = vehicle_speed_mps + pedestrian_speed_mps
    if closing_speed <= 0.1:
        return None
    return round(distance_m / closing_speed, 1)


def classify_severity(
    distance_m: float,
    vehicle_speed_mps: float,
    ttc_s: float | None,
    is_closing: bool,
) -> AlertSeverity:
    """
    Визначає рівень небезпеки на основі дистанції (основне) та часу до конфлікту.
    Нерухомий транспорт або той, що віддаляється, не вважається загрозою.
    """
    if not is_closing or vehicle_speed_mps < MIN_VEHICLE_SPEED_MPS:
        return "safe"

    if distance_m <= CRITICAL_DISTANCE_M or (ttc_s is not None and ttc_s <= CRITICAL_TTC_S):
        return "critical"
    if distance_m <= WARNING_DISTANCE_M or (ttc_s is not None and ttc_s <= WARNING_TTC_S):
        return "warning"
    if distance_m <= CAUTION_DISTANCE_M or (ttc_s is not None and ttc_s <= CAUTION_TTC_S):
        return "caution"
    return "safe"


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def compute_risk_score(
    severity: AlertSeverity,
    distance_m: float,
    vehicle_speed_mps: float,
    ttc_s: float | None,
) -> int:
    """
    Неперервний індикатор ризику 0-100, зважений з дистанції, TTC та швидкості,
    але прив'язаний до діапазону поточного рівня небезпеки для узгодженості з міткою.
    """
    speed_kmh = vehicle_speed_mps * 3.6
    distance_score = _clamp(100 * (1 - distance_m / DISTANCE_SCORE_RANGE_M), 0, 100)
    ttc_score = 0.0 if ttc_s is None else _clamp(100 * (1 - ttc_s / TTC_SCORE_HORIZON_S), 0, 100)
    speed_score = _clamp(100 * speed_kmh / SPEED_SCORE_REF_KMH, 0, 100)

    raw = 0.5 * distance_score + 0.3 * ttc_score + 0.2 * speed_score
    low, high = SEVERITY_SCORE_BAND[severity]
    return int(round(_clamp(raw, low, high)))


def infer_vehicle_type(vehicle_id: str) -> str:
    normalized = vehicle_id.lower()
    if "car" in normalized:
        return "автомобіль"
    if "motor" in normalized:
        return "мотоцикл"
    if "bike" in normalized:
        return "велосипед"
    if "scooter" in normalized:
        return "самокат"
    return "невідомо"


def get_vibration_pattern(severity: AlertSeverity) -> list[int]:
    if severity == "critical":
        return [180, 70, 180, 70, 180]
    if severity == "warning":
        return [140, 90, 140]
    if severity == "caution":
        return [100, 100, 100]
    return []


def build_alert_event(
    *,
    pedestrian_id: str,
    vehicle_id: str,
    severity: AlertSeverity,
    risk_score: int,
    distance_m: float,
    ttc_s: float | None,
    vehicle_speed_mps: float,
    direction_code: AlertDirection,
    direction_str: str,
) -> RiskAlertEvent:
    speed_kmh = round(vehicle_speed_mps * 3.6, 1)
    ttc_text = f"{ttc_s}с" if ttc_s is not None else "невідомо"
    message = f"УВАГА! Транспорт наближається {direction_str} ({round(distance_m)} м)"
    reason = (
        f"Транспорт наближається {direction_str}; "
        f"дистанція {round(distance_m, 1)} м; "
        f"швидкість {speed_kmh} км/год; "
        f"орієнтовний час до зіткнення: {ttc_text}."
    )
    return RiskAlertEvent(
        timestamp=datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        deviceId=pedestrian_id,
        vehicleId=vehicle_id,
        severity=severity,
        riskScore=risk_score,
        message=message,
        direction=direction_code,
        distanceMeters=round(distance_m, 1),
        timeToConflictSeconds=ttc_s,
        vehicleType=infer_vehicle_type(vehicle_id),
        speedKmh=speed_kmh,
        reason=reason,
        vibrationPattern=get_vibration_pattern(severity),
    )


def build_clear_event(pedestrian_id: str, vehicle_id: str) -> RiskClearEvent:
    return RiskClearEvent(
        timestamp=datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        deviceId=pedestrian_id,
        vehicleId=vehicle_id,
        reason="Vehicle no longer closing / left the risk zone.",
    )


async def save_incident_to_db(
    pedestrian_id: str, vehicle_id: str, lat: float, lon: float, distance: float
):
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
                distance_meters=round(distance, 2),
            )
            session.add(new_incident)
            await session.commit()
            print(f"Інцидент успішно записано в БД (Дистанція: {round(distance, 2)}м)")
        except Exception as e:
            print(f"Помилка запису інциденту в БД: {e}")


def _cleanup_stale_pairs(active_device_ids: set[str]) -> None:
    """Видаляє стан пар, у яких хоча б один пристрій більше не активний."""
    for pair_key in list(pair_states.keys()):
        pedestrian_id, _, vehicle_id = pair_key.partition("__")
        if pedestrian_id not in active_device_ids or vehicle_id not in active_device_ids:
            pair_states.pop(pair_key, None)


async def _process_pair(
    *,
    current_time: float,
    pedestrian_id: str,
    pedestrian: dict,
    vehicle_id: str,
    vehicle: dict,
) -> None:
    """Обчислює ризик для однієї пари та застосовує політику емісії подій."""
    pair_key = f"{pedestrian_id}__{vehicle_id}"
    state = pair_states.setdefault(pair_key, PairState())

    dist = calculate_distance(
        pedestrian["lat"], pedestrian["lon"], vehicle["lat"], vehicle["lon"]
    )
    previous_dist = state.last_distance
    is_closing = previous_dist is not None and dist < previous_dist - CLOSING_EPSILON_M
    state.last_distance = dist

    vehicle_speed = vehicle.get("speed", 0.0) or 0.0
    pedestrian_speed = pedestrian.get("speed", 0.0) or 0.0
    ttc_s = estimate_time_to_conflict(dist, vehicle_speed, pedestrian_speed) if is_closing else None

    severity = classify_severity(dist, vehicle_speed, ttc_s, is_closing)
    prev_level = SEVERITY_ORDER[state.emitted_severity]
    cur_level = SEVERITY_ORDER[severity]

    # --- De-escalation / clear path --------------------------------------
    if severity == "safe":
        if prev_level > 0:
            await manager.send_personal_message(
                build_clear_event(pedestrian_id, vehicle_id).model_dump_json(),
                pedestrian_id,
            )
            print(f"[{time.strftime('%X')}] CLEAR (ТЗ: {vehicle_id})")
            state.emitted_severity = "safe"
            state.critical_logged = False
        return

    # --- Emission policy for active threats ------------------------------
    should_emit = False
    if prev_level == 0:
        # Entry into an alert state.
        should_emit = True
    elif cur_level > prev_level:
        # Escalation: bypass cooldown, emit immediately.
        should_emit = True
    elif cur_level == prev_level:
        # Same severity: refresh distance/TTC at a limited cadence.
        should_emit = current_time - state.last_emit_time >= REFRESH_INTERVAL_SECONDS
    else:
        # De-escalation while still closing: suppress (keep latched severity).
        should_emit = False

    if not should_emit:
        return

    bearing = calculate_bearing(
        pedestrian["lat"], pedestrian["lon"], vehicle["lat"], vehicle["lon"]
    )
    rel_bearing = relative_bearing(bearing, pedestrian.get("azimuth"))
    direction_code = get_direction_code(rel_bearing)
    direction_str = get_direction_string(rel_bearing)
    risk_score = compute_risk_score(severity, dist, vehicle_speed, ttc_s)

    event = build_alert_event(
        pedestrian_id=pedestrian_id,
        vehicle_id=vehicle_id,
        severity=severity,
        risk_score=risk_score,
        distance_m=dist,
        ttc_s=ttc_s,
        vehicle_speed_mps=vehicle_speed,
        direction_code=direction_code,
        direction_str=direction_str,
    )

    print(f"[{time.strftime('%X')}] {severity.upper()} {event.message} (ТЗ: {vehicle_id})")
    await manager.send_personal_message(event.model_dump_json(), pedestrian_id)

    # Latch the highest severity reached this episode (never downgrade until clear).
    if cur_level > prev_level or prev_level == 0:
        state.emitted_severity = severity
    state.last_emit_time = current_time

    # Persist a near-miss incident once, when the pair first reaches critical.
    if severity == "critical" and not state.critical_logged:
        state.critical_logged = True
        asyncio.create_task(
            save_incident_to_db(
                pedestrian_id=pedestrian_id,
                vehicle_id=vehicle_id,
                lat=pedestrian["lat"],
                lon=pedestrian["lon"],
                distance=dist,
            )
        )


async def risk_engine_loop():
    while True:
        current_time = time.time()

        async with state_lock:
            # 1. Очищення старих даних (GDPR compliance)
            stale_keys = [
                device_id
                for device_id, data in active_devices.items()
                if current_time - data["last_updated"] > STALE_DEVICE_SECONDS
            ]
            for key in stale_keys:
                del active_devices[key]

            active_device_ids = set(active_devices.keys())
            _cleanup_stale_pairs(active_device_ids)

            # 2. Розділення об'єктів
            pedestrians = {k: v for k, v in active_devices.items() if v["is_pedestrian"]}
            vehicles = {k: v for k, v in active_devices.items() if not v["is_pedestrian"]}

            # 3. Оцінка ризику по кожній парі "пішохід - транспорт"
            for pedestrian_id, pedestrian in pedestrians.items():
                for vehicle_id, vehicle in vehicles.items():
                    await _process_pair(
                        current_time=current_time,
                        pedestrian_id=pedestrian_id,
                        pedestrian=pedestrian,
                        vehicle_id=vehicle_id,
                        vehicle=vehicle,
                    )

        await asyncio.sleep(LOOP_INTERVAL_SECONDS)
