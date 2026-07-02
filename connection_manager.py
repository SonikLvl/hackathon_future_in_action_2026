from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # Зберігаємо активні з'єднання у вигляді: {"client_id": [WebSocket_Object, ...]}
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        """Приймає нове підключення та зберігає його у словник."""
        await websocket.accept()
        self.active_connections.setdefault(client_id, []).append(websocket)

    def disconnect(self, client_id: str, websocket: WebSocket):
        """Видаляє підключення, коли користувач відключається."""
        sockets = self.active_connections.get(client_id)
        if not sockets:
            return

        self.active_connections[client_id] = [ws for ws in sockets if ws is not websocket]
        if not self.active_connections[client_id]:
            self.active_connections.pop(client_id, None)

    async def send_personal_message(self, message: str, client_id: str):
        """Відправляє текстове повідомлення (пуш) всім сесіям конкретного клієнта."""
        sockets = self.active_connections.get(client_id, [])
        if not sockets:
            return

        disconnected_sockets: list[WebSocket] = []
        for ws in sockets:
            try:
                await ws.send_text(message)
            except Exception:
                disconnected_sockets.append(ws)

        if disconnected_sockets:
            self.active_connections[client_id] = [
                ws for ws in self.active_connections.get(client_id, []) if ws not in disconnected_sockets
            ]
            if not self.active_connections[client_id]:
                self.active_connections.pop(client_id, None)

manager = ConnectionManager()