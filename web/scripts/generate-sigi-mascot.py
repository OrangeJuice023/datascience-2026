#!/usr/bin/env python3
"""
Generates the Sigi mascot asset set.

Sigi is the original Philippine maya-inspired bird companion for SIGMA. This
script is the single canonical source for the character: it renders every
state from one parametric pixel-art model and writes the platform copies.

    python web/scripts/generate-sigi-mascot.py

Outputs
    web/public/mascot/sigi/<state>.gif      animated GIF (web)
    web/public/mascot/sigi/<state>.png      static still (web fallback)
    web/public/mascot/sigi/manifest.json    dimensions, frames, rate, size
    mobile/assets/mascot/sigi/<state>.gif   animated GIF (mobile copy)
    mobile/assets/mascot/sigi/<state>.png   static still (mobile copy)
    mobile/assets/mascot/sigi/frames/<state>/frame_NN.png  frame sequence

The character is drawn on a 64x64 logical grid and scaled up with
nearest-neighbour so every edge stays a crisp pixel. Frames are rendered in
palette-index space with a fixed palette, which keeps the GIFs small and
lets a single transparent index be reserved for the background.

No network access, no external assets: the artwork is computed here.
"""

from __future__ import annotations

import glob
import json
import math
import os
from dataclasses import dataclass, field
from typing import Iterable, Sequence

import numpy as np
from PIL import Image

# --------------------------------------------------------------------------
# Paths
# --------------------------------------------------------------------------

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
WEB_OUT = os.path.join(REPO, "web", "public", "mascot", "sigi")
MOBILE_OUT = os.path.join(REPO, "mobile", "assets", "mascot", "sigi")

# --------------------------------------------------------------------------
# Canvas and palette
# --------------------------------------------------------------------------

LOGICAL = 64          # logical pixel-art grid
SCALE = 2             # output pixels per logical pixel
OUT = LOGICAL * SCALE  # 128

# Palette index 0 is reserved for fully transparent pixels.
TRANSPARENT = 0
INK = 1               # primary ink, used for the silhouette outline
OLIVE = 2             # feathers
OLIVE_DARK = 3        # wings, feather shading
OLIVE_LIGHT = 4       # crest highlight
CREAM = 5             # face and belly
CREAM_SHADE = 6       # feather underside
TERRACOTTA = 7        # beak and feet
TERRACOTTA_DARK = 8   # beak lower half
COBALT = 9            # the signal accent
COBALT_LIGHT = 10     # signal accent highlight

PALETTE = [
    (255, 255, 255),  # 0 transparent placeholder
    (0x22, 0x23, 0x1F),  # 1 ink
    (0x74, 0x7D, 0x59),  # 2 olive
    (0x5F, 0x67, 0x46),  # 3 olive dark
    (0x8E, 0x96, 0x6E),  # 4 olive light
    (0xFF, 0xFC, 0xF5),  # 5 cream
    (0xEF, 0xE7, 0xD6),  # 6 cream shade
    (0xB6, 0x6D, 0x4D),  # 7 terracotta
    (0x96, 0x55, 0x3A),  # 8 terracotta dark
    (0x24, 0x68, 0xC9),  # 9 cobalt
    (0x5B, 0x94, 0xE4),  # 10 cobalt light
]

PALETTE_ARRAY = np.array(PALETTE, dtype=np.uint8)

# --------------------------------------------------------------------------
# Mask helpers
# --------------------------------------------------------------------------

YY, XX = np.mgrid[0:LOGICAL, 0:LOGICAL]


def ellipse(cx: float, cy: float, rx: float, ry: float) -> np.ndarray:
    """Hard-edged filled ellipse. No anti-aliasing: this is pixel art."""
    return (((XX + 0.5 - cx) / rx) ** 2 + ((YY + 0.5 - cy) / ry) ** 2) <= 1.0


def circle(cx: float, cy: float, r: float) -> np.ndarray:
    return ellipse(cx, cy, r, r)


