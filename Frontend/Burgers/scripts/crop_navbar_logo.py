"""One-off: recorta el emblema y deja transparente el fondo oscuro (flood-fill desde bordes)."""
from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

_ROOT = Path(__file__).resolve().parents[1]
SRC = _ROOT / "public" / "img" / "navbar-logo-source.png"
OUT = _ROOT / "public" / "img" / "navbar-brand.png"


def dist(a: tuple[int, int, int], b: tuple[int, int, int]) -> float:
    return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2) ** 0.5


def main() -> None:
    im = Image.open(str(SRC)).convert("RGBA")
    w, h = im.size
    px = im.load()
    seed = px[0, 0][:3]
    thresh = 52.0

    q: deque[tuple[int, int]] = deque()
    seen: set[tuple[int, int]] = set()

    def try_add(x: int, y: int) -> None:
        if x < 0 or y < 0 or x >= w or y >= h:
            return
        if (x, y) in seen:
            return
        c = px[x, y][:3]
        if dist(c, seed) <= thresh:
            seen.add((x, y))
            q.append((x, y))

    for x in range(w):
        try_add(x, 0)
        try_add(x, h - 1)
    for y in range(h):
        try_add(0, y)
        try_add(w - 1, y)

    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if nx < 0 or ny < 0 or nx >= w or ny >= h:
                continue
            if (nx, ny) in seen:
                continue
            c = px[nx, ny][:3]
            if dist(c, seed) <= thresh:
                seen.add((nx, ny))
                q.append((nx, ny))

    for x, y in seen:
        r, g, b, _a = px[x, y]
        px[x, y] = (r, g, b, 0)

    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)

    im.save(str(OUT), optimize=True)
    print("Wrote", OUT, im.size)


if __name__ == "__main__":
    main()
