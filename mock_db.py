import uuid

# Імітація бази даних у пам'яті
MOCK_USERS = {
    "pedestrian_1": {"id": "pedestrian_1", "name": "Олексій (пішохід)", "role": "pedestrian"},
    "pedestrian_2": {"id": "pedestrian_2", "name": "Олексій (пішохід)", "role": "pedestrian"},
    "driver_1": {"id": "driver_1", "name": "Іван (водій)", "role": "driver"},
    "driver_2": {"id": "driver_2", "name": "Петро (водій)", "role": "driver"}
}

MOCK_VEHICLES = {
    "scooter_1": {
        "vehicle_id": str(uuid.uuid4()),
        "plate_number": "KA-0001-SC",
        "type": "scooter",
        "owner_id": "driver_1",
        "is_active": True,
        "gps_device_id": "scooter_1"
    },

    "scooter_2": {
        "vehicle_id": str(uuid.uuid4()),
        "plate_number": "KA-0002-SC",
        "type": "scooter",
        "owner_id": "driver_2",
        "is_active": True,
        "gps_device_id": "scooter_2"
    }
}