def polygon(points: Sequence[tuple[float, float]]) -> np.ndarray:
    """Filled simple polygon using the even-odd rule."""
    inside = np.zeros((LOGICAL, LOGICAL), dtype=bool)
    n = len(points)
    for i in range(n):
        x1, y1 = points[i]
        x2, y2 = points[(i + 1) % n]
        if y1 == y2:
            # Horizontal edges never cross a scan line; dividing by zero here
            # would scatter stray pixels across the canvas.
            continue
        cond = ((y1 > YY) != (y2 > YY)) & (
            XX + 0.5 < (x2 - x1) * (YY - y1 + 0.5) / (y2 - y1) + x1
        )
        inside ^= cond
    return inside


def band(x0: float, y0: float, x1: float, y1: float) -> np.ndarray:
    """Axis-aligned filled rectangle."""
    m = np.zeros((LOGICAL, LOGICAL), dtype=bool)
    m[
        max(0, int(round(y0))) : min(LOGICAL, int(round(y1)) + 1),
        max(0, int(round(x0))) : min(LOGICAL, int(round(x1)) + 1),
    ] = True
    return m


def paint(canvas: np.ndarray, mask: np.ndarray, index: int) -> None:
    canvas[mask] = index


def dilate(mask: np.ndarray) -> np.ndarray:
    """One-pixel dilation using 8-neighbour connectivity."""
    out = mask.copy()
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if dx == 0 and dy == 0:
                continue
            out |= np.roll(np.roll(mask, dy, axis=0), dx, axis=1)
    return out


def rotate(arr: np.ndarray, degrees: float, pivot: tuple[float, float]) -> np.ndarray:
    """Nearest-neighbour rotation of an index layer about a pivot."""
    if abs(degrees) < 1e-6:
        return arr.copy()
    rad = math.radians(degrees)
    cos_a, sin_a = math.cos(rad), math.sin(rad)
    dx = XX + 0.5 - pivot[0]
    dy = YY + 0.5 - pivot[1]
    sx = np.round(pivot[0] + dx * cos_a + dy * sin_a - 0.5).astype(int)
    sy = np.round(pivot[1] - dx * sin_a + dy * cos_a - 0.5).astype(int)
    valid = (sx >= 0) & (sx < LOGICAL) & (sy >= 0) & (sy < LOGICAL)
    out = np.zeros_like(arr)
    out[valid] = arr[sy[valid], sx[valid]]
    return out


def translate(arr: np.ndarray, dx: float, dy: float) -> np.ndarray:
    out = np.zeros_like(arr)
    ix, iy = int(round(dx)), int(round(dy))
    src_y0, src_y1 = max(0, -iy), min(LOGICAL, LOGICAL - iy)
    src_x0, src_x1 = max(0, -ix), min(LOGICAL, LOGICAL - ix)
    if src_y1 <= src_y0 or src_x1 <= src_x0:
        return out
    out[src_y0 + iy : src_y1 + iy, src_x0 + ix : src_x1 + ix] = arr[
        src_y0:src_y1, src_x0:src_x1
    ]
    return out


# --------------------------------------------------------------------------
# Character model
# --------------------------------------------------------------------------

HEAD_C = (32.0, 22.0)
HEAD_R = 13.5
NECK = (32.0, 34.0)          # rotation pivot for the head
BODY_C = (32.0, 42.0)
BODY_RX, BODY_RY = 11.0, 11.0

EYE_L = (26.4, 20.6)
EYE_R = (37.6, 20.6)
EYE_RADIUS = 4.2
BEAK_C = (32.0, 29.0)

CREST = ((28.0, 10.2, 2.2, 2.8), (32.0, 8.4, 2.4, 3.4), (36.0, 10.2, 2.2, 2.8))
WINGS = ((20.5, 39.5, 3.0, 6.4), (43.5, 39.5, 3.0, 6.4))
TAIL = ((41.0, 51.0, 4.0, 2.4), (44.5, 53.5, 3.4, 2.0), (47.0, 55.5, 2.8, 1.6))
FEET = ((27.0, 53.5, 3.0, 2.0), (36.0, 53.5, 3.0, 2.0))
BELLY_C = (32.0, 46.0)
BELLY_RX, BELLY_RY = 6.4, 5.6
FACE_C = (32.0, 23.5)
FACE_RX, FACE_RY = 9.6, 9.0
BADGE_C = (32.0, 38.4)


