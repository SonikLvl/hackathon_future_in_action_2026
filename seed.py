import uuid
from sqlalchemy.future import select
from db import AsyncSessionLocal
from models import User, Device, Vehicle, DeviceType, VehicleType

async def seed_test_data():
    """Наповнює базу даних мок-даними, якщо вона порожня."""
    async with AsyncSessionLocal() as session:
        try:
            # Перевіряємо, чи є вже дані в таблиці users
            result = await session.execute(select(User).limit(1))
            existing_user = result.scalar()
            
            if existing_user:
                print("ℹБаза даних вже містить дані. Сідінг пропущено.")
                return

            print("Наповнення бази даних тестовими даними (Seeding)...")
            
            # --- 1. Створюємо тестового ПІШОХОДА ---
            pedestrian_user = User(
                id=str(uuid.uuid4()), 
                full_name="Іван (Тестовий Пішохід)", 
                is_active=True
            )
            pedestrian_device = Device(
                id="pedestrian_1", # Цей ID ми будемо використовувати в POST /api/telemetry
                device_type=DeviceType.WEB_APP,
                user_id=pedestrian_user.id
            )

            # --- 2. Створюємо тестовий САМОКАТ ---
            driver_user = User(
                id=str(uuid.uuid4()), 
                full_name="Олена (Тестовий Водій)", 
                is_active=True
            )
            scooter_device = Device(
                id="scooter_1", # Цей ID ми будемо використовувати в POST /api/telemetry
                device_type=DeviceType.VEHICLE_TRACKER,
                user_id=driver_user.id
            )
            scooter_vehicle = Vehicle(
                id=str(uuid.uuid4()),
                device_id=scooter_device.id,
                vehicle_type=VehicleType.SCOOTER,
                operator="Bolt"
            )

            # Додаємо всі об'єкти в сесію
            session.add_all([
                pedestrian_user, 
                pedestrian_device, 
                driver_user, 
                scooter_device, 
                scooter_vehicle
            ])
            
            # Зберігаємо зміни в базі даних
            await session.commit()
            print("Тестові дані успішно додані в PostgreSQL!")
            
        except Exception as e:
            print(f"Помилка під час сідінгу бази даних: {e}")