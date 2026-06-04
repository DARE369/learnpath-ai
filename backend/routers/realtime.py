"""
Real-time presence + live message push over WebSocket (Phase 2).

A single /api/ws socket per client (authenticated by access token). It:
  - marks the user present (updates last_seen_at on connect + each ping),
  - delivers live events pushed via push_to_user (e.g. new buddy messages).

In-memory connection registry — fine for the single-worker deploy (Railway
Procfile runs one uvicorn worker). Multi-worker would need a shared pub/sub
(Redis); noted in the ledger.
"""

import logging
from datetime import datetime
from typing import Dict, Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)
router = APIRouter()

_connections: Dict[str, Set[WebSocket]] = {}


async def push_to_user(user_id, payload: dict) -> None:
    """Send a JSON event to every open socket for a user (no-op if none)."""
    conns = _connections.get(str(user_id))
    if not conns:
        return
    dead = []
    for ws in list(conns):
        try:
            await ws.send_json(payload)
        except Exception:
            dead.append(ws)
    for ws in dead:
        conns.discard(ws)


def _touch_presence(user_id) -> None:
    from database import _get_session_factory
    from models import User
    db = _get_session_factory()()
    try:
        u = db.query(User).filter(User.id == user_id).first()
        if u:
            u.last_seen_at = datetime.utcnow()
            db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


@router.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = ""):
    from services.auth_service import auth_service
    user_id = auth_service.get_current_user_id(token) if token else None
    if not user_id:
        await websocket.close(code=1008)
        return

    await websocket.accept()
    _connections.setdefault(str(user_id), set()).add(websocket)
    _touch_presence(user_id)
    try:
        await websocket.send_json({"type": "connected"})
        while True:
            # Any inbound message is treated as a presence heartbeat.
            await websocket.receive_text()
            _touch_presence(user_id)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.debug(f"WebSocket closed: {e}")
    finally:
        conns = _connections.get(str(user_id))
        if conns:
            conns.discard(websocket)
            if not conns:
                _connections.pop(str(user_id), None)