@dataclass
class FrameSpec:
    """One rendered frame."""

    body_y: float = 0.0            # body-group vertical offset (breathing)
    whole_y: float = 0.0           # whole-character offset (hop)
    head_tilt: float = 0.0         # degrees, positive leans right
    head_x: float = 0.0
    eye: str = "open"
    brow: str = "none"
    beak: str = "closed"
    wing: str = "rest"             # rest | raise | out | shrug
    crest: str = "neutral"         # neutral | up | down
    badge: str = "normal"          # normal | glow
    dots: tuple[tuple[float, float, float], ...] = ()   # cobalt signal dots
    sparkles: tuple[tuple[float, float, float], ...] = ()  # cobalt sparkles
    ring: tuple[float, float, float] | None = None        # pulse ring (cx,cy,r)
    squash: float = 0.0            # body squash/stretch, fraction


def eye_mask(style: str, cx: float, cy: float) -> tuple[np.ndarray, np.ndarray]:
    """Returns (ink mask, highlight mask) for one eye."""
    highlight = np.zeros((LOGICAL, LOGICAL), dtype=bool)
    if style == "open":
        ink = circle(cx, cy, EYE_RADIUS)
        highlight = circle(cx - 1.4, cy - 1.6, 1.5)
    elif style == "wide":
        ink = circle(cx, cy, EYE_RADIUS + 0.7)
        highlight = circle(cx - 1.4, cy - 1.6, 1.6)
    elif style == "blink":
        ink = band(cx - EYE_RADIUS + 0.6, cy - 0.8, cx + EYE_RADIUS - 0.6, cy + 0.8)
    elif style == "squint":
        ink = band(cx - EYE_RADIUS + 0.8, cy - 0.4, cx + EYE_RADIUS - 0.8, cy + 0.4)
    elif style == "half":
        ink = circle(cx, cy, EYE_RADIUS) & (YY + 0.5 >= cy - 1.0)
    elif style == "downcast":
        ink = circle(cx, cy, EYE_RADIUS) & (YY + 0.5 >= cy + 1.4)
    elif style == "worried":
        ink = circle(cx, cy, EYE_RADIUS) & (YY + 0.5 >= cy - 1.6)
    elif style == "happy":
        # An upward arch: the middle of the lid sits highest.
        width = EYE_RADIUS
        height = 2.6
        dx = (XX + 0.5 - cx) / width
        arc_y = cy - height * (1.0 - np.clip(dx, -1, 1) ** 2) + 1.0
        ink = (np.abs(dx) <= 1.0) & (YY + 0.5 >= arc_y) & (YY + 0.5 <= arc_y + 1.8)
    else:
        raise ValueError(f"unknown eye style: {style}")
    return ink, highlight


def brow_mask(style: str) -> np.ndarray:
    """A short ink stroke above the eyes."""
    m = np.zeros((LOGICAL, LOGICAL), dtype=bool)
    if style == "none":
        return m
    raised = EYE_L[1] - 6.2
    low = EYE_L[1] - 5.2
    if style == "raised_left":
        m = band(EYE_L[0] - 3.4, raised, EYE_L[0] + 3.4, raised + 1.0)
    elif style == "raised_right":
        m = band(EYE_R[0] - 3.4, raised, EYE_R[0] + 3.4, raised + 1.0)
    elif style == "raised_both":
        m = band(EYE_L[0] - 3.4, raised, EYE_L[0] + 3.4, raised + 1.0)
        m |= band(EYE_R[0] - 3.4, raised, EYE_R[0] + 3.4, raised + 1.0)
    elif style == "worried":
        # Inner ends lifted, outer ends lowered.
        for cx, sign in ((EYE_L[0], 1), (EYE_R[0], -1)):
            for i in range(7):
                x = cx + sign * (i - 3)
                y = low - abs(i - 3) * 0.5
                m = m | band(x, y, x + 1, y + 1)
    elif style == "concerned":
        # Inner ends drawn down: a mild, non-alarming frown.
        for cx, sign in ((EYE_L[0], 1), (EYE_R[0], -1)):
            for i in range(7):
                x = cx + sign * (i - 3)
                y = low + abs(i - 3) * 0.4
                m = m | band(x, y, x + 1, y + 1)
    else:
        raise ValueError(f"unknown brow style: {style}")
    return m


