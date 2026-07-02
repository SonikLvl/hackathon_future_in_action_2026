import asyncio

# Єдине сховище для всіх модулів
active_devices: dict = {}
state_lock = asyncio.Lock()