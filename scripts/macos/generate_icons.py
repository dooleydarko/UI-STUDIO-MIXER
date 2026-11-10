#!/usr/bin/env python3
"""
Pure-Python RGBA PNG iconset generator for UI Mixer Studio and AI Engine Foundry.
Generates 16x16 through 1024x1024 PNGs in .iconset folders for macOS `iconutil -c icns`.
"""
import math
import os
import struct
import sys
import zlib


def write_png(path, width, height, pixels):
    # pixels: bytearray of RGBA length width*height*4
    raw = bytearray()
    stride = width * 4
    for y in range(height):
        raw.append(0)
        start = y * stride
        raw.extend(pixels[start:start + stride])
    compressed = zlib.compress(bytes(raw), 6)

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(chunk(b"IHDR", ihdr))
        f.write(chunk(b"IDAT", compressed))
        f.write(chunk(b"IEND", b""))


def clamp(v, lo=0.0, hi=255.0):
    return int(max(lo, min(hi, round(v))))


def blend(dst_r, dst_g, dst_b, dst_a, src_r, src_g, src_b, src_a):
    sa = src_a / 255.0
    da = dst_a / 255.0
    out_a = sa + da * (1.0 - sa)
    if out_a <= 1e-6:
        return 0, 0, 0, 0
    r = (src_r * sa + dst_r * da * (1.0 - sa)) / out_a
    g = (src_g * sa + dst_g * da * (1.0 - sa)) / out_a
    b = (src_b * sa + dst_b * da * (1.0 - sa)) / out_a
    return clamp(r), clamp(g), clamp(b), clamp(out_a * 255.0)


def sd_round_rect(px, py, cx, cy, hw, hh, r):
    qx = abs(px - cx) - hw + r
    qy = abs(py - cy) - hh + r
    return math.hypot(max(qx, 0.0), max(qy, 0.0)) + min(max(qx, qy), 0.0) - r


def sd_segment(px, py, ax, ay, bx, by):
    pax, pay = px - ax, py - ay
    bax, bay = bx - ax, by - ay
    h = max(0.0, min(1.0, (pax * bax + pay * bay) / (bax * bax + bay * bay + 1e-9)))
    return math.hypot(pax - bax * h, pay - bay * h)


def sd_hexagon(px, py, cx, cy, r):
    kx, ky, kz = -0.866025404, 0.5, 0.577350269
    x = abs(px - cx)
    y = abs(py - cy)
    dot = min(0.0, kx * x + ky * y)
    x -= 2.0 * dot * kx
    y -= 2.0 * dot * ky
    x -= max(-kz * r, min(kz * r, x))
    y -= r
    d = math.hypot(x, y)
    return -d if y < 0 else d