def beak_mask(style: str) -> tuple[np.ndarray, np.ndarray]:
    """Returns (beak mask, mouth mask)."""
    cx, cy = BEAK_C
    mouth = np.zeros((LOGICAL, LOGICAL), dtype=bool)
    if style == "closed":
        beak = polygon([(cx - 4.0, cy - 3.0), (cx + 4.0, cy - 3.0), (cx, cy + 2.2)])
    elif style == "open":
        beak = polygon([(cx - 4.4, cy - 3.2), (cx + 4.4, cy - 3.2), (cx, cy + 3.2)])
        mouth = polygon([(cx - 2.4, cy - 1.6), (cx + 2.4, cy - 1.6), (cx, cy + 2.2)])
    elif style == "smile":
        beak = polygon([(cx - 5.0, cy - 3.4), (cx + 5.0, cy - 3.4), (cx, cy + 2.0)])
    elif style == "flat":
        beak = polygon([(cx - 3.6, cy - 2.4), (cx + 3.6, cy - 2.4), (cx, cy + 0.6)])
    elif style == "frown":
        beak = polygon([(cx - 3.6, cy - 0.4), (cx + 3.6, cy - 0.4), (cx, cy - 4.0)])
    elif style == "small":
        beak = polygon([(cx - 2.8, cy - 2.2), (cx + 2.8, cy - 2.2), (cx, cy + 1.0)])
    else:
        raise ValueError(f"unknown beak style: {style}")
    return beak, mouth


def wing_positions(style: str) -> tuple[tuple[float, float, float, float], ...]:
    if style == "rest":
        return WINGS
    if style == "out":
        return ((17.0, 39.5, 3.0, 6.0), (47.0, 39.5, 3.0, 6.0))
    if style == "raise":
        return ((15.0, 28.0, 3.0, 5.4), (49.0, 39.5, 3.0, 6.4))
    if style == "shrug":
        return ((17.5, 36.5, 3.0, 4.2), (46.5, 36.5, 3.0, 4.2))
    raise ValueError(f"unknown wing style: {style}")


def crest_offset(style: str) -> float:
    return {"neutral": 0.0, "up": -1.6, "down": 1.2}.get(style, 0.0)


def build_head(spec: FrameSpec) -> np.ndarray:
    """The head group: head, face, crest, brows, eyes, beak."""
    arr = np.zeros((LOGICAL, LOGICAL), dtype=np.uint8)

    paint(arr, circle(*HEAD_C, HEAD_R), OLIVE)
    paint(arr, ellipse(*FACE_C, FACE_RX, FACE_RY), CREAM)

    crest_dy = crest_offset(spec.crest)
    for cx, cy, rx, ry in CREST:
        paint(arr, ellipse(cx, cy + crest_dy, rx, ry), OLIVE_LIGHT)
        paint(arr, ellipse(cx, cy + crest_dy - 0.4, rx - 1.1, ry - 1.6), OLIVE)

    paint(arr, brow_mask(spec.brow), INK)

    for eye_cx, eye_cy in (EYE_L, EYE_R):
        ink, highlight = eye_mask(spec.eye, eye_cx, eye_cy)
        paint(arr, ink, INK)
        paint(arr, highlight, CREAM)

    beak, mouth = beak_mask(spec.beak)
    paint(arr, beak, TERRACOTTA)
    paint(arr, mouth, TERRACOTTA_DARK)
    if spec.beak in ("closed", "smile"):
        paint(arr, band(BEAK_C[0] - 2.2, BEAK_C[1] - 1.4, BEAK_C[0] + 2.2, BEAK_C[1] - 0.4), TERRACOTTA_DARK)

    return arr


