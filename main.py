from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from contextlib import asynccontextmanager
import asyncio

# ---------- "Гарячий" стан  ----------
active_devices: dict = {}
state_lock = asyncio.Lock()

# ---------- Менеджер WebSocket-з'єднань ----------
class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket

    def disconnect(self, client_id: str):
        self.active_connections.pop(client_id, None)

    async def send_personal_message(self, message: str, client_id: str):
        ws = self.active_connections.get(client_id)
        if ws:
            await ws.send_text(message)

manager = ConnectionManager()

# ---------- Risk Engine (поки що заглушка) ----------
async def risk_engine_loop():
    while True:
        async with state_lock:
            devices_snapshot = dict(active_devices)
        # тимчасово просто друкуємо, що бачимо у пам'яті
        print("Поточні пристрої:", devices_snapshot)
        await asyncio.sleep(1)

# ---------- Запуск і зупинка фонової задачі ----------
@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(risk_engine_loop())
    yield
    task.cancel()

app = FastAPI(lifespan=lifespan)

@app.post("/api/telemetry")
async def telemetry(data: dict):
    async with state_lock:
        active_devices[data["device_id"]] = data
    return {"status": "ok"}

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket, client_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(client_id)