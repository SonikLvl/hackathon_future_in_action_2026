"""In-process scenario runner ("simulation harness").

This is a *demo tool*, not a production component. It lets the operator start a
pre-scripted movement scenario straight from the console UI instead of running the
standalone `emulator.py` in a separate terminal. It writes telemetry frames directly
into the shared in-memory state, so the risk engine treats them exactly like real
device telemetry.

Only one scenario runs at a time. Starting a new one cancels the previous run and
purges its managed devices so the scene stays clean.
"""

import asyncio
import time
from dataclasses import dataclass
from typing import Callable

from state import active_devices, state_lock

# Same projection constants as emulator.py (city-scale flat-earth approximation).
LAT_PER_METER = 0.000009
LON_PER_METER_AT_50_LAT = 0.000014
TICK_SECONDS = 0.5
STABILIZE_TICKS = 4

# Anchor point for every scenario (a plausible Kyiv sidewalk).
BASE_LAT = 50.450000
BASE_LON = 30.523400


@dataclass
class SimActor:
    device_id: str
    is_pedestrian: bool
    lat: float
    lon: float
    speed_mps: float
    azimuth_deg: float
    dlat_mps: float
    dlon_mps: float

    def advance(self, dt_seconds: float) -> None:
        self.lat += LAT_PER_METER * self.dlat_mps * dt_seconds
        self.lon += LON_PER_METER_AT_50_LAT * self.dlon_mps * dt_seconds

    def halt(self) -> None:
        self.speed_mps = 0.0
        self.dlat_mps = 0.0
        self.dlon_mps = 0.0

    def state(self, timestamp: float) -> dict:
        return {
            "is_pedestrian": self.is_pedestrian,
            "lat": round(self.lat, 7),
            "lon": round(self.lon, 7),
            "speed": self.speed_mps,
            "azimuth": self.azimuth_deg,
            "last_updated": timestamp,
        }


def _pedestrian(speed_mps: float = 0.4) -> SimActor:
    """A pedestrian walking slowly north from the anchor point."""
    return SimActor(
        device_id="pedestrian_1",
        is_pedestrian=True,
        lat=BASE_LAT,
        lon=BASE_LON,
        speed_mps=speed_mps,
        azimuth_deg=0.0,
        dlat_mps=speed_mps,
        dlon_mps=0.0,
    )


def _scenario_head_on() -> tuple[list[SimActor], int]:
    """Scooter approaching head-on from the front; classic caution->warning->critical."""
    scooter = SimActor(
        device_id="scooter_1",
        is_pedestrian=False,
        lat=BASE_LAT + 35 * LAT_PER_METER,  # ~35 m north
        lon=BASE_LON + 1.5 * LON_PER_METER_AT_50_LAT,  # ~1.5 m east (pass side-by-side)
        speed_mps=3.0,
        azimuth_deg=180.0,
        dlat_mps=-3.0,
        dlon_mps=0.0,
    )
    return [_pedestrian(0.4), scooter], 26


def _scenario_side_crossing() -> tuple[list[SimActor], int]:
    """Bike crossing the pedestrian's path from the right; exercises directional logic."""
    bike = SimActor(
        device_id="bike_1",
        is_pedestrian=False,
        lat=BASE_LAT + 10 * LAT_PER_METER,  # ~10 m ahead
        lon=BASE_LON + 22 * LON_PER_METER_AT_50_LAT,  # ~22 m to the right (east)
        speed_mps=3.2,
        azimuth_deg=270.0,
        dlat_mps=0.0,
        dlon_mps=-3.2,  # heading west, across the front
    )
    return [_pedestrian(0.6), bike], 30


def _scenario_from_behind() -> tuple[list[SimActor], int]:
    """Scooter overtaking from behind (south) and passing — exercises 'back' direction."""
    scooter = SimActor(
        device_id="scooter_1",
        is_pedestrian=False,
        lat=BASE_LAT - 40 * LAT_PER_METER,  # ~40 m behind (south)
        lon=BASE_LON + 1.2 * LON_PER_METER_AT_50_LAT,  # slight offset to pass, not hit
        speed_mps=5.0,
        azimuth_deg=0.0,
        dlat_mps=5.0,  # heading north, catching up to the pedestrian
        dlon_mps=0.0,
    )
    return [_pedestrian(1.2), scooter], 30