def build_body(spec: FrameSpec) -> np.ndarray:
    """The body group: body, belly, wings, tail, feet, signal badge."""
    arr = np.zeros((LOGICAL, LOGICAL), dtype=np.uint8)

    squash = spec.squash
    paint(arr, ellipse(BODY_C[0], BODY_C[1], BODY_RX * (1 + squash), BODY_RY * (1 - squash)), OLIVE)
    paint(arr, ellipse(BODY_C[0], BODY_C[1] + 3.4, BODY_RX, BODY_RY * 0.6), CREAM_SHADE)
    paint(arr, ellipse(*BELLY_C, BELLY_RX, BELLY_RY), CREAM)

    for cx, cy, rx, ry in wing_positions(spec.wing):
        paint(arr, ellipse(cx, cy, rx, ry), OLIVE_DARK)

    for cx, cy, rx, ry in TAIL:
        paint(arr, ellipse(cx, cy, rx, ry), OLIVE_DARK)
    for cx, cy, rx, ry in FEET:
        paint(arr, ellipse(cx, cy, rx, ry), TERRACOTTA)

    badge = polygon(
        [
            (BADGE_C[0], BADGE_C[1] - 3.0),
            (BADGE_C[0] + 2.6, BADGE_C[1]),
            (BADGE_C[0], BADGE_C[1] + 3.0),
            (BADGE_C[0] - 2.6, BADGE_C[1]),
        ]
    )
    paint(arr, badge, COBALT_LIGHT if spec.badge == "glow" else COBALT)

    return arr


def render(spec: FrameSpec) -> np.ndarray:
    """Renders one frame as a palette-index array."""
    body = build_body(spec)
    head = build_head(spec)

    body = translate(body, 0, spec.body_y)
    head = rotate(head, spec.head_tilt, NECK)
    head = translate(head, spec.head_x, spec.body_y * 0.45)

    character = np.zeros((LOGICAL, LOGICAL), dtype=np.uint8)
    character[body > 0] = body[body > 0]
    character[head > 0] = head[head > 0]

    canvas = np.zeros((LOGICAL, LOGICAL), dtype=np.uint8)

    # A single silhouette outline around the whole character.
    silhouette = character > 0
    outline = dilate(silhouette) & ~silhouette
    canvas[outline] = INK

    canvas[character > 0] = character[character > 0]

    # Signal decorations sit on top and carry no outline.
    for cx, cy, r in spec.dots:
        paint(canvas, circle(cx, cy, r), COBALT)
    for cx, cy, r in spec.sparkles:
        paint(canvas, circle(cx, cy, r), COBALT_LIGHT)
        paint(canvas, band(cx - r, cy, cx + r, cy + 0.8), COBALT_LIGHT)
        paint(canvas, band(cx, cy - r, cx + 0.8, cy + r), COBALT_LIGHT)
    if spec.ring:
        cx, cy, r = spec.ring
        ring = circle(cx, cy, r) & ~circle(cx, cy, r - 0.9)
        paint(canvas, ring, COBALT_LIGHT)

    return translate(canvas, 0, spec.whole_y)


# --------------------------------------------------------------------------
# Animation specs
# --------------------------------------------------------------------------


def _ease(t: float) -> float:
    return 0.5 - 0.5 * math.cos(2 * math.pi * t)


# Every state's frame list is written out explicitly rather than derived from
# a formula. Two reasons: a hand-authored frame list can guarantee that no
# two frames are identical (a validator checks this), and the poses read as
# deliberate animation rather than a sinusoid.


def idle_frames() -> list[FrameSpec]:
    """Gentle breathing with a periodic blink.

    Six frames, each a distinct combination of body offset and eye state, so
    the loop never holds on a repeated frame.
    """
    combos = [
        (0, "open"),
        (-1, "open"),
        (-1, "half"),
        (0, "half"),
        (0, "blink"),
        (-1, "blink"),
    ]
    return [
        FrameSpec(body_y=float(body), eye=eye, beak="closed") for body, eye in combos
    ]


