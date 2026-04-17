"""Rate limiting en memoria por IP (ventana deslizante). Para clusters usá Redis + middleware."""
from __future__ import annotations

import time
from typing import Callable, Dict, List

from fastapi import HTTPException, Request, status

_windows: Dict[str, List[float]] = {}
_gc_last = 0.0


def _gc_old_keys(now: float, window_sec: float) -> None:
    """Evita crecimiento indefinido del dict si entran muchas IPs distintas."""
    global _gc_last
    if now - _gc_last < 300:
        return
    _gc_last = now
    cutoff = now - window_sec
    dead: List[str] = []
    for k, wins in _windows.items():
        while wins and wins[0] < cutoff:
            wins.pop(0)
        if not wins:
            dead.append(k)
    for k in dead:
        del _windows[k]


def make_rate_limiter(name: str, max_requests: int, window_sec: float = 60.0) -> Callable[[Request], None]:
    """
    Devuelve una dependencia FastAPI que limita solicitudes por IP.
    max_requests por ventana window_segundos (por defecto 1 minuto).
    """

    def limiter(request: Request) -> None:
        ip = request.client.host if request.client else "unknown"
        key = f"{name}:{ip}"
        now = time.monotonic()
        _gc_old_keys(now, window_sec)
        win = _windows.setdefault(key, [])
        cutoff = now - window_sec
        while win and win[0] < cutoff:
            win.pop(0)
        if len(win) >= max_requests:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Demasiadas solicitudes. Probá de nuevo en un minuto.",
            )
        win.append(now)

    return limiter


rate_limit_crear_pedido = make_rate_limiter("pedido_post", 45, 60.0)
rate_limit_mp_sync = make_rate_limiter("mp_sync", 80, 60.0)
rate_limit_seguimiento_tel = make_rate_limiter("seguimiento_tel", 40, 60.0)
