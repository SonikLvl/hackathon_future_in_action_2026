# VARTA — Running the System

How to start VARTA locally, drive the built-in scenarios, and interpret what you see.
Read [`ARCHITECTURE.md`](./ARCHITECTURE.md) and [`RISK_ENGINE.md`](./RISK_ENGINE.md) for
the design and the algorithm behind the behavior described here.

---

## 1. The two views

Two screens react to the same event stream in sync:

- **`/demo` — operator console:** a live map with a green pedestrian at the centre,
  surrounded by three **risk-zone rings** (24 m caution, 14 m warning, 7 m critical). An
  approaching vehicle is drawn in red with a solid **threat arrow** pointing at the
  pedestrian; other traffic is orange with an "other traffic (+N)" counter. An
  "Active threat" card shows severity, risk score, distance, TTC, direction, and vehicle;
  a rolling event timeline (with a **Clear history** button) logs alerts; and a
  **scenario panel** lets the operator start/stop encounters and shows the live phase.
- **`/bracelet` — the pedestrian's device:** a full-screen color that escalates
  green → yellow → orange → red, the directional warning text, and a severity-specific
  **vibration** pattern.

A typical encounter runs **calm → caution → warning → critical → cleared** in ~10 s.

---

## 2. Prerequisites (once)

- **Docker** running (for PostgreSQL).
- **Python 3.11+** with a virtualenv.
- **Node ≥ 22.12** for the frontend (Vite 8 / newer ESLint require it).

---

## 3. Start the system

**Terminal 1 — database**

```bash
docker compose up -d
```

**Terminal 2 — backend** (from repo root)

```bash
python3 -m venv venv
source venv/bin/activate            # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Wait for "База даних успішно ініціалізована!" — startup also seeds `pedestrian_1` and
`scooter_1` and launches the risk-engine loop.

**Terminal 3 — frontend**

```bash
cd frontend
npm install
npm run dev                          # add -- --host 0.0.0.0 to open on a phone
```

**Open the views:**

- Console → `http://localhost:5173/demo`
- Bracelet → `http://localhost:5173/bracelet` (open on a real phone via the host IP for
  the vibration effect; a second browser window works too)

Both headers should read **Live**.

---

## 4. Run a scenario (from the console)

The console drives everything — no extra terminal needed. In the **scenario panel** on
`/demo`, pick a scenario and press **Start**. The backend scenario runner streams the
scripted actors into hot state, the risk engine reacts, and both views update. Press
**Stop** (or start another scenario) to end it; the runner purges its own actors so the
map is left clean.

| Scenario                         | What it demonstrates                                              |
| -------------------------------- | ----------------------------------------------------------------- |
| **Scooter head-on**              | The canonical caution → warning → critical → clear arc from front |
| **Bike crossing from the side**  | A crossing conflict, reported as a `right`-side direction         |
| **Scooter overtaking from behind** | An overtake-and-pass, reported as a `back` direction            |
| **Busy street (scooter + bike)** | Two vehicles at once; the console highlights the primary threat   |

**Alternative — CLI emulator.** `emulator.py` produces the same telemetry from the
command line (venv active, from repo root):

```bash
python emulator.py                   # add --with-bike for a second, crossing vehicle
```

It stops itself cleanly after a short stabilization phase. Use it when you want a
headless driver; otherwise the console scenario panel is the simpler path.

---

## 5. What to expect, phase by phase (`head_on`)

| Phase        | Console                                                            | Bracelet                                  |
| ------------ | ----------------------------------------------------------------- | ----------------------------------------- |
| **caution**  | Vehicle enters the outer (24 m) ring; threat arrow appears; card shows caution + score in 45–64 | yellow, soft buzz, direction text (e.g. "спереду") |
| **warning**  | Vehicle crosses the 14 m ring; escalates immediately; score 65–84 | orange, stronger buzz                     |
| **critical** | Vehicle inside the 7 m ring; score 85–100; incident logged once   | red, strongest vibration pattern          |
| **clear**    | Vehicle passes and is no longer closing; a single `risk_clear`    | returns to green/idle                     |