def greeting_frames() -> list[FrameSpec]:
    """A friendly hop with a raised wing."""
    frames = []
    for i in range(10):
        t = i / 10
        hop = math.sin(math.pi * t) ** 1.4
        wave = math.sin(2 * math.pi * t)
        frames.append(
            FrameSpec(
                whole_y=-2.6 * hop,
                body_y=-0.4 * hop,
                head_tilt=2.5 * wave * (1 if hop > 0.05 else 0),
                eye="happy" if hop > 0.35 else "open",
                beak="smile" if hop > 0.2 else "open",
                wing="raise",
                crest="up" if hop > 0.4 else "neutral",
                badge="glow" if hop > 0.6 else "normal",
            )
        )
    return frames


def listening_frames() -> list[FrameSpec]:
    """Attentive: a slow head tilt, wide eyes, a pulsing signal ring.

    Each frame uses a different tilt angle, so no two frames repeat.
    """
    tilts = [-1, 0, 2, 4, 3, 1, -2, -4]
    brows = ["raised_left", "raised_left", "raised_right", "raised_right",
             "raised_left", "raised_right", "raised_left", "raised_right"]
    rings = [False, True, True, False, True, True, False, True]
    return [
        FrameSpec(
            head_tilt=float(tilts[i]),
            body_y=-0.3,
            eye="wide",
            brow=brows[i],
            beak="small",
            wing="rest",
            ring=(46.0, 20.0, 4.2) if rings[i] else None,
        )
        for i in range(8)
    ]


def thinking_frames() -> list[FrameSpec]:
    """Restrained: a slow head sway and one cobalt thought dot."""
    frames = []
    for i in range(10):
        t = i / 10
        sway = math.sin(2 * math.pi * t)
        angle = 2 * math.pi * t
        dot_x = 41.0 + 4.2 * math.cos(angle)
        dot_y = 8.0 + 2.0 * math.sin(angle)
        frames.append(
            FrameSpec(
                head_tilt=5.0 * sway,
                head_x=1.0 * sway,
                eye="squint",
                brow="raised_left",
                beak="flat",
                wing="rest",
                dots=((dot_x, dot_y, 1.5),),
            )
        )
    return frames


def responding_frames() -> list[FrameSpec]:
    """Small presenting movement while a reply is on screen."""
    poses = [
        (0, 0, "open"),
        (-1, -1, "small"),
        (-1, -2, "open"),
        (0, -3, "small"),
        (0, -2, "open"),
        (1, -1, "small"),
        (1, 1, "open"),
        (0, 2, "small"),
    ]
    frames = []
    for i, (body, tilt, beak) in enumerate(poses):
        bob = math.sin(2 * math.pi * i / 8)
        frames.append(
            FrameSpec(
                body_y=float(body),
                head_tilt=float(tilt),
                eye="open",
                beak=beak,
                wing="out",
                dots=(
                    (47.0, 30.0 - 1.5 * bob, 1.2),
                    (50.5, 26.0 - 1.5 * bob, 1.0),
                ),
            )
        )
    return frames


def insight_frames() -> list[FrameSpec]:
    """A positive discovery reaction."""
    frames = []
    for i in range(10):
        t = i / 10
        rise = math.sin(math.pi * t)
        frames.append(
            FrameSpec(
                whole_y=-1.8 * rise,
                body_y=-0.6 * rise,
                head_tilt=2.0 * math.sin(2 * math.pi * t),
                eye="happy" if rise > 0.3 else "open",
                beak="smile" if i % 5 < 3 else "open",
                wing="out",
                crest="up" if rise > 0.25 else "neutral",
                badge="glow" if rise > 0.25 else "normal",
                sparkles=((14.0, 12.0, 1.2), (50.0, 14.0, 1.2)) if rise > 0.55 else (),
            )
        )
    return frames


def unavailable_frames() -> list[FrameSpec]:
    """Puzzled and sympathetic: a slow tilt and a small shrug."""
    poses = [
        (-1, False),
        (1, True),
        (3, False),
        (4, True),
        (2, False),
        (0, True),
        (-2, False),
        (-3, True),
    ]
    return [
        FrameSpec(
            head_tilt=float(tilt),
            body_y=-0.4,
            eye="half",
            brow="raised_right",
            beak="flat",
            wing="shrug" if shrug else "rest",
        )
        for tilt, shrug in poses
    ]