def render_icon(size, kind):
    buf = bytearray(size * size * 4)
    aa = 1.5 / max(size / 512.0, 0.5)
    inv = 512.0 / size

    for y in range(size):
        py = (y + 0.5) * inv
        for x in range(size):
            px = (x + 0.5) * inv
            t = (px + py) / 1024.0

            # Outer macOS squircle
            d_bg = sd_round_rect(px, py, 256.0, 256.0, 232.0, 232.0, 104.0)
            if d_bg > aa:
                continue
            alpha_bg = max(0.0, min(1.0, (aa - d_bg) / (2.0 * aa))) * 255.0

            if kind == "ui":
                r = 12 + t * 44
                g = 12 + t * 8
                b = 20 + t * 92
                br, bg, bb = 168, 85, 247
            else:
                r = 4 + t * 6
                g = 10 + t * 46
                b = 24 + t * 56
                br, bg, bb = 6, 182, 212

            # Subtle border ring
            if abs(d_bg + 10.0) < 5.0:
                edge = max(0.0, min(1.0, (5.0 - abs(d_bg + 10.0)) / 3.0)) * 0.7
                r = r * (1 - edge) + br * edge
                g = g * (1 - edge) + bg * edge
                b = b * (1 - edge) + bb * edge

            cr, cg, cb, ca = clamp(r), clamp(g), clamp(b), clamp(alpha_bg)

            if kind == "ui":
                # Back card (purple border)
                d1 = sd_round_rect(px, py, 214.0, 212.0, 102.0, 74.0, 22.0)
                if d1 < aa:
                    a1 = max(0.0, min(1.0, (aa - d1) / (2.0 * aa))) * 245.0
                    cr, cg, cb, ca = blend(cr, cg, cb, ca, 30, 27, 75, a1)
                if abs(d1) < 6.0:
                    ab = max(0.0, min(1.0, (6.0 - abs(d1)) / 2.5)) * 255.0
                    cr, cg, cb, ca = blend(cr, cg, cb, ca, 168, 85, 247, ab)

                # Pink dot & white pill on back card
                d_dot = math.hypot(px - 160.0, py - 184.0) - 14.0
                if d_dot < aa:
                    ad = max(0.0, min(1.0, (aa - d_dot) / (2.0 * aa))) * 255.0
                    cr, cg, cb, ca = blend(cr, cg, cb, ca, 236, 72, 153, ad)

                d_bar = sd_segment(px, py, 196.0, 184.0, 278.0, 184.0) - 6.0
                if d_bar < aa:
                    ab = max(0.0, min(1.0, (aa - d_bar) / (2.0 * aa))) * 235.0
                    cr, cg, cb, ca = blend(cr, cg, cb, ca, 233, 213, 255, ab)

                # Front card (emerald border)
                d2 = sd_round_rect(px, py, 298.0, 296.0, 104.0, 78.0, 22.0)
                if d2 < aa:
                    a2 = max(0.0, min(1.0, (aa - d2) / (2.0 * aa))) * 248.0
                    cr, cg, cb, ca = blend(cr, cg, cb, ca, 15, 23, 42, a2)
                if abs(d2) < 6.0:
                    ab2 = max(0.0, min(1.0, (6.0 - abs(d2)) / 2.5)) * 255.0
                    cr, cg, cb, ca = blend(cr, cg, cb, ca, 16, 185, 129, ab2)

                # Checkmark
                dc1 = sd_segment(px, py, 248.0, 296.0, 286.0, 334.0) - 8.5
                dc2 = sd_segment(px, py, 286.0, 334.0, 356.0, 260.0) - 8.5
                dc = min(dc1, dc2)
                if dc < aa:
                    ac = max(0.0, min(1.0, (aa - dc) / (2.0 * aa))) * 255.0
                    cr, cg, cb, ca = blend(cr, cg, cb, ca, 34, 211, 153, ac)

            else:
                # Compute pins
                pins = [
                    (256, 62, 256, 104), (256, 408, 256, 450),
                    (88, 160, 126, 182), (386, 330, 424, 352),
                    (88, 352, 126, 330), (386, 182, 424, 160),
                ]
                for ax, ay, bx, by in pins:
                    dp = sd_segment(px, py, ax, ay, bx, by) - 6.0
                    if dp < aa:
                        ap = max(0.0, min(1.0, (aa - dp) / (2.0 * aa))) * 255.0
                        cr, cg, cb, ca = blend(cr, cg, cb, ca, 34, 211, 238, ap)

                # Hexagon outer core
                dh = sd_hexagon(px, py, 256.0, 256.0, 134.0)
                if dh < aa:
                    ah = max(0.0, min(1.0, (aa - dh) / (2.0 * aa))) * 245.0
                    cr, cg, cb, ca = blend(cr, cg, cb, ca, 9, 21, 38, ah)
                if abs(dh) < 7.0:
                    abh = max(0.0, min(1.0, (7.0 - abs(dh)) / 2.5)) * 255.0
                    cr, cg, cb, ca = blend(cr, cg, cb, ca, 34, 211, 238, abh)

                # Inner turbine ring
                dc = math.hypot(px - 256.0, py - 256.0) - 70.0
                if dc < aa:
                    ac = max(0.0, min(1.0, (aa - dc) / (2.0 * aa))) * 255.0
                    cr, cg, cb, ca = blend(cr, cg, cb, ca, 8, 47, 73, ac)
                if abs(dc) < 5.5:
                    acr = max(0.0, min(1.0, (5.5 - abs(dc)) / 2.2)) * 255.0
                    cr, cg, cb, ca = blend(cr, cg, cb, ca, 16, 185, 129, acr)

                # Lightning bolt segments
                db1 = sd_segment(px, py, 268.0, 198.0, 224.0, 262.0) - 7.5
                db2 = sd_segment(px, py, 224.0, 262.0, 268.0, 262.0) - 7.5
                db3 = sd_segment(px, py, 288.0, 250.0, 244.0, 314.0) - 7.5
                db4 = sd_segment(px, py, 244.0, 250.0, 288.0, 250.0) - 7.5
                db = min(db1, db2, db3, db4)
                if db < aa:
                    ab_bolt = max(0.0, min(1.0, (aa - db) / (2.0 * aa))) * 255.0
                    cr, cg, cb, ca = blend(cr, cg, cb, ca, 34, 211, 238, ab_bolt)

            idx = (y * size + x) * 4
            buf[idx] = cr
            buf[idx + 1] = cg
            buf[idx + 2] = cb
            buf[idx + 3] = ca
    return buf


def build_iconset(name, kind, out_dir):
    iconset_dir = os.path.join(out_dir, f"{name}.iconset")
    os.makedirs(iconset_dir, exist_ok=True)
    specs = [
        ("icon_16x16.png", 16),
        ("icon_16x16@2x.png", 32),
        ("icon_32x32.png", 32),
        ("icon_32x32@2x.png", 64),
        ("icon_128x128.png", 128),
        ("icon_128x128@2x.png", 256),
        ("icon_256x256.png", 256),
        ("icon_256x256@2x.png", 512),
        ("icon_512x512.png", 512),
        ("icon_512x512@2x.png", 1024),
    ]
    cache = {}
    for fname, px in specs:
        if px not in cache:
            cache[px] = render_icon(px, kind)
        write_png(os.path.join(iconset_dir, fname), px, px, cache[px])


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "."
    build_iconset("UIStudio", "ui", out)
    build_iconset("EngineFoundry", "engine", out)
    print(f"Generated UIStudio.iconset and EngineFoundry.iconset in {out}")
