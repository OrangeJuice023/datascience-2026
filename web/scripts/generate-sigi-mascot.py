#!/usr/bin/env python3
"""
Generates the Sigi mascot asset set from the official character sheet.

Sigi is SIGMA's Philippine maya-inspired companion. The canonical artwork is
the character sheet in docs/brand/sigi-mascot-guide.png: one pose per state
under "Expressions & states". This script cuts each pose out of the sheet
(no redrawing, no resampling) and animates it with whole-sprite motion only:

- the body bobs, hops or shakes by a few pixels;
- the state's effect marks (sparks, bulb, bubbles, "zzz") are separate
  pieces of the sheet, so they pulse, float or build up on their own;
- idle and listening blink: the eyes are found in the artwork and closed
  for one frame.

    python web/scripts/generate-sigi-mascot.py

Outputs
    web/public/mascot/sigi/<state>.gif      animated GIF (web)
    web/public/mascot/sigi/<state>.png      static still (web, reduced motion)
    web/public/mascot/sigi/manifest.json    dimensions, frames, rate, size
    mobile/assets/mascot/sigi/<state>.gif   animated GIF (mobile copy)
    mobile/assets/mascot/sigi/manifest.json
    mobile/assets/mascot/sigi/frames/<state>/frame_NN.png  frame sequence;
        frame_00 is the mobile still for reduced motion

No network access. The sheet is hash-checked so a changed sheet is noticed
rather than silently re-cut with boxes that no longer fit it.
"""

from __future__ import annotations

import glob
import hashlib
import json
import os
import shutil
import time
from collections import deque
from dataclasses import dataclass

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
SHEET = os.path.join(REPO, "docs", "brand", "sigi-mascot-guide.png")
SHEET_SHA256 = "fd4b8188869a106acc983531afbed11c59acb1e6e21994ea91b76b06253eb27f"
WEB_OUT = os.path.join(REPO, "web", "public", "mascot", "sigi")
MOBILE_OUT = os.path.join(REPO, "mobile", "assets", "mascot", "sigi")

OUT = 160        # square canvas; the largest pose is 142 x 137
BASELINE = 154   # feet rest on this row, leaving room to hop

PALETTE = {
    "leafGreen": "#747D59",
    "warmBrown": "#B66D4D",
    "sandCream": "#F4F0E6",
    "cobaltBlue": "#2468C9",
    "ink": "#22231F",
}


@dataclass(frozen=True)
class State:
    name: str
    purpose: str
    # Box around the pose on the sheet (x0, y0, x1, y1), above its label.
    box: tuple[int, int, int, int]
    frame_ms: int
    # Per frame: (dx, dy) body offset, which effect pieces show, blink.
    body: tuple[tuple[int, int], ...]
    effects: str = "all"   # all | pulse | build | float
    blink_at: int | None = None


STATES = [
    State("idle", "Resting companion: slow breathing and a periodic blink.",
          (18, 436, 160, 578), 140,
          ((0, 0), (0, -1), (0, -2), (0, -1), (0, 0), (0, -1), (0, -2), (0, -1)), blink_at=5),
    State("greeting", "A wave and a little hop used for an explicit welcome.",
          (172, 436, 325, 578), 100,
          ((0, 0), (0, -3), (0, -6), (0, -3), (0, 0), (0, -1), (0, -3), (0, -6), (0, -3), (0, -1)),
          effects="pulse"),
    State("listening", "Attentive pose while the user composes a message.",
          (325, 436, 480, 578), 140,
          ((0, 0), (0, -1), (0, -1), (0, 0), (0, -1), (0, -2), (0, -1), (0, 0)),
          effects="float", blink_at=6),
    State("thinking", "Working on a request: thought bubbles build up.",
          (488, 436, 632, 578), 120,
          ((0, 0), (0, -1), (0, 0), (0, -1), (0, 0), (0, -1), (0, 0), (0, -1), (0, 0), (0, -1)),
          effects="build"),
    State("responding", "Writing a reply at the laptop.",
          (636, 436, 795, 578), 110,
          ((0, 0), (0, -1), (0, 0), (0, -2), (0, 0), (0, -1), (0, 0), (0, -2)), effects="pulse"),
    State("insight", "A result came back: the idea bulb glows.",
          (10, 632, 165, 778), 110,
          ((0, 0), (0, -2), (0, -4), (0, -2), (0, 0), (0, -1), (0, 0), (0, -1), (0, 0), (0, -1)),
          effects="pulse"),
    State("unavailable", "Not connected to a source: a puzzled scribble.",
          (166, 632, 318, 778), 160,
          ((0, 0), (0, -1), (0, -1), (0, 0), (0, -1), (0, -2), (0, -1), (0, 0)), effects="float"),
    State("error", "Reporting a failure with a short startled shake.",
          (322, 632, 475, 778), 100,
          ((0, 0), (2, 0), (-2, 0), (2, 0), (-2, 0), (0, 0), (0, -1), (0, -2)), effects="pulse"),
    State("success", "Reporting a completed action with a happy jump.",
          (482, 632, 640, 778), 100,
          ((0, 0), (0, -4), (0, -8), (0, -4), (0, 0), (0, -1), (0, -4), (0, -8), (0, -4), (0, -1)),
          effects="pulse"),
    State("sleepy", "Dozing while nothing is happening; the z's drift up.",
          (642, 632, 800, 778), 220,
          ((0, 0), (0, -1), (0, -1), (0, 0), (0, -1), (0, 0), (0, -1), (0, 0)), effects="build"),
]


