from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # Зберігаємо активні з'єднання у вигляді: {"client_id": WebSocket_Object}
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        """Приймає нове підключення та зберігає його у словник."""
        await websocket.accept()
        self.active_connections[client_id] = websocket

    def disconnect(self, client_id: str):
        """Видаляє підключення, коли користувач відключається."""
        self.active_connections.pop(client_id, None)

    async def send_personal_message(self, message: str, client_id: str):
        """Відправляє текстове повідомлення (пуш) конкретному клієнту."""
        ws = self.active_connections.get(client_id)
        if ws:
            await ws.send_text(message)

manager = ConnectionManager()