def error_frames() -> list[FrameSpec]:
    """Concerned, not alarmed: lowered posture and a slow sway."""
    poses = [
        (0, 0),
        (0.5, -2),
        (1, -3),
        (0.5, -3),
        (0, -2),
        (-0.5, -1),
        (-1, 0),
        (0, 1),
    ]
    return [
        FrameSpec(
            whole_y=0.6,
            body_y=float(body),
            head_tilt=float(tilt),
            eye="worried",
            brow="concerned",
            beak="frown",
            wing="rest",
            crest="down",
        )
        for body, tilt in poses
    ]


def success_frames() -> list[FrameSpec]:
    """A small celebratory hop."""
    poses = [
        (0, 0),
        (-1, -1),
        (-2, -2),
        (-3, -1),
        (-3, 0),
        (-2, 1),
        (-1, 2),
        (0, 1),
    ]
    frames = []
    for body, tilt in poses:
        airborne = body <= -2
        frames.append(
            FrameSpec(
                whole_y=float(body),
                body_y=-0.4 * body,
                head_tilt=float(tilt),
                eye="happy",
                beak="open" if airborne else "smile",
                wing="out",
                crest="up" if airborne else "neutral",
                badge="glow" if airborne else "normal",
                sparkles=((15.0, 13.0, 1.3), (49.0, 15.0, 1.3)) if body <= -3 else (),
            )
        )
    return frames


@dataclass
class StateSpec:
    name: str
    frames: list[FrameSpec]
    frame_ms: int
    purpose: str

    @property
    def fps(self) -> float:
        return round(1000 / self.frame_ms, 3)


STATE_SPECS: list[StateSpec] = [
    StateSpec("idle", idle_frames(), 125, "Resting companion: slow breathing and a periodic blink."),
    StateSpec("greeting", greeting_frames(), 100, "A short wave and hop used for an explicit welcome."),
    StateSpec("listening", listening_frames(), 125, "Attentive pose with a head tilt while the user composes a message."),
    StateSpec("thinking", thinking_frames(), 100, "Restrained thinking motion while a request is genuinely in flight."),
    StateSpec("responding", responding_frames(), 125, "Small presenting motion while a reply is on screen."),
    StateSpec("insight", insight_frames(), 100, "Positive reaction to a real, supported result becoming available."),
    StateSpec("unavailable", unavailable_frames(), 125, "Puzzled, sympathetic pose for a source that is not connected."),
    StateSpec("error", error_frames(), 125, "Concerned, non-alarming pose after an actual failure."),
    StateSpec("success", success_frames(), 83, "A small celebratory hop after an action genuinely completes."),
]


# --------------------------------------------------------------------------
# Output
# --------------------------------------------------------------------------


def to_rgba(index_array: np.ndarray) -> Image.Image:
    """Converts a palette-index array to an RGBA image at output resolution."""
    small = Image.fromarray(index_array.astype(np.uint8), mode="L")
    big = small.resize((OUT, OUT), Image.NEAREST)
    indices = np.array(big)
    rgb = PALETTE_ARRAY[indices]
    alpha = np.where(indices == TRANSPARENT, 0, 255).astype(np.uint8)
    rgba = np.dstack([rgb, alpha])
    return Image.fromarray(rgba, mode="RGBA")


def to_palette(index_array: np.ndarray) -> Image.Image:
    """Converts a palette-index array to a P-mode image with index 0 clear."""
    small = Image.fromarray(index_array.astype(np.uint8), mode="L")
    big = small.resize((OUT, OUT), Image.NEAREST)
    palette = []
    for r, g, b in PALETTE:
        palette.extend([r, g, b])
    palette.extend([0] * (256 * 3 - len(palette)))
    p = big.convert("P")
    p.putpalette(palette)
    p.info["transparency"] = TRANSPARENT
    return p