# --------------------------------------------------------------------------
# Cutting a pose out of the sheet
# --------------------------------------------------------------------------

def is_paper(px: np.ndarray) -> np.ndarray:
    """Light, unsaturated pixels: the sheet's paper and the poses' paper halo."""
    r, g, b = (px[..., i].astype(int) for i in range(3))
    lum = (r * 299 + g * 587 + b * 114) // 1000
    sat = px.max(axis=-1).astype(int) - px.min(axis=-1).astype(int)
    return (lum > 196) & (sat < 48)


def components(mask: np.ndarray) -> list[np.ndarray]:
    """8-connected components of a mask, as arrays of (y, x)."""
    h, w = mask.shape
    seen = np.zeros_like(mask)
    parts = []
    for sy, sx in zip(*np.nonzero(mask)):
        if seen[sy, sx]:
            continue
        seen[sy, sx] = True
        stack, pts = [(sy, sx)], []
        while stack:
            y, x = stack.pop()
            pts.append((y, x))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        stack.append((ny, nx))
        parts.append(np.array(pts))
    return parts


def cut(sheet: np.ndarray, box: tuple[int, int, int, int]) -> np.ndarray:
    """RGBA pose with the paper removed, cropped to its bounding box."""
    x0, y0, x1, y1 = box
    crop = sheet[y0:y1, x0:x1]
    h, w, _ = crop.shape
    paper = is_paper(crop)
    bg = np.zeros((h, w), bool)
    q = deque([(y, x) for y in range(h) for x in (0, w - 1)] + [(y, x) for x in range(w) for y in (0, h - 1)])
    while q:
        y, x = q.popleft()
        if bg[y, x] or not paper[y, x]:
            continue
        bg[y, x] = True
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < h and 0 <= nx < w and not bg[ny, nx]:
                q.append((ny, nx))
    fg = ~bg
    for part in components(fg):
        if len(part) < 24:  # paper texture specks
            fg[part[:, 0], part[:, 1]] = False
    rgba = np.dstack([crop, np.where(fg, 255, 0).astype(np.uint8)])
    ys, xs = np.nonzero(fg)
    return rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def split(pose: np.ndarray) -> tuple[np.ndarray, list[np.ndarray]]:
    """The body (largest piece) and the effect marks, each as a full-size RGBA layer."""
    parts = sorted(components(pose[..., 3] > 0), key=len, reverse=True)
    layers = []
    for part in parts:
        layer = np.zeros_like(pose)
        layer[part[:, 0], part[:, 1]] = pose[part[:, 0], part[:, 1]]
        layers.append(layer)
    return layers[0], layers[1:]