def _scenario_busy_street() -> tuple[list[SimActor], int]:
    """Two vehicles at once: head-on scooter + crossing bike (multi-threat handling)."""
    scooter = SimActor(
        device_id="scooter_1",
        is_pedestrian=False,
        lat=BASE_LAT + 35 * LAT_PER_METER,
        lon=BASE_LON + 1.5 * LON_PER_METER_AT_50_LAT,
        speed_mps=3.0,
        azimuth_deg=180.0,
        dlat_mps=-3.0,
        dlon_mps=0.0,
    )
    bike = SimActor(
        device_id="bike_1",
        is_pedestrian=False,
        lat=BASE_LAT + 12 * LAT_PER_METER,
        lon=BASE_LON + 24 * LON_PER_METER_AT_50_LAT,
        speed_mps=3.2,
        azimuth_deg=270.0,
        dlat_mps=0.0,
        dlon_mps=-3.2,
    )
    return [_pedestrian(0.5), scooter, bike], 34


@dataclass
class ScenarioDef:
    id: str
    name: str
    description: str
    build: Callable[[], tuple[list[SimActor], int]]


SCENARIOS: dict[str, ScenarioDef] = {
    "head_on": ScenarioDef(
        id="head_on",
        name="Scooter head-on",
        description="A scooter approaches from the front. Watch caution → warning → critical → clear.",
        build=_scenario_head_on,
    ),
    "side_crossing": ScenarioDef(
        id="side_crossing",
        name="Bike crossing from the side",
        description="A bike crosses the pedestrian's path from the right side.",
        build=_scenario_side_crossing,
    ),
    "from_behind": ScenarioDef(
        id="from_behind",
        name="Scooter overtaking from behind",
        description="A faster scooter catches up from behind and passes the pedestrian.",
        build=_scenario_from_behind,
    ),
    "busy_street": ScenarioDef(
        id="busy_street",
        name="Busy street (scooter + bike)",
        description="Two vehicles at once — the console highlights the primary threat.",
        build=_scenario_busy_street,
    ),
}


class SimulationManager:
    """Owns the single running scenario task and its lifecycle."""

    def __init__(self) -> None:
        self._task: asyncio.Task | None = None
        self._scenario_id: str | None = None
        self._phase: str = "idle"
        self._started_at: float | None = None
        self._managed_ids: set[str] = set()

    @property
    def running(self) -> bool:
        return self._task is not None and not self._task.done()

    def list_scenarios(self) -> list[dict]:
        return [
            {"id": s.id, "name": s.name, "description": s.description}
            for s in SCENARIOS.values()
        ]

    def status(self) -> dict:
        elapsed = (
            round(time.time() - self._started_at, 1)
            if self._started_at is not None and self.running
            else 0.0
        )
        return {
            "running": self.running,
            "scenarioId": self._scenario_id,
            "phase": self._phase,
            "elapsedSeconds": elapsed,
        }

    async def start(self, scenario_id: str) -> None:
        if scenario_id not in SCENARIOS:
            raise KeyError(scenario_id)

        await self.stop()

        # Purge devices from any previous scenario so the scene starts clean.
        async with state_lock:
            for device_id in self._managed_ids:
                active_devices.pop(device_id, None)

        self._scenario_id = scenario_id
        self._started_at = time.time()
        self._phase = "running"
        self._task = asyncio.create_task(self._run(scenario_id))

    async def stop(self) -> None:
        task = self._task
        if task is not None and not task.done():
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
        self._task = None
        self._phase = "idle"

    async def _run(self, scenario_id: str) -> None:
        actors, total_ticks = SCENARIOS[scenario_id].build()
        self._managed_ids = {actor.device_id for actor in actors}

        # Active phase: advance every actor and publish frames.
        for _ in range(total_ticks):
            timestamp = time.time()
            async with state_lock:
                for actor in actors:
                    active_devices[actor.device_id] = actor.state(timestamp)
            for actor in actors:
                actor.advance(TICK_SECONDS)
            await asyncio.sleep(TICK_SECONDS)

        # Stabilization phase: stop vehicles, emit a few calm frames so the risk
        # engine cleanly clears any active threat.
        self._phase = "stabilizing"
        for actor in actors:
            if not actor.is_pedestrian:
                actor.halt()
        for _ in range(STABILIZE_TICKS):
            timestamp = time.time()
            async with state_lock:
                for actor in actors:
                    active_devices[actor.device_id] = actor.state(timestamp)
            await asyncio.sleep(TICK_SECONDS)

        self._phase = "finished"


manager = SimulationManager()
