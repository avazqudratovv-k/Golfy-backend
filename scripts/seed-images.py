"""Generates the demo venue images (illustrated golf scenes) into uploads/venues/seed/.
Deterministic: the same venue slug + index always produces the same picture.
Usage: python3 scripts/seed-images.py <slug>:<TYPE> ...   (TYPE = COURSE | RANGE | SIMULATOR)
"""
import math, os, random, sys
from PIL import Image, ImageDraw, ImageFilter

W, H, SS = 1600, 1067, 2  # output size, supersampling factor
OUT = os.path.join(os.getcwd(), "uploads", "venues", "seed")

def mix(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))
def hexc(h): h = h.lstrip("#"); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

# (sky top, sky horizon, sun colour, hill far, hill near, fairway light, fairway dark, tree)
PALETTES = [
    ("#7FA6C9", "#F7D9A8", "#FFE9B8", "#8DA8A0", "#5F8A6B", "#7DB05A", "#5E9A4A", "#2F5E3A"),  # golden hour
    ("#F2B48A", "#FBE1B6", "#FFF0CF", "#A9A3A0", "#7C9A7A", "#8DB865", "#6BA255", "#355F3C"),  # sunrise
    ("#5E95C8", "#C9E2F2", "#FFFFFF", "#8CB0B8", "#5E9272", "#76B253", "#559A45", "#2B5A38"),  # clear day
    ("#44547A", "#F0956A", "#FFD2A0", "#6D6F8A", "#4A6A5C", "#5F9456", "#467A47", "#22452F"),  # dusk
    ("#9DB7C6", "#E7E3D2", "#FFF7E0", "#9DB0A8", "#6E9478", "#82AE62", "#5F9650", "#2F5B3B"),  # soft haze
]

def gradient(d, w, h, top, bot, y1):
    for y in range(y1):
        d.line([(0, y), (w, y)], fill=mix(top, bot, y / max(1, y1)))

def glow(img, cx, cy, r, color, strength=0.55):
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    for i in range(12, 0, -1):
        ld.ellipse([cx - r * i / 3, cy - r * i / 3, cx + r * i / 3, cy + r * i / 3], fill=color + (int(255 * strength / 12),))
    img.alpha_composite(layer)

def hills(d, w, y, amp, color, rnd, step=40):
    ph, f = rnd.uniform(0, 6), rnd.uniform(0.8, 2.2)
    pts = [(0, y + 400)]
    for x in range(0, w + step, step):
        pts.append((x, y - amp * (0.55 + 0.45 * math.sin(x / w * f * math.pi * 2 + ph)) - amp * 0.2 * math.sin(x / w * 9 + ph * 2)))
    pts.append((w, y + 400))
    d.polygon(pts, fill=color)

def tree(d, x, y, s, col):
    d.rectangle([x - s * .05, y - s * .3, x + s * .05, y], fill=mix(col, (40, 28, 20), .6))
    for dx, dy, r in [(0, -.7, .38), (-.22, -.5, .3), (.22, -.5, .3), (0, -.42, .34)]:
        d.ellipse([x + dx * s - r * s, y + dy * s - r * s, x + dx * s + r * s, y + dy * s + r * s], fill=mix(col, (255, 255, 255), .05 * (dy + .8)))

def flag(d, x, y, s, color="#E8743B"):
    d.line([(x, y), (x, y - s)], fill=(250, 250, 245), width=max(2, int(s / 40)))
    d.polygon([(x, y - s), (x + s * .38, y - s * .86), (x, y - s * .72)], fill=hexc(color))

def finish(img, rnd, vignette=.28, grain=7):
    img = img.convert("RGB").resize((W, H), Image.LANCZOS)
    px = img.load()
    cx, cy = W / 2, H / 2
    noise = Image.effect_noise((W, H), grain).convert("L")
    img = Image.blend(img, Image.merge("RGB", (noise, noise, noise)), 0.025)
    mask = Image.new("L", (W, H), 0)
    md = ImageDraw.Draw(mask)
    for i in range(30):
        md.ellipse([-W * .25 + i * 14, -H * .25 + i * 10, W * 1.25 - i * 14, H * 1.25 - i * 10], fill=int(255 * vignette * (i / 30)) if False else 0)
    # radial vignette
    v = Image.radial_gradient("L").resize((W, H))
    img = Image.composite(img, Image.new("RGB", (W, H), (12, 24, 18)), Image.eval(v, lambda p: 255 - int(p * vignette)).point(lambda p: 255 if p > 255 else p) if False else Image.eval(v, lambda p: 255 - int(p * vignette)))
    return img