def closed_eyes(body: np.ndarray) -> np.ndarray:
    """The body with its eyes closed: each eye becomes a short dark line.

    Eyes are solid near-black, roughly round blobs away from the silhouette's
    outline. Shrinking the dark mask by two pixels removes thin outlines (the
    beak's, the wing's) and keeps only the eye cores; each core is then grown
    back to cover the eye and its soft edge.
    """
    rgb = body[..., :3].astype(int)
    lum = (rgb[..., 0] * 299 + rgb[..., 1] * 587 + rgb[..., 2] * 114) // 1000
    opaque = body[..., 3] > 0
    edge = np.zeros_like(opaque)
    edge[1:-1, 1:-1] = ~(opaque[:-2, 1:-1] & opaque[2:, 1:-1] & opaque[1:-1, :-2] & opaque[1:-1, 2:])
    core = opaque & (lum < 45)
    for _ in range(2):
        core = core & np.roll(core, 1, 0) & np.roll(core, -1, 0) & np.roll(core, 1, 1) & np.roll(core, -1, 1)
    ink = np.array([int(PALETTE["ink"][i:i + 2], 16) for i in (1, 3, 5)], np.uint8)
    out = body.copy()
    for seed in components(core):
        if len(seed) < 12:
            continue
        grown = np.zeros_like(opaque)
        grown[seed[:, 0], seed[:, 1]] = True
        for _ in range(4):
            grown = grown | np.roll(grown, 1, 0) | np.roll(grown, -1, 0) | np.roll(grown, 1, 1) | np.roll(grown, -1, 1)
        part = np.argwhere(grown & opaque & (lum < 150))
        if edge[part[:, 0], part[:, 1]].any():
            continue  # touches the silhouette: not an eye
        ya, xa = part.min(axis=0)
        yb, xb = part.max(axis=0)
        if (yb - ya) > 1.6 * (xb - xa) or (xb - xa) > 1.6 * (yb - ya):
            continue  # not eye-shaped
        # Face colour from a ring around the eye, painted over the eye and its highlight.
        ring = body[max(ya - 4, 0):yb + 5, max(xa - 4, 0):xb + 5]
        lit = ring[(ring[..., 3] > 0) & (ring[..., :3].astype(int).sum(axis=-1) > 450)]
        if not len(lit):
            continue
        skin = np.median(lit[:, :3], axis=0).astype(np.uint8)
        # The eye is its dark pixels plus the highlight inside them: fill each
        # row between its leftmost and rightmost dark pixel.
        for y in range(ya, yb + 1):
            xs = part[part[:, 0] == y, 1]
            if len(xs):
                out[y, xs.min():xs.max() + 1, :3] = skin
        mid = (ya + yb) // 2 + 1
        out[mid:mid + 2, xa + 1:xb, :3] = ink
    return out


# --------------------------------------------------------------------------
# Frames
# --------------------------------------------------------------------------

