import os
import uvicorn
import json
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool
from pydantic import BaseModel
from pynput.keyboard import Key, Controller
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = FastAPI(title="Mac HID Gamepad Bridge")
keyboard = Controller()

# Allow requests from the local network (our Docker React app)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For local dev, we allow all
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def parse_key_string(val: str):
    val = val.lower().strip()
    if hasattr(Key, val):
        return getattr(Key, val)
    return val

# Load key mappings from mappings.json
MAPPINGS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mappings.json")

def load_key_maps():
    with open(MAPPINGS_FILE, "r") as f:
        raw = json.load(f)
    maps = {}
    for player_str, controllers in raw.items():
        player = int(player_str)
        maps[player] = {}
        for ctrl_name, mapping in controllers.items():
            maps[player][ctrl_name] = {k: parse_key_string(v) for k, v in mapping.items()}
    return maps

KEY_MAPS = load_key_maps()

USER_MAPPINGS = {}

# Fixed player codes
PLAYER_CODES = {
    1: "0001",
    2: "0002",
}

def get_pynput_key(key_str: str, player: int, controller: str = "controller1"):
    k = key_str.lower()
    mapped_val = None
    
    if player in USER_MAPPINGS and k in USER_MAPPINGS[player]:
        mapped_val = USER_MAPPINGS[player][k]
        
    if mapped_val is not None:
        return parse_key_string(mapped_val)

    if player in KEY_MAPS:
        ctrl_map = KEY_MAPS[player].get(controller, {})
        if k in ctrl_map:
            return ctrl_map[k]
        
    raise HTTPException(status_code=400, detail="Invalid key")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("New WebSocket connection established")
    authenticated_player = None
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                action = msg.get("action")
                
                if action == "ping":
                    continue

                if action == "auth":
                    code = msg.get("code", "")
                    for p, c in PLAYER_CODES.items():
                        if code == c:
                            authenticated_player = p
                            break
                    if authenticated_player:
                        await websocket.send_text(json.dumps({"type": "auth", "success": True, "player": authenticated_player}))
                        logger.info(f"P{authenticated_player} authenticated")
                    else:
                        await websocket.send_text(json.dumps({"type": "auth", "success": False}))
                        logger.warning(f"Failed auth attempt with code: {code}")
                    continue

                # All other actions require authentication
                if authenticated_player is None:
                    await websocket.send_text(json.dumps({"type": "error", "message": "Not authenticated"}))
                    continue

                player = authenticated_player
                    
                if action == "configure":
                    mapping = msg.get("mapping", {})
                    USER_MAPPINGS[player] = mapping
                    logger.info(f"P{player} configuration updated")
                    logger.debug(f"P{player} mapping: {mapping}")
                    continue
                    
                key_str = msg.get("key")
                if not key_str or not action:
                    continue
                
                controller = msg.get("controller", "controller1")
                k = get_pynput_key(key_str, player, controller)
                
                if action == "press":
                    await run_in_threadpool(keyboard.press, k)
                    logger.debug(f"P{player} Pressed: {key_str} -> {k}")
                elif action == "release":
                    await run_in_threadpool(keyboard.release, k)
                    logger.debug(f"P{player} Released: {key_str} -> {k}")
                    
            except HTTPException as httpe:
                logger.warning(f"Validation error: {httpe.detail}")
            except Exception as e:
                logger.error(f"Error handling message: {e}")
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected (P{authenticated_player or '?'})")

if __name__ == "__main__":
    print("\n" + "=" * 40)
    print(f"  🎮 Player 1 Code:  \033[1;97;46m {PLAYER_CODES[1]} \033[0m")
    print(f"  🎮 Player 2 Code:  \033[1;97;45m {PLAYER_CODES[2]} \033[0m")
    print("=" * 40 + "\n")
    logger.info("Share these codes with players to connect.")
    # Run server on port 8000
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