def course(rnd, variant):
    w, h = W * SS, H * SS
    pal = [hexc(c) for c in PALETTES[variant % len(PALETTES)]]
    img = Image.new("RGBA", (w, h)); d = ImageDraw.Draw(img)
    hor = int(h * rnd.uniform(.40, .50))
    gradient(d, w, h, pal[0], pal[1], hor)
    sx, sy = int(w * rnd.uniform(.2, .8)), int(hor - h * rnd.uniform(.02, .12))
    glow(img, sx, sy, h * .35, pal[2], .7); d = ImageDraw.Draw(img)
    d.ellipse([sx - h * .035, sy - h * .035, sx + h * .035, sy + h * .035], fill=pal[2])
    hills(d, w, hor + h * .02, h * .10, mix(pal[3], pal[1], .35), rnd)
    hills(d, w, hor + h * .06, h * .09, pal[3], rnd)
    hills(d, w, hor + h * .10, h * .07, pal[4], rnd)
    # ground and fairway
    d.rectangle([0, hor + h * .10, w, h], fill=pal[6])
    cxp = w * rnd.uniform(.35, .65)
    bend = rnd.uniform(-.25, .25) * w
    for band in range(26):
        t0, t1 = band / 26, (band + 1) / 26
        def edge(t, side):
            y = hor + h * .10 + (h - hor - h * .10) * t ** 1.35
            wid = w * (.04 + .55 * t ** 1.5)
            cx = cxp + bend * (1 - t) ** 1.6
            return (cx + side * wid, y)
        col = mix(pal[5], pal[6], .5 if band % 2 else 0)
        d.polygon([edge(t0, -1), edge(t0, 1), edge(t1, 1), edge(t1, -1)], fill=col)
    # green + flag + bunker at the far end
    gx, gy = cxp + bend, hor + h * .115
    d.ellipse([gx - w * .05, gy - h * .012, gx + w * .05, gy + h * .02], fill=mix(pal[5], (255, 255, 255), .18))
    flag(d, gx + w * .01, gy, h * .075)
    bx = gx + w * rnd.choice([-1, 1]) * .07
    d.ellipse([bx - w * .035, gy + h * .02, bx + w * .035, gy + h * .045], fill=(238, 224, 186))
    # tree lines on both sides, bigger near the camera
    for side in (-1, 1):
        for i in range(26):
            t = rnd.uniform(.0, 1) ** 1.4
            y = hor + h * .10 + (h - hor - h * .10) * t ** 1.35
            off = w * (.07 + .6 * t ** 1.5) * rnd.uniform(1.05, 1.5)
            x = cxp + bend * (1 - t) ** 1.6 + side * off
            tree(d, x, y, h * (.03 + .22 * t ** 1.4), mix(pal[7], pal[4], rnd.uniform(0, .3)))
    # long evening shadows
    shade = Image.new("RGBA", img.size, (0, 0, 0, 0)); sd = ImageDraw.Draw(shade)
    sd.polygon([(0, h), (w, h), (w, h * .8), (0, h * .86)], fill=(10, 30, 20, 55))
    img.alpha_composite(shade.filter(ImageFilter.GaussianBlur(40)))
    return finish(img, rnd)

def rng(rnd, variant):
    w, h = W * SS, H * SS
    night = variant % 3 == 2
    pal = [hexc(c) for c in PALETTES[(variant + 1) % len(PALETTES)]]
    if night: pal = [hexc("#14223A"), hexc("#3E4F78"), hexc("#FFE9B8"), hexc("#27364D"), hexc("#1E3A32"), hexc("#2F6B4A"), hexc("#245238"), hexc("#142A22")]
    img = Image.new("RGBA", (w, h)); d = ImageDraw.Draw(img)
    hor = int(h * .46)
    gradient(d, w, h, pal[0], pal[1], hor)
    if not night: glow(img, w * rnd.uniform(.2, .8), hor - h * .05, h * .3, pal[2], .6); d = ImageDraw.Draw(img)
    hills(d, w, hor, h * .06, pal[3], rnd); hills(d, w, hor + h * .03, h * .05, pal[4], rnd)
    d.rectangle([0, hor + h * .04, w, h], fill=pal[6])
    for i in range(16):  # mown stripes in perspective
        t0, t1 = i / 16, (i + 1) / 16
        y0 = hor + h * .04 + (h * .54) * t0 ** 1.5; y1 = hor + h * .04 + (h * .54) * t1 ** 1.5
        d.rectangle([0, y0, w, y1], fill=mix(pal[5], pal[6], .5 if i % 2 else 0))
    for i, yd in enumerate([50, 100, 150, 200]):  # yardage flags
        t = (i + 1) / 5
        y = hor + h * .05 + h * .3 * t ** 1.4
        x = w * (.18 + .64 * rnd.random())
        flag(d, x, y, h * (.03 + .08 * t), "#E8743B" if i % 2 else "#F4F0E6")
        d.ellipse([x - w * .03 * (t + .3), y - h * .004, x + w * .03 * (t + .3), y + h * .012 * (t + .3)], fill=mix(pal[5], (255, 255, 255), .25))
    # net poles
    for x in (w * .04, w * .96):
        d.rectangle([x - 14, hor - h * .26, x + 14, hor + h * .06], fill=(70, 78, 80))
    for k in range(0, 40):
        x = w * .04 + (w * .92) * k / 39
        d.line([(x, hor - h * .22), (x, hor + h * .03)], fill=(220, 225, 220, 90) if False else mix(pal[1], (255, 255, 255), .5), width=2)
    # tee-bay roof and mats in the foreground
    d.polygon([(0, h * .62), (w, h * .62), (w, h * .68), (0, h * .68)], fill=(40, 46, 44))
    for i in range(7):
        x = w * i / 6
        d.rectangle([x - 18, h * .68, x + 18, h * .92], fill=(52, 58, 56))
    d.polygon([(0, h * .92), (w, h * .92), (w, h), (0, h)], fill=(36, 92, 62))
    for i in range(6):
        x = w * (i + .5) / 6
        d.ellipse([x - w * .02, h * .94, x + w * .02, h * .965], fill=(248, 247, 240))
    if night:
        for x in (w * .25, w * .5, w * .75):
            glow(img, x, h * .64, h * .35, (255, 236, 190), .45)
    return finish(img, rnd, .38)

