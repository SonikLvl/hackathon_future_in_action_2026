# VARTA — Demo Runbook & Presentation Guide

Everything needed to **run** the live demo and **narrate** it convincingly. Read
[`ARCHITECTURE.md`](./ARCHITECTURE.md) and [`RISK_ENGINE.md`](./RISK_ENGINE.md) first if
a judge might go deep.

---

## 1. What the audience sees

Two screens, reacting to the same event stream in perfect sync:

- **Laptop — `/demo` (operator console):** a live map with a green pedestrian and an
  approaching vehicle, an "Active threat" card (severity, risk score, distance, TTC,
  direction, vehicle), a rolling event timeline, and a scenario-phase badge.
- **Phone — `/bracelet` (the pedestrian's device):** full-screen color that escalates
  green → yellow → orange → red, the directional warning text, and the phone
  **vibrates** with a severity-specific pattern.

The story arc: **calm → caution → warning → critical → cleared**, in ~10 seconds.

---

## 2. Prerequisites (once)

- **Docker** running (for PostgreSQL).
- **Python 3.11+** with a virtualenv.
- **Node ≥ 22.12** for the frontend (Vite 8 / newer ESLint require it).

---

## 3. Start everything (4 terminals)

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
Wait for “База даних успішно ініціалізована!” — startup also seeds `pedestrian_1` and
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

**Terminal 4 — run the scenario** (venv active, from repo root)
```bash
python emulator.py                   # add --with-bike for a second, crossing vehicle
```

> Re-run `python emulator.py` any time to replay. It stops itself cleanly after a
> short stabilization phase — no leftover "twitching" actors.

---

## 4. Pre-demo checklist (60 seconds before you present)

- [ ] Console and bracelet both show **Live** (green).
- [ ] `GET http://localhost:8000/api/active-devices` returns devices (backend healthy).
- [ ] Phone volume/vibration on; screen won't sleep.
- [ ] Browser zoom set so the map + card are both visible on the projector.
- [ ] Do one dry run of `python emulator.py`; confirm caution→warning→critical→clear.
- [ ] Clear the timeline (refresh `/demo`) right before the real run for a clean feed.

---

## 5. The narration script (~90 seconds)

**Hook (10s).** "E-scooters are silent, fast, and everywhere. For a pedestrian —
especially someone with low vision — the first warning is often the impact. VARTA gives
them a warning *before* it."

**Setup (10s).** *Point at the console.* "This is our safety console. Green is the
pedestrian, walking. This vehicle is a scooter streaming its GPS and speed to our
backend ten times a cycle. Watch both the screen and the phone."

**Run it (start the emulator).**

- **Caution (~3.5s in).** "The scooter is ~24 m away and *closing*. VARTA raises a
  **caution** — a gentle heads-up. Note the phone: yellow, a soft buzz, and it already
  says the direction — *front*, relative to where the pedestrian is walking."
- **Warning (~6.5s).** "Now ~14 m. It escalates to **warning** — instantly, we don't
  wait on a timer when danger is rising. The risk score climbs, the map highlights this
  vehicle as the primary threat."
- **Critical (~8.5s).** "Under 7 m — **critical**. Strongest vibration pattern, and on
  the backend we just logged this as a near-miss incident for the city's heatmap."
- **Clear (~10.5s).** "The scooter passes. It's no longer closing, so VARTA sends a
  single **clear** — both screens calmly return to idle. No nagging, no false alarms."

**Punchline (10s).** "One encounter, one clean escalation, one clear — not a wall of
beeps. That restraint is the hard part, and it's exactly what our risk engine is built
to do."

---

## 6. Why it's technically credible (drop these in)

- **It reasons, it doesn't just measure proximity.** Distance *and* time-to-conflict
  *and* whether the vehicle is actually closing. A vehicle parked 3 m away stays silent.
- **Escalation-aware, fatigue-free.** Emits on entry and escalation, suppresses
  downgrades, clears itself. See [`RISK_ENGINE.md`](./RISK_ENGINE.md#6-emission-policy--say-something-only-when-it-matters).
- **Two synchronized clients from one contract.** Console and bracelet consume the same
  versioned `risk_alert` / `risk_clear` events over WebSocket.
- **Sub-second, server-pushed.** 0.5 s risk loop + WebSocket push, not phone polling.

---

## 7. Anticipated judge questions (and crisp answers)

**"Is this real GPS?"** The pipeline is real end-to-end — telemetry API, risk engine,
WebSocket, UI. We swap the hardware for an emulator so the scenario is reproducible on
stage; a real device would `POST` the identical payload.

**"How do you avoid false alarms?"** Three gates: the vehicle must be moving (>1.5 m/s),
it must be *closing* (with a jitter epsilon), and we suppress de-escalation so it never
flickers. Non-threats simply produce nothing.

**"Won't it spam the user?"** No — the emission policy yields ~one alert per severity
step plus one clear per encounter. Same-severity refreshes are throttled to every 2.5 s.

**"Does it scale?"** Today it's single-process with in-memory hot state (great latency,
simple). Production swaps that for a shared store / stream and shards pairs spatially —
see the roadmap below. The contracts and risk logic don't change.

**"How is direction correct?"** It's computed relative to the pedestrian's heading, not
compass north, so "front/back/left/right" mean what the person actually experiences.

**"What about privacy?"** Hot state is ephemeral and auto-expires after 60 s; only
anonymized near-miss incidents (location + distance) are persisted.

---

## 8. Roadmap / production path

| MVP today | Production next |
|---|---|
| In-memory dict + single process | Redis / streaming state, spatially-sharded pair evaluation |
| Emulator generates telemetry | Real device SDK (phone app + vehicle tracker) posting the same contract |
| Closing-speed TTC heuristic | Full trajectory-intersection prediction, map/lane context |
| `create_all` on boot | Alembic migrations |
| Near-miss rows in Postgres | City dashboard: near-miss heatmaps, hotspot analytics for planners |
| Local-network demo | TLS, auth on telemetry + WebSocket, per-device tokens |

---

## 9. Troubleshooting

| Symptom | Fix |
|---|---|
| Console/bracelet stuck "Connecting" | Backend not up, or wrong `VITE_WS_URL`. Confirm `uvicorn` on :8000. |
| Emulator: `ModuleNotFoundError: aiohttp` | venv not active / deps not installed. `source venv/bin/activate && pip install -r requirements.txt`. |
| Nothing happens when emulator runs | Ensure the seed created `pedestrian_1`/`scooter_1` (check backend startup log); the bracelet client id must be `pedestrian_1`. |
| Map jitters / actors twitch after finish | Fixed — emulator stops vehicles in a stabilization phase; re-pull latest and re-run. |
| Phone doesn't vibrate | Browser vibration needs a real device + user gesture; the on-screen color/pattern still demonstrates it. |
| Frontend build/lint fails on Node 20 | Use Node ≥ 22.12 (see `frontend/package.json` `engines`). |
