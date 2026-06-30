import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from models import Base  # Імпортуємо наш Base з models.py

# Читаємо URL бази з оточення. Якщо його немає - беремо дефолтний для локального Docker
DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql+asyncpg://varta_user:varta_pass@localhost:5434/varta_db"
)

# Створюємо асинхронний рушій
engine = create_async_engine(DATABASE_URL, echo=True) # echo=True виводить SQL-запити в консоль (зручно для дебагу)

# Фабрика для створення сесій БД
AsyncSessionLocal = async_sessionmaker(
    engine, 
    class_=AsyncSession, 
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

# Функція-залежність для отримання сесії у FastAPI маршрутах
async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

# Функція для автоматичного створення таблиць (Хак для MVP)
async def init_db():
    async with engine.begin() as conn:
        # Увага: це підходить для прототипу. 
        # На продакшені зміни в БД робляться через міграції (Alembic)
        await conn.run_sync(Base.metadata.create_all)