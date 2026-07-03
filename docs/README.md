# VARTA — Documentation

**VARTA (Vehicle Alert & Real-Time Awareness)** warns vulnerable pedestrians about
dangerous vehicles nearby, in real time. Micromobility (e-scooters, bikes) and cars
stream their position and speed to a backend risk engine; when a vehicle becomes a
credible threat to a pedestrian, VARTA instantly pushes a structured alert to that
pedestrian's device (vibration + a full-screen warning).

> Хакатон «Місто майбутнього» · Team TechSisters

---

## Overview

- **Problem.** E-scooters and bikes are silent, fast, and everywhere. Pedestrians —
  especially people with low vision — often get no warning before a near-miss.
- **Approach.** VARTA turns live movement data into a graded risk signal and delivers
  a directional, escalating alert (**caution → warning → critical**) to the pedestrian
  _before_ the conflict, then clears itself the moment the danger passes.
- **What makes it more than a proximity buzzer.** A per-pair risk engine reasons about
  distance, time-to-conflict, speed, and whether the vehicle is actually _closing in_ —
  and only emits when the situation changes meaningfully.

---

## Document map

| Doc                                    | What it covers                                                                                     |
| -------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | System components, data flow, tech choices & rationale, event contracts, frontend design           |
| [`RISK_ENGINE.md`](./RISK_ENGINE.md)   | The core algorithm: pair state, scoring, severity mapping, emission policy, and why each value was chosen |
| [`DEMO.md`](./DEMO.md)                 | How to run the system, the built-in scenarios, expected behavior, FAQ, roadmap, and troubleshooting |

The team-facing setup / onboarding notes (in Ukrainian) live in the
[repository root `README.md`](../README.md).

---

## At a glance

| Layer            | Technology                                 | Role                                                             |
| ---------------- | ------------------------------------------ | ---------------------------------------------------------------- |
| Ingestion API    | FastAPI · `POST /api/telemetry`            | Accepts position/speed from every device                         |
| Hot state        | `dict` + `asyncio.Lock`                    | Latest known position of all active devices                      |
| Risk engine      | Background `asyncio` loop (0.5 s)          | Scores every pedestrian↔vehicle pair, decides what to emit       |
| Push channel     | FastAPI WebSocket · `/ws/{client_id}`      | Delivers `risk_alert` / `risk_clear` events instantly            |
| Live snapshot    | `GET /api/active-devices`                  | Polled by the console to animate the scene                       |
| Scenario runner  | In-process `asyncio` task · `/api/simulation/*` | Plays scripted encounters into hot state, started from the UI    |
| Cold storage     | PostgreSQL (SQLAlchemy async)              | Registered users/devices + logged near-miss incidents            |
| Frontend         | React 19 + TypeScript + Vite + Tailwind v4 | Operator console (`/demo`) and pedestrian bracelet (`/bracelet`) |
| CLI emulator     | `emulator.py`                              | Optional command-line telemetry generator (alternative to the UI runner) |

## Repository map

```text
.
├── main.py                # FastAPI app: routes, WebSocket + simulation endpoints, lifespan
├── risk_engine.py         # The core: pair-state risk scoring + emission policy
├── simulation_runner.py   # In-process scenario runner (writes scripted actors into hot state)
├── connection_manager.py  # WebSocket fan-out (multi-socket per client_id)
├── schemas.py             # Pydantic contracts (telemetry in, risk + simulation events out)
├── state.py               # Shared in-memory device state + lock
├── models.py              # SQLAlchemy tables (users, devices, vehicles, incidents)
├── db.py                  # Async engine/session + table bootstrap
├── seed.py                # Seeds pedestrian_1 + scooter_1 on startup
├── emulator.py            # Optional CLI telemetry generator
├── docker-compose.yml     # PostgreSQL for local dev
└── frontend/
    └── src/
        ├── app/App.tsx                       # Path-based routing
        ├── pages/demo/DemoPage.tsx           # Operator command console
        ├── pages/bracelet/BraceletPage.tsx   # Pedestrian device UI
        ├── features/realtime/                # WS stream, telemetry polling, simulation-control hooks
        ├── features/simulation/              # Actor model, scene mapping, ThreatScene, ScenarioControls
        └── features/bracelet/                # Event parsing + types
```