def sim(rnd, variant):
    w, h = W * SS, H * SS
    img = Image.new("RGBA", (w, h), (24, 28, 30)); d = ImageDraw.Draw(img)
    gradient(d, w, h, (30, 34, 36), (18, 20, 22), int(h * .8))
    # the big screen shows a course
    sx0, sy0, sx1, sy1 = w * .12, h * .08, w * .88, h * .62
    scene = course(random.Random(rnd.random()), variant).resize((int(sx1 - sx0), int(sy1 - sy0)), Image.LANCZOS).convert("RGBA")
    glow(img, w / 2, (sy0 + sy1) / 2, h * .55, (130, 190, 150), .35); d = ImageDraw.Draw(img)
    d.rectangle([sx0 - 16, sy0 - 16, sx1 + 16, sy1 + 16], fill=(12, 14, 15))
    img.paste(scene, (int(sx0), int(sy0)))
    # warm ceiling strips + wood panels
    for i in range(5):
        y = h * (.02 + i * .0)
    for x in range(0, int(w), int(w / 9)):
        d.rectangle([x + 20, h * .64, x + w / 9 - 20, h * .76], fill=(58, 44, 34))
    d.rectangle([0, h * .76, w, h * .78], fill=(232, 116, 59))  # accent strip
    # turf mat floor
    d.polygon([(0, h * .78), (w, h * .78), (w, h), (0, h)], fill=(34, 96, 64))
    for i in range(14):
        y = h * .78 + (h * .22) * (i / 14) ** 1.3
        d.line([(0, y), (w, y)], fill=(40, 108, 72), width=6)
    # hitting mat, ball, golfer silhouette
    d.polygon([(w * .3, h * .86), (w * .7, h * .86), (w * .78, h * .98), (w * .22, h * .98)], fill=(24, 70, 48))
    d.ellipse([w * .5 - 14, h * .9, w * .5 + 14, h * .915], fill=(250, 250, 245))
    gx, gy = w * rnd.uniform(.28, .4), h * .9
    d.ellipse([gx - 38, gy - h * .30, gx + 38, gy - h * .25], fill=(14, 16, 17))
    d.polygon([(gx - 55, gy - h * .25), (gx + 55, gy - h * .25), (gx + 40, gy - h * .05), (gx - 40, gy - h * .05)], fill=(14, 16, 17))
    d.rectangle([gx - 36, gy - h * .05, gx + 36, gy + h * .06], fill=(14, 16, 17))
    d.line([(gx + 30, gy - h * .12), (w * .49, gy + 12)], fill=(180, 186, 190), width=7)
    return finish(img, rnd, .45)

def main():
    os.makedirs(OUT, exist_ok=True)
    for arg in sys.argv[1:]:
        slug, kind = arg.split(":")
        for i in range(5):
            path = os.path.join(OUT, f"{slug}-{i + 1}.jpg")
            if os.path.exists(path): continue
            rnd = random.Random(f"{slug}-{i}")
            variant = sum(map(ord, slug)) + i * 2
            fn = {"COURSE": course, "RANGE": rng, "SIMULATOR": sim}[kind]
            fn(rnd, variant).save(path, quality=84, optimize=True)
        print("ok", slug)

main()
