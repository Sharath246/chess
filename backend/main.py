from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import random

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# class Game:
#     def __init__(self):
#         pass

#     async def play_game(self,player1:WebSocket,player2:WebSocket):
#         player1.send_text('white')
#         player2.send_text('black')
#         while True:
#             white_move = await player1.receive_text()
#             if white_move:
#                 pass

class Player:
    def __init__(self,websocket:WebSocket):
        self.in_game = False
        self.websocket = websocket
        self.opponent: "Player" | None = None
    
    def set_opponent(self,player:"Player"):
        self.opponent = player

    async def receive_message(self,message:str):
        await self.websocket.send_text(message)

    async def send_message(self,message:str):
        await self.opponent.receive_message(message)

    async def send_message_self(self,message:str):
        await self.websocket.send_text(message)

    def get_opponent(self):
        return self.opponent

    def setIngame(self):
        if self.in_game:
            self.in_game = False
        else:
            self.in_game = True

    def check_in_game(self):
        return self.in_game  

class ConnectionManager:
    def __init__(self):
        self.games = 0
        self.active_connections : dict[int,Player] = {}
        self.in_game: dict[int,Player] = {}
    
    def create_connection(self,client_id:int,websocket:WebSocket):
        player = Player(websocket)
        self.active_connections[client_id] = player
        return player

    def disconnect(self,client_id:int):
        if client_id in self.active_connections.keys():
            self.active_connections.pop(client_id)
        elif client_id in self.in_game.keys():
            player = self.in_game[client_id]
            opponent = player.get_opponent()
            opponent.set_opponent(None)
            key = None
            for k in self.in_game:
                if self.in_game[k] == opponent:
                    key = k
            self.in_game.pop(key)
            self.active_connections[key] = opponent
            opponent.setIngame()
            self.in_game.pop(client_id)

    async def create_pair(self):
        if len(self.active_connections) >= 2:
            pair = random.sample(list(self.active_connections.keys()),2)
            self.active_connections[pair[0]].set_opponent(self.active_connections[pair[1]])
            self.active_connections[pair[1]].set_opponent(self.active_connections[pair[0]])
            self.active_connections[pair[0]].setIngame()
            self.active_connections[pair[1]].setIngame()
            await self.active_connections[pair[0]].send_message_self('white')
            await self.active_connections[pair[1]].send_message_self('black')
            self.in_game[pair[0]] = self.active_connections[pair[1]]
            self.in_game[pair[1]] = self.active_connections[pair[0]]
            self.active_connections.pop(pair[0])
            self.active_connections.pop(pair[1])
        else:
            return
    
    def check_in_game(self,client_id:int):
        return client_id in self.in_game.keys()

    def add_into_active_connections(self,client_id:int,player:Player):
        if client_id in self.in_game.keys():
            self.in_game.pop(client_id)
        if client_id not in self.active_connections.keys():
            self.active_connections[client_id] = player

manager = ConnectionManager()

@app.websocket('/play-game')
async def play(websocket: WebSocket):
    await websocket.accept()
    await websocket.send_text('connection accepted')
    client_id = int(websocket.query_params["client_id"])
    player = manager.create_connection(client_id,websocket)
    try:
        manager.add_into_active_connections(client_id,player)
        await manager.create_pair()
        while True:
            try:
                data = await websocket.receive_text()
                if player.check_in_game():
                    if player.get_opponent():
                        await player.send_message(data)
                    else:
                        print("no opponent")
            except WebSocketDisconnect:
                print(f"Client {client_id} disconnected.")
                break
    except Exception as e:
        print(f"Unexpected error for client {client_id}: {e}")
    finally:
        manager.disconnect(client_id)


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=9000)