def effect_layers(effects: list[np.ndarray], mode: str, i: int, n: int) -> list[tuple[np.ndarray, int]]:
    """Which effect pieces show on frame i, with a vertical offset each."""
    if not effects:
        return []
    if mode == "all":
        return [(e, 0) for e in effects]
    if mode == "pulse":  # marks flash on and off
        return [(e, 0) for e in effects] if i % 4 < 3 else []
    if mode == "float":  # marks drift up and back
        return [(e, (0, -1, -2, -1)[i % 4]) for e in effects]
    # build: pieces appear one by one, smallest (or lowest) first, then all hold
    order = sorted(effects, key=lambda e: int((e[..., 3] > 0).sum()))
    shown = min(len(order), 1 + i * len(order) // max(1, n - 3))
    return [(e, 0) for e in order[:shown]]


def compose(layer: np.ndarray, dx: int, dy: int) -> Image.Image:
    canvas = Image.new("RGBA", (OUT, OUT), (0, 0, 0, 0))
    h, w = layer.shape[:2]
    canvas.alpha_composite(Image.fromarray(layer, "RGBA"), ((OUT - w) // 2 + dx, BASELINE - h + dy))
    return canvas


def frames_for(state: State, sheet: np.ndarray) -> list[Image.Image]:
    body, effects = split(cut(sheet, state.box))
    blink = closed_eyes(body) if state.blink_at is not None else None
    n = len(state.body)
    frames = []
    for i, (dx, dy) in enumerate(state.body):
        frame = compose(blink if i == state.blink_at else body, dx, dy)
        for layer, ey in effect_layers(effects, state.effects, i, n):
            frame.alpha_composite(compose(layer, dx, dy + ey))
        frames.append(frame)
    return frames


def write_gif(frames: list[Image.Image], path: str, frame_ms: int) -> None:
    """One shared 255-colour palette; index 255 is transparent."""
    fill = np.array(frames[0])[..., :3][np.array(frames[0])[..., 3] > 0][0]
    strip = Image.new("RGB", (OUT, OUT * len(frames)), tuple(int(v) for v in fill))
    for k, f in enumerate(frames):
        strip.paste(f.convert("RGB"), (0, OUT * k), f)
    palette = strip.quantize(255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    pal = palette.getpalette()[: 255 * 3] + [0, 0, 0]
    out = []
    for f in frames:
        idx = np.array(f.convert("RGB").quantize(palette=palette, dither=Image.Dither.NONE))
        idx[np.array(f)[..., 3] < 128] = 255
        p = Image.fromarray(idx.astype(np.uint8), "P")
        p.putpalette(pal)
        out.append(p)
    out[0].save(path, save_all=True, append_images=out[1:], duration=frame_ms, loop=0,
                transparency=255, disposal=2, optimize=False)


def retry(action, *args, **kwargs):
    """Windows can briefly lock a just-written file (indexer, antivirus, editor watcher)."""
    for attempt in range(10):
        try:
            return action(*args, **kwargs)
        except OSError:
            if attempt == 9:
                raise
            time.sleep(0.3)


def main() -> None:
    digest = hashlib.sha256(open(SHEET, "rb").read()).hexdigest()
    if digest != SHEET_SHA256:
        raise SystemExit(f"{SHEET} changed (sha256 {digest}); re-check the pose boxes before updating the hash")
    sheet = np.array(Image.open(SHEET).convert("RGB"))

    os.makedirs(WEB_OUT, exist_ok=True)
    os.makedirs(MOBILE_OUT, exist_ok=True)

    entries = []
    for state in STATES:
        frames = frames_for(state, sheet)
        gif = os.path.join(WEB_OUT, f"{state.name}.gif")
        still = os.path.join(WEB_OUT, f"{state.name}.png")
        retry(write_gif, frames, gif, state.frame_ms)
        retry(frames[0].save, still, optimize=True)
        retry(shutil.copyfile, gif, os.path.join(MOBILE_OUT, f"{state.name}.gif"))
        frame_dir = os.path.join(MOBILE_OUT, "frames", state.name)
        os.makedirs(frame_dir, exist_ok=True)
        for k, f in enumerate(frames):
            retry(f.save, os.path.join(frame_dir, f"frame_{k:02d}.png"), optimize=True)
        for stale in glob.glob(os.path.join(frame_dir, "frame_*.png")):
            if int(os.path.basename(stale)[6:8]) >= len(frames):
                retry(os.remove, stale)
        entries.append({
            "state": state.name,
            "purpose": state.purpose,
            "gif": f"/mascot/sigi/{state.name}.gif",
            "still": f"/mascot/sigi/{state.name}.png",
            "frames": len(frames),
            "frameMs": state.frame_ms,
            "fps": round(1000 / state.frame_ms, 1),
            "durationMs": state.frame_ms * len(frames),
            "width": OUT,
            "height": OUT,
            "bytes": os.path.getsize(gif),
            "stillBytes": os.path.getsize(still),
        })
        print(f"{state.name:12s} {len(frames):2d} frames  {os.path.getsize(gif):6d} B")

    manifest = {
        "character": "Sigi",
        "description": "Philippine maya-inspired bird companion for SIGMA.",
        "source": "docs/brand/sigi-mascot-guide.png",
        "sourceSha256": SHEET_SHA256,
        "outputSize": OUT,
        "palette": PALETTE,
        "states": entries,
    }
    for folder in (WEB_OUT, MOBILE_OUT):
        with open(os.path.join(folder, "manifest.json"), "w", encoding="utf-8") as fh:
            json.dump(manifest, fh, indent=2)
            fh.write("\n")


if __name__ == "__main__":
    main()
