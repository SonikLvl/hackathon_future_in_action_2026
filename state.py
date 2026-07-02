# place for hot data -- dicts

import asyncio

active_devices: dict = {}
state_lock = asyncio.Lock()