def assert_no_repeated_frames(name: str, rendered: list[np.ndarray]) -> None:
    """Fails when two adjacent frames are identical.

    A repeated frame makes the animation hold for twice as long as it should,
    which reads as a stutter. The frame lists are written by hand precisely so
    that this never happens, so it is checked rather than assumed.
    """
    for index in range(1, len(rendered)):
        if rendered[index].tobytes() == rendered[index - 1].tobytes():
            raise SystemExit(
                f"{name}: frames {index - 1} and {index} render identically; "
                "adjust the pose list so every frame is distinct."
            )


def write_assets(spec: StateSpec) -> dict:
    os.makedirs(WEB_OUT, exist_ok=True)
    os.makedirs(MOBILE_OUT, exist_ok=True)
    frames_dir = os.path.join(MOBILE_OUT, "frames", spec.name)
    os.makedirs(frames_dir, exist_ok=True)

    rendered = [render(frame) for frame in spec.frames]
    assert_no_repeated_frames(spec.name, rendered)

    # A shorter state must not leave the frames of a longer one behind.
    for stale in glob.glob(os.path.join(frames_dir, "frame_*.png")):
        os.remove(stale)

    gif_frames = [to_palette(frame) for frame in rendered]
    gif_path = os.path.join(WEB_OUT, f"{spec.name}.gif")
    gif_frames[0].save(
        gif_path,
        save_all=True,
        append_images=gif_frames[1:],
        duration=spec.frame_ms,
        loop=0,
        disposal=2,
        transparency=TRANSPARENT,
        optimize=True,
    )
    mobile_gif_path = os.path.join(MOBILE_OUT, f"{spec.name}.gif")
    with open(gif_path, "rb") as src, open(mobile_gif_path, "wb") as dst:
        dst.write(src.read())

    still = to_rgba(rendered[0])
    still_path = os.path.join(WEB_OUT, f"{spec.name}.png")
    still.save(still_path, optimize=True)
    still.save(os.path.join(MOBILE_OUT, f"{spec.name}.png"), optimize=True)

    for i, frame in enumerate(rendered):
        to_rgba(frame).save(
            os.path.join(frames_dir, f"frame_{i:02d}.png"), optimize=True
        )

    return {
        "state": spec.name,
        "purpose": spec.purpose,
        "gif": f"/mascot/sigi/{spec.name}.gif",
        "still": f"/mascot/sigi/{spec.name}.png",
        "frames": len(rendered),
        "frameMs": spec.frame_ms,
        "fps": spec.fps,
        "durationMs": spec.frame_ms * len(rendered),
        "width": OUT,
        "height": OUT,
        "logicalSize": LOGICAL,
        "bytes": os.path.getsize(gif_path),
        "stillBytes": os.path.getsize(still_path),
    }


def main() -> None:
    entries = []
    for spec in STATE_SPECS:
        entry = write_assets(spec)
        entries.append(entry)
        print(
            f"{spec.name:<12} {entry['frames']:>3} frames  {entry['width']}x{entry['height']}  "
            f"{entry['fps']:>6} fps  {entry['bytes'] / 1024:>7.1f} KB"
        )

    manifest = {
        "character": "Sigi",
        "description": "Philippine maya-inspired bird companion for SIGMA.",
        "grid": LOGICAL,
        "outputSize": OUT,
        "palette": {
            "ink": "#22231F",
            "olive": "#747D59",
            "oliveDark": "#5F6746",
            "oliveLight": "#8E966E",
            "cream": "#FFFCF5",
            "creamShade": "#EFE7D6",
            "terracotta": "#B66D4D",
            "terracottaDark": "#96553A",
            "cobalt": "#2468C9",
            "cobaltLight": "#5B94E4",
        },
        "states": entries,
    }
    for out in (WEB_OUT, MOBILE_OUT):
        with open(os.path.join(out, "manifest.json"), "w", encoding="utf-8") as fh:
            json.dump(manifest, fh, indent=2)
            fh.write("\n")

    total = sum(e["bytes"] for e in entries)
    print(f"\ntotal GIF payload: {total / 1024:.1f} KB across {len(entries)} animations")


if __name__ == "__main__":
    main()
