from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
import asyncio
import time
from sqlalchemy.future import select
from models import User, Device, Incident

# Власні модулі
from db import get_db, init_db
from state import active_devices, state_lock
from risk_engine import risk_engine_loop
from connection_manager import manager
from schemas import TelemetryInput, UserResponse, DeviceResponse, IncidentResponse
from seed import seed_test_data

# ---------- Запуск і зупинка фонової задачі ----------
@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    print("База даних успішно ініціалізована!")
    
    await seed_test_data()
    
    task = asyncio.create_task(risk_engine_loop())
    
    yield 
    task.cancel()

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/telemetry")
async def telemetry(data: TelemetryInput):
    # Генеруємо час оновлення саме на сервері, щоб уникнути розсинхрону часу на клієнтських пристроях
    current_time = time.time()
    
    # Формуємо об'єкт стану для оперативної пам'яті
    device_state = {
        "is_pedestrian": data.is_pedestrian,
        "lat": data.lat,
        "lon": data.lon,
        "speed": data.speed,
        "azimuth": data.azimuth,
        "last_updated": current_time 
    }

    # Блокуємо словник для безпечного запису в асинхронному середовищі
    async with state_lock:
        active_devices[data.device_id] = device_state
        
    return {"status": "ok", "processed_at": current_time}

@app.get("/api/health")
async def check_database_connection(db: AsyncSession = Depends(get_db)):
    try:
        # Виконуємо найпростіший запит до БД
        result = await db.execute(text("SELECT 1"))
        value = result.scalar()
        
        return {
            "status": "success",
            "message": "База даних підключена успішно!",
            "test_value": value
        }
    except Exception as e:
        # Якщо підключення не вдалося, повертаємо помилку
        return {
            "status": "error",
            "message": "Помилка підключення до БД",
            "details": str(e)
        }

# ---------- Ендпоінти для перегляду БД ----------

@app.get("/api/users", response_model=list[UserResponse], tags=["Database"])
async def get_all_users(db: AsyncSession = Depends(get_db)):
    """Повертає список усіх зареєстрованих користувачів"""
    result = await db.execute(select(User))
    users = result.scalars().all()
    return users

@app.get("/api/devices", response_model=list[DeviceResponse], tags=["Database"])
async def get_all_devices(db: AsyncSession = Depends(get_db)):
    """Повертає список усіх зареєстрованих пристроїв"""
    result = await db.execute(select(Device))
    devices = result.scalars().all()
    return devices

@app.get("/api/incidents", response_model=list[IncidentResponse], tags=["Database"])
async def get_all_incidents(db: AsyncSession = Depends(get_db)):
    """Повертає історію всіх небезпечних зближень (для дашбордів)"""
    # Сортуємо інциденти так, щоб найновіші були зверху
    result = await db.execute(select(Incident).order_by(Incident.timestamp.desc()))
    incidents = result.scalars().all()
    return incidents


@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket, client_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(client_id)