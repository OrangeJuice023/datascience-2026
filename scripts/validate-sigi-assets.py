"""Validates the Sigi asset set: frames, distinctness, parity, dimensions."""

import glob
import hashlib
import json
import os

from PIL import Image, ImageSequence

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB = os.path.join(REPO, "web", "public", "mascot", "sigi")
MOBILE = os.path.join(REPO, "mobile", "assets", "mascot", "sigi")

manifest = json.load(open(os.path.join(WEB, "manifest.json"), encoding="utf-8"))
print("state        frames  distinct  size      web==mobile  disk frames  status")
ok = True
for state in manifest["states"]:
    name = state["state"]
    web_gif = os.path.join(WEB, name + ".gif")
    mobile_gif = os.path.join(MOBILE, name + ".gif")
    web_png = os.path.join(WEB, name + ".png")
    frames_dir = os.path.join(MOBILE, "frames", name)
    # Mobile's reduced-motion still is the first frame of the sequence.
    mobile_png = os.path.join(frames_dir, "frame_00.png")

    image = Image.open(web_gif)
    rendered = [f.convert("RGBA").tobytes() for f in ImageSequence.Iterator(image)]
    distinct = len(set(rendered))
    adjacent_repeats = [i for i in range(1, len(rendered)) if rendered[i] == rendered[i - 1]]
    still = Image.open(web_png)
    on_disk = len(os.listdir(frames_dir)) if os.path.isdir(frames_dir) else 0
    same_gif = hashlib.md5(open(web_gif, "rb").read()).hexdigest() == hashlib.md5(open(mobile_gif, "rb").read()).hexdigest()
    same_png = Image.open(web_png).convert("RGBA").tobytes() == Image.open(mobile_png).convert("RGBA").tobytes()

    good = (
        len(rendered) == state["frames"]
        and distinct >= 3
        and not adjacent_repeats
        and image.size == (state["width"], state["height"])
        and still.size == (state["width"], state["height"])
        and on_disk == state["frames"]
        and same_gif
        and same_png
    )
    ok = ok and good
    print(
        f"{name:12s} {len(rendered):3d}     {distinct:3d}       {image.size[0]}x{image.size[1]}     "
        f"{str(same_gif):5s}       {on_disk:3d}          {'OK' if good else 'MISMATCH'}"
    )

print("ALL STATES VALID" if ok else "PROBLEMS FOUND")
print("web payload:", sum(os.path.getsize(p) for p in glob.glob(os.path.join(WEB, "*"))), "bytes")
print("mobile payload:", sum(os.path.getsize(p) for p in glob.glob(os.path.join(MOBILE, "*"))), "bytes")
