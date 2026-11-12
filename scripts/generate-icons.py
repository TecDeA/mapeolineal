"""Genera el juego de iconos de la PWA de Mapeo Lineal.

Dibuja el mismo glifo que el encabezado de la aplicación (dos flechas
opuestas: origen en índigo, destino en esmeralda) sobre un fondo degradado.

Uso:  python ./scripts/generate-icons.py
Salida: ./icons/*.png
"""

from __future__ import annotations

import os
from PIL import Image, ImageDraw

SUPERSAMPLE = 1024
BACKGROUND_TOP = (99, 102, 241)      # indigo-500
BACKGROUND_BOTTOM = (67, 56, 202)    # indigo-700
ARROW_ORIGIN = (255, 255, 255)
ARROW_TARGET = (167, 243, 208)       # emerald-200
ICONS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icons")


def gradient_background(size: int) -> Image.Image:
    """Degradado vertical suave entre dos colores de marca."""
    strip = Image.new("RGB", (1, size))
    pixels = strip.load()
    for y in range(size):
        t = y / max(1, size - 1)
        # curva suave para que la zona superior no quede plana
        t = t ** 1.15
        pixels[0, y] = tuple(
            round(BACKGROUND_TOP[i] + (BACKGROUND_BOTTOM[i] - BACKGROUND_TOP[i]) * t)
            for i in range(3)
        )
    return strip.resize((size, size), Image.BICUBIC).convert("RGBA")


def draw_glyph(image: Image.Image, scale: float = 1.0, stroke: float = 2.1) -> None:
    """Dibuja las dos flechas en un sistema de coordenadas de 24x24."""
    draw = ImageDraw.Draw(image)
    size = image.width
    unit = size / 24.0 * scale
    center = size / 2.0

    def point(x: float, y: float) -> tuple[float, float]:
        return (center + (x - 12.0) * unit, center + (y - 12.0) * unit)

    width = max(2, round(stroke * unit))
    radius = width / 2.0

    def polyline(points, color):
        coords = [point(x, y) for x, y in points]
        draw.line(coords, fill=color, width=width, joint="curve")
        for x, y in coords:
            draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=color)

    # Flecha superior: recorre de izquierda a derecha (intervalo origen)
    polyline([(6.6, 7.0), (16.4, 7.0)], ARROW_ORIGIN)
    polyline([(13.0, 3.6), (17.4, 7.0), (13.0, 10.4)], ARROW_ORIGIN)

    # Flecha inferior: recorre de derecha a izquierda (intervalo destino)
    polyline([(17.4, 17.0), (7.6, 17.0)], ARROW_TARGET)
    polyline([(11.0, 13.6), (6.6, 17.0), (11.0, 20.4)], ARROW_TARGET)


def build_icon(size: int, *, rounded: bool, glyph_scale: float, stroke: float = 2.1) -> Image.Image:
    canvas = Image.new("RGBA", (SUPERSAMPLE, SUPERSAMPLE), (0, 0, 0, 0))
    background = gradient_background(SUPERSAMPLE)

    if rounded:
        mask = Image.new("L", (SUPERSAMPLE, SUPERSAMPLE), 0)
        ImageDraw.Draw(mask).rounded_rectangle(
            (0, 0, SUPERSAMPLE - 1, SUPERSAMPLE - 1),
            radius=int(SUPERSAMPLE * 0.215),
            fill=255,
        )
        canvas.paste(background, (0, 0), mask)
    else:
        canvas.paste(background, (0, 0))

    draw_glyph(canvas, scale=glyph_scale, stroke=stroke)
    return canvas.resize((size, size), Image.LANCZOS)


def main() -> None:
    os.makedirs(ICONS_DIR, exist_ok=True)

    jobs = [
        # (archivo, tamaño, redondeado, escala del glifo, grosor)
        ("icon-192.png", 192, True, 0.98, 2.15),
        ("icon-512.png", 512, True, 0.98, 2.15),
        ("icon-maskable-192.png", 192, False, 0.86, 2.3),
        ("icon-maskable-512.png", 512, False, 0.86, 2.3),
        ("apple-touch-icon-180.png", 180, False, 0.98, 2.2),
        ("favicon-32.png", 32, True, 1.05, 2.5),
        ("favicon-16.png", 16, True, 1.08, 2.7),
    ]

    for filename, size, rounded, scale, stroke in jobs:
        icon = build_icon(size, rounded=rounded, glyph_scale=scale, stroke=stroke)
        path = os.path.join(ICONS_DIR, filename)
        icon.save(path, format="PNG", optimize=True)
        print(f"{filename:28} {size:>4}x{size:<4} {os.path.getsize(path):>6} bytes")


if __name__ == "__main__":
    main()