Escalation is immediate (a rising threat never waits on a timer); de-escalation as the
vehicle recedes is suppressed, so you get exactly one alert per severity plus one clear —
never a downgrade flicker. See
[`RISK_ENGINE.md`](./RISK_ENGINE.md#6-emission-policy--say-something-only-when-it-matters).

---

## 6. Design FAQ

**Is this real GPS?** The pipeline is real end-to-end — telemetry API, risk engine,
WebSocket, UI. The scenario runner (or emulator) stands in for hardware so encounters are
reproducible; a real device would `POST` the identical payload to `/api/telemetry`.

**How are false alarms avoided?** Three gates: the vehicle must be moving (> 1.5 m/s), it
must be _closing_ (with a jitter epsilon), and de-escalation is suppressed so severity
never flickers. Non-threats produce nothing.

**Won't it spam the user?** No — the emission policy yields about one alert per severity
step plus one clear per encounter. Same-severity refreshes are throttled to every 2.5 s.

**Does it scale?** Today it is single-process with in-memory hot state (low latency,
simple). Production would swap that for a shared store / stream and shard pairs spatially
(see §8). The contracts and risk logic stay the same.

**How is direction correct?** It is computed relative to the pedestrian's heading, not
compass north, so "front / back / left / right" mean what the person actually experiences.

**What about privacy?** Hot state is ephemeral and auto-expires after 60 s; only
anonymized near-miss incidents (location + distance) are persisted.

---

## 7. Verifying a healthy setup

- [ ] Console and bracelet both show **Live** (green).
- [ ] `GET http://localhost:8000/api/active-devices` returns devices.
- [ ] `GET http://localhost:8000/api/simulation/scenarios` lists the four scenarios.
- [ ] Starting a scenario yields caution → warning → critical → clear on both views.
- [ ] Phone volume/vibration on; screen won't sleep (for the vibration effect).

---

## 8. Roadmap / production path

| MVP today                       | Production next                                                         |
| ------------------------------- | ----------------------------------------------------------------------- |
| In-memory dict + single process | Redis / streaming state, spatially-sharded pair evaluation              |
| Scripted scenarios / emulator   | Real device SDK (phone app + vehicle tracker) posting the same contract |
| Closing-speed TTC heuristic     | Full trajectory-intersection prediction, map/lane context               |
| `create_all` on boot            | Alembic migrations                                                      |
| Near-miss rows in Postgres      | City dashboard: near-miss heatmaps, hotspot analytics for planners      |
| Local-network deployment        | TLS, auth on telemetry + WebSocket, per-device tokens                   |

---

## 9. Troubleshooting

| Symptom                                  | Fix                                                                                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Console/bracelet stuck "Connecting"      | Backend not up, or wrong `VITE_WS_URL`. Confirm `uvicorn` on :8000.                                                            |
| Scenario panel is empty / Start does nothing | Backend not reachable; check `GET /api/simulation/scenarios` and the backend log.                                          |
| Nothing happens when a scenario runs     | Ensure the seed created `pedestrian_1` (check backend startup log); the bracelet client id must be `pedestrian_1`.            |
| Emulator: `ModuleNotFoundError: aiohttp` | venv not active / deps not installed. `source venv/bin/activate && pip install -r requirements.txt`.                          |
| Actors "drag" across the map on restart  | Fixed — the scene snaps actors to fresh scenario start positions instead of sliding; re-pull latest.                          |
| Phone doesn't vibrate                    | Browser vibration needs a real device + user gesture; the on-screen color/pattern still demonstrates it.                      |
| Frontend build/lint fails on Node 20     | Use Node ≥ 22.12 (see `frontend/package.json` `engines`).                                                                     |
