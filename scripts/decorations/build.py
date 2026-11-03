#!/usr/bin/env python3
"""
Draws Comvie's profile collectibles as animated SVG files:

  public/deco/frames/<id>.svg       avatar decorations (240 x 240; the picture is the circle of radius 100 in the middle,
                                    so a decoration is shown at 120% of the picture's size, like Discord's)
  public/deco/nameplates/<id>.svg   nameplate scenes behind a profile header (1200 x 220, the motif sits on the right)
  public/deco/effects/<id>.svg      profile effects drawn over a profile header (2000 x 200)

Run it from the project folder:  python3 scripts/decorations/build.py
Every animation stops when the device asks for reduced motion.
"""
import math
import os
import random

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'deco')
C = 120.0  # centre of a frame


# ------------------------------------------------------------------------------------------------ helpers
def f(v):
    s = f"{v:.2f}".rstrip('0').rstrip('.')
    return '0' if s in ('', '-0') else s


def pol(r, deg, cx=C, cy=C):
    a = math.radians(deg)
    return (cx + r * math.cos(a), cy + r * math.sin(a))


def P(p):
    return f"{f(p[0])},{f(p[1])}"


def add(a, b, k=1.0):
    return (a[0] + b[0] * k, a[1] + b[1] * k)


def norm(v):
    L = math.hypot(v[0], v[1]) or 1.0
    return (v[0] / L, v[1] / L)


def stops(sts):
    out = ''
    for s in sts:
        off, col = s[0], s[1]
        op = s[2] if len(s) > 2 else 1
        out += f'<stop offset="{f(off)}" stop-color="{col}"' + (f' stop-opacity="{f(op)}"' if op != 1 else '') + '/>'
    return out


def lin(id_, sts, x1=0, y1=0, x2=0, y2=1, user=False, extra=''):
    u = ' gradientUnits="userSpaceOnUse"' if user else ''
    return f'<linearGradient id="{id_}" x1="{f(x1)}" y1="{f(y1)}" x2="{f(x2)}" y2="{f(y2)}"{u}{extra}>{stops(sts)}</linearGradient>'


def rad(id_, sts, cx=.5, cy=.5, r=.5, fx=None, fy=None, user=False):
    u = ' gradientUnits="userSpaceOnUse"' if user else ''
    fxy = (f' fx="{f(fx)}"' if fx is not None else '') + (f' fy="{f(fy)}"' if fy is not None else '')
    return f'<radialGradient id="{id_}" cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}"{fxy}{u}>{stops(sts)}</radialGradient>'


REDUCE = '@media (prefers-reduced-motion:reduce){*{animation:none!important}}'


EDGE = {}  # nameplate -> the solid colour its left edge fades into (also used by the page's CSS)


def np_svg(name, color, defs, style, body):
    EDGE[name] = color
    defs += lin('edge', [(0, color), (.04, color), (.3, color, 0)], 0, 0, 1, 0)
    return svg(W, H, defs, style, body + f'<rect width="{W}" height="{H}" fill="url(#edge)"/>')


def svg(w, h, defs, style, body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">'
            f'<defs>{defs}</defs><style>{style}{REDUCE}</style>{body}</svg>')


def tapered(points, w0, w1):
    """A filled stroke along points whose width goes from w0 to w1 (branches, tails)."""
    n = len(points)
    left, right = [], []
    for i, (x, y) in enumerate(points):
        if i == 0:
            d = (points[1][0] - x, points[1][1] - y)
        elif i == n - 1:
            d = (x - points[i - 1][0], y - points[i - 1][1])
        else:
            d = (points[i + 1][0] - points[i - 1][0], points[i + 1][1] - points[i - 1][1])
        d = norm(d)
        nx, ny = -d[1], d[0]
        w = (w0 + (w1 - w0) * i / (n - 1)) / 2
        left.append((x + nx * w, y + ny * w))
        right.append((x - nx * w, y - ny * w))
    pts = left + right[::-1]
    return 'M' + 'L'.join(P(p) for p in pts) + 'Z'


def star4(x, y, r, pinch=.2):
    k = r * pinch
    return (f"M{f(x)},{f(y - r)}Q{f(x + k)},{f(y - k)} {f(x + r)},{f(y)}Q{f(x + k)},{f(y + k)} {f(x)},{f(y + r)}"
            f"Q{f(x - k)},{f(y + k)} {f(x - r)},{f(y)}Q{f(x - k)},{f(y - k)} {f(x)},{f(y - r)}Z")


def star5(x, y, r, inner=.45, rot=-90):
    pts = []
    for i in range(10):
        rr = r if i % 2 == 0 else r * inner
        pts.append(pol(rr, rot + i * 36, x, y))
    return 'M' + 'L'.join(P(p) for p in pts) + 'Z'


def petal_d(L, W):
    """A cherry-blossom petal from (0,0) pointing up, with the little notch at its tip."""
    return (f"M0,0C{f(-W * .62)},{f(-L * .2)} {f(-W * .64)},{f(-L * .84)} {f(-W * .2)},{f(-L)}"
            f"L0,{f(-L * .86)}L{f(W * .2)},{f(-L)}C{f(W * .64)},{f(-L * .84)} {f(W * .62)},{f(-L * .2)} 0,0Z")


def flower(x, y, s, rot=0.0, rnd=None, grad='petal', edge='#B0255E'):
    jit = (lambda a, b: rnd.uniform(a, b)) if rnd else (lambda a, b: 0)
    g = [f'<g transform="translate({f(x)} {f(y)}) rotate({f(rot)})">']
    for k in range(5):
        sc = 1 + jit(-.08, .06)
        g.append(f'<path d="{petal_d(s * sc, s * .94 * sc)}" transform="rotate({f(k * 72 + jit(-6, 6))})" fill="url(#{grad})" '
                 f'stroke="{edge}" stroke-opacity=".38" stroke-width="{f(max(.35, s * .045))}"/>')
    veins = ''.join(f'M{P(pol(s * .2, k * 72 - 90, 0, 0))}L{P(pol(s * .6, k * 72 - 90, 0, 0))}' for k in range(5))
    g.append(f'<path d="{veins}" stroke="#E2689A" stroke-width="{f(s * .045)}" stroke-linecap="round" opacity=".5"/>')
    g.append(f'<circle r="{f(s * .24)}" fill="#E8508A"/><circle r="{f(s * .12)}" fill="#9C1548"/>')
    st = ''
    tips = ''
    for k in range(8):
        a = k * 45 + 20
        p1, p2 = pol(s * .13, a, 0, 0), pol(s * .44, a, 0, 0)
        st += f'M{P(p1)}L{P(p2)}'
        tips += f'<circle cx="{f(p2[0])}" cy="{f(p2[1])}" r="{f(s * .065)}"/>'
    g.append(f'<path d="{st}" stroke="#FFC2D6" stroke-width="{f(s * .04)}"/><g fill="#FFE07A">{tips}</g></g>')
    return ''.join(g)


def bud(x, y, s, rot):
    return (f'<g transform="translate({f(x)} {f(y)}) rotate({f(rot)})">'
            f'<path d="M0,0C{f(-s * .5)},{f(-s * .25)} {f(-s * .45)},{f(-s * .8)} 0,{f(-s)}C{f(s * .45)},{f(-s * .8)} {f(s * .5)},{f(-s * .25)} 0,0Z" '
            f'fill="url(#bud)" stroke="#B0255E" stroke-opacity=".4" stroke-width=".5"/>'
            f'<path d="M0,0L{f(-s * .3)},{f(-s * .3)}M0,0L{f(s * .3)},{f(-s * .3)}" stroke="#6E7B2E" stroke-width="{f(s * .14)}" stroke-linecap="round"/></g>')


def leaf_d(L, W):
    return f"M0,0Q{f(W)},{f(-L * .5)} 0,{f(-L)}Q{f(-W)},{f(-L * .5)} 0,0Z"


BEHIND = ('<mask id="behind" maskUnits="userSpaceOnUse" x="0" y="0" width="240" height="240">'
          '<rect width="240" height="240" fill="#fff"/><circle cx="120" cy="120" r="100.4" fill="#000"/></mask>'
          # fades glow layers out before the image's square edge, so nothing is cut off with a hard line
          '<radialGradient id="softg" cx="120" cy="120" r="120" gradientUnits="userSpaceOnUse"><stop offset=".93" stop-color="#fff"/><stop offset="1" stop-color="#000"/></radialGradient>'
          '<mask id="soft" maskUnits="userSpaceOnUse" x="0" y="0" width="240" height="240"><rect width="240" height="240" fill="url(#softg)"/></mask>')


def ribbon(points, wmax, wmin=.3):
    """A stroke that swells in the middle and thins at both ends."""
    n = len(points)
    left, right = [], []
    for i, (x, y) in enumerate(points):
        a = points[min(i + 1, n - 1)]
        b_ = points[max(i - 1, 0)]
        d = norm((a[0] - b_[0], a[1] - b_[1]))
        nx, ny = -d[1], d[0]
        w = (wmin + (wmax - wmin) * math.sin(math.pi * i / (n - 1)) ** .8) / 2
        left.append((x + nx * w, y + ny * w))
        right.append((x - nx * w, y - ny * w))
    return 'M' + 'L'.join(P(p) for p in left + right[::-1]) + 'Z'


def write(kind, name, text):
    d = os.path.join(OUT, kind)
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, name + '.svg'), 'w') as fh:
        fh.write(text)


SPIN = '@keyframes spin{to{transform:rotate(360deg)}}'
TWINKLE = '@keyframes tw{0%,100%{opacity:.15;transform:scale(.6)}50%{opacity:1;transform:scale(1)}}'
POP = '@keyframes pop{0%,55%,100%{opacity:0;transform:scale(0) rotate(0)}70%{opacity:1;transform:scale(1) rotate(45deg)}85%{opacity:0;transform:scale(.3) rotate(90deg)}}'


def sparkle(x, y, r, cls='', color='#FFFFFF', glow='#FFFFFF', style=''):
    st = f' style="{style}"' if style else ''
    return (f'<g class="{cls}"{st}><circle cx="{f(x)}" cy="{f(y)}" r="{f(r * .9)}" fill="{glow}" opacity=".22"/>'
            f'<path d="{star4(x, y, r, .16)}" fill="{color}"/></g>')


# ================================================================================================ FRAMES
def frame_sakura():
    rnd = random.Random(11)
    defs = (lin('ring', [(0, '#FFEFE7'), (.35, '#F7C3B2'), (.7, '#DB8D7E'), (1, '#A65650')], 0, 0, 1, 1)
            + lin('petal', [(0, '#EC5F93'), (.42, '#FFB3CB'), (1, '#FFF5F8')], 0, 1, 0, 0)
            + lin('petal2', [(0, '#F58AB0'), (1, '#FFE6EF')], 0, 1, 0, 0)
            + lin('bud', [(0, '#D93D78'), (1, '#FFB0CA')], 0, 1, 0, 0)
            + lin('bark', [(0, '#86523E'), (.5, '#5A3428'), (1, '#33201A')], 0, 0, 1, 1)
            + lin('leaf', [(0, '#C9EE7E'), (1, '#4F8D30')], 0, 0, 1, 1))
    b = []
    b.append('<circle cx="120" cy="120" r="104.6" fill="none" stroke="#2B0F1C" stroke-opacity=".32" stroke-width="8.5"/>')
    b.append('<circle cx="120" cy="120" r="104.6" fill="none" stroke="url(#ring)" stroke-width="5"/>')
    b.append('<circle cx="120" cy="120" r="101.7" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width=".9"/>')
    b.append('<circle cx="120" cy="120" r="107.3" fill="none" stroke="#7A2E3A" stroke-opacity=".35" stroke-width=".7"/>')

    def br(t):
        return 114 + 3.2 * math.sin(t * math.pi * 2.2), 160 + 132 * t
    pts = [pol(*br(i / 44)) for i in range(45)]
    b.append(f'<path d="{tapered(pts, 12.5, 2.6)}" fill="url(#bark)" stroke="#20110C" stroke-opacity=".5" stroke-width=".8"/>')
    hl = [pol(br(i / 44)[0] + 1.8, br(i / 44)[1]) for i in range(2, 38)]
    b.append(f'<path d="M{"L".join(P(p) for p in hl)}" fill="none" stroke="#C48B6E" stroke-opacity=".55" stroke-width="1" stroke-linecap="round"/>')

    def twig(t, L, bend, w0=3.4):
        r, a = br(t)
        base = pol(r, a)
        out = norm((base[0] - C, base[1] - C))
        tan = norm((-out[1], out[0]))
        d = norm((out[0] * .75 + tan[0] * .65, out[1] * .75 + tan[1] * .65))
        perp = (-d[1], d[0])
        p = [base, add(add(base, d, L * .5), perp, bend), add(base, d, L)]
        return p, tapered(p, w0, 1.1)
    ends = {}
    for key, t, L, bend in [('a', .33, 19, 2), ('b', .6, 21, -2.5), ('c', .82, 15, 2), ('d', .1, 14, -1.5)]:
        p, d = twig(t, L, bend, 4.2)
        ends[key] = p[-1]
        b.append(f'<path d="{d}" fill="url(#bark)" stroke="#20110C" stroke-opacity=".45" stroke-width=".6"/>')
    # a couple of fresh leaves
    for (x, y), rot, L in [(pol(118, 196), 205, 13), (pol(121, 262), 300, 11)]:
        b.append(f'<path d="{leaf_d(L, L * .38)}" transform="translate({f(x)} {f(y)}) rotate({f(rot)})" fill="url(#leaf)" stroke="#2F5A1A" stroke-opacity=".5" stroke-width=".5"/>')
    # blossoms and buds along the branch
    blossoms = [(pol(br(.37)[0] + 9, br(.37)[1]), 13.5, -8), (pol(br(.55)[0] + 7, br(.55)[1]), 13, 22), (ends['b'], 13.5, -20),
                (pol(br(.45)[0] + 2, br(.45)[1]), 19, 12), (pol(br(.19)[0] + 4, br(.19)[1]), 15, 30), (ends['a'], 11, 5),
                (pol(br(.95)[0] + 2, br(.95)[1]), 12, 40), (ends['c'], 10, -15), (pol(br(.27)[0] + 1, br(.27)[1]), 9, 50)]
    for (x, y), s, rot in blossoms:
        b.append(flower(x, y, s, rot, rnd))
    b.append(bud(*ends['d'], 7, 200))
    b.append(bud(*pol(br(.7)[0] + 3, br(.7)[1]), 6.5, 250))
    # the small sprig at the bottom right
    sp = [pol(113 + 2 * math.sin(i / 10 * math.pi), 8 + 62 * i / 10) for i in range(11)]
    b.append(f'<path d="{tapered(sp, 7, 1.8)}" fill="url(#bark)" stroke="#20110C" stroke-opacity=".45" stroke-width=".6"/>')
    b.append(f'<path d="{leaf_d(14, 5.4)}" transform="translate({P(pol(114, 26))}) rotate(120)" fill="url(#leaf)" stroke="#2F5A1A" stroke-opacity=".5" stroke-width=".5"/>')
    b.append(flower(*pol(117, 14), 10.5, 40, rnd))
    b.append(flower(*pol(116, 42), 15, 18, rnd))
    b.append(bud(*pol(116, 70), 7.5, 150))
    # petals drifting down
    falls = ''
    for i, ((x, y), cls) in enumerate([((178, 168), 'fa'), ((36, 150), 'fb'), ((205, 128), 'fc'), ((60, 196), 'fd')]):
        falls += (f'<g transform="translate({x} {y})"><g class="fall {cls}"><g class="tum">'
                  f'<path d="{petal_d(9.5, 9)}" fill="url(#petal2)" stroke="#C2185B" stroke-opacity=".3" stroke-width=".4"/></g></g></g>')
    b.append(falls)
    style = ('.fall{animation:fall 7s linear infinite}.fb{animation-duration:8.4s;animation-delay:-3.1s}'
             '.fc{animation-duration:6.6s;animation-delay:-5.2s}.fd{animation-duration:9s;animation-delay:-1.4s}'
             '@keyframes fall{0%{transform:translate(0,0);opacity:0}12%{opacity:1}78%{opacity:1}100%{transform:translate(20px,62px);opacity:0}}'
             '.tum{transform-box:fill-box;transform-origin:50% 50%;animation:tum 1.8s ease-in-out infinite alternate}'
             '@keyframes tum{from{transform:rotate(-40deg) scale(1,1)}to{transform:rotate(50deg) scale(.45,1)}}')
    return svg(240, 240, defs, style, ''.join(b))


def tongue(th, rb, d, h, v, wig=0.0):
    b0, b1 = pol(rb, th - d), pol(rb, th + d)
    mid = pol(rb, th)
    perp = (-v[1], v[0])
    tip = add(add(mid, v, h), perp, wig)
    c0a = add(b0, v, h * .38)
    c0b = add(add(mid, v, h * .78), perp, -h * .16 + wig * .2)
    c1a = add(add(mid, v, h * .6), perp, h * .22 + wig * .5)
    c1b = add(b1, v, h * .32)
    return f"M{P(b0)}C{P(c0a)} {P(c0b)} {P(tip)}C{P(c1a)} {P(c1b)} {P(b1)}Z"


def frame_chakra():
    defs = (lin('ring', [(0, '#E6F9FF'), (.5, '#4DA9FF'), (1, '#1A35C4')], 0, 0, 1, 1)
            + rad('orb', [(0, '#FFFFFF'), (.32, '#C4F1FF'), (.7, '#3D9BFF'), (1, '#1B4DFF', 0)])
            + rad('core', [(0, '#FFFFFF', .95), (.35, '#9EE8FF', .8), (1, '#2F6BFF', 0)])
            + rad('aura', [(0, '#3A8BFF', .0), (.8, '#3A8BFF', .0), (.84, '#5FB0FF', .75), (.92, '#2F6BFF', .35), (1, '#2F6BFF', 0)], 120, 120, 124, user=True)
            + lin('gem', [(0, '#F2FDFF'), (.45, '#69D0FF'), (1, '#1C38B8')], 0, 0, 1, 1) + BEHIND)

    def streams(n, r0, r1, span, wmax, flip, seed):
        r = random.Random(seed)
        d = ''
        for i in range(n):
            a0 = i * 360 / n + r.uniform(-8, 8)
            sp = span * r.uniform(.8, 1.15)
            pts = [pol(r0 + (r1 - r0) * (k / 24) ** 1.3 + r.uniform(-.3, .3), a0 + flip * sp * k / 24) for k in range(25)]
            d += ribbon(pts, wmax * r.uniform(.8, 1.1))
        return d
    b = [f'<g mask="url(#soft)"><g mask="url(#behind)"><circle cx="120" cy="120" r="124" fill="url(#aura)"/>'
         f'<g class="s1"><path d="{streams(7, 101, 121, 80, 7, 1, 8)}" fill="#2C7BFF" opacity=".55"/></g></g></g>']
    b.append(f'<g class="s1"><path d="{streams(8, 100.6, 115, 70, 5.4, 1, 1)}" fill="#7FD3FF" opacity=".9"/>'
             f'<path d="{streams(8, 100.6, 113, 62, 2.2, 1, 1)}" fill="#F0FCFF"/></g>')
    b.append(f'<g class="s2"><path d="{streams(6, 100.6, 112, 54, 3.2, -1, 5)}" fill="#C9F1FF" opacity=".85"/></g>')
    b.append('<circle cx="120" cy="120" r="102" fill="none" stroke="url(#ring)" stroke-width="2.8"/>')
    b.append('<circle cx="120" cy="120" r="100.8" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width=".8"/>')
    orbs = ''
    for k in range(3):
        a = k * 120 - 90
        for j in range(1, 7):
            p = pol(114, a - 5 * j)
            orbs += f'<circle cx="{f(p[0])}" cy="{f(p[1])}" r="{f(4 - j * .5)}" fill="#86D7FF" opacity="{f(.6 - j * .08)}"/>'
        p = pol(114, a)
        orbs += f'<circle cx="{f(p[0])}" cy="{f(p[1])}" r="9.5" fill="url(#core)"/><circle cx="{f(p[0])}" cy="{f(p[1])}" r="5.6" fill="url(#orb)"/>'
    b.append(f'<g class="orbit">{orbs}</g>')

    def bolt(a, flip):
        steps = [(103, 0), (109, -5), (107, -1), (114, -7), (112, -3), (121, -9), (118, -5), (127, -11)]
        return 'M' + 'L'.join(P(pol(r, a + s_ * flip)) for r, s_ in steps)
    for a, flip, cls in [(-32, 1, 'z1'), (150, -1, 'z2')]:
        d = bolt(a, flip)
        b.append(f'<g class="zap {cls}"><path d="{d}" fill="none" stroke="#5CBFFF" stroke-width="4.4" stroke-opacity=".6" stroke-linejoin="round" stroke-linecap="round"/>'
                 f'<path d="{d}" fill="none" stroke="#F4FDFF" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></g>')
    gem = ('<g class="gem"><circle cx="120" cy="223" r="16" fill="url(#core)"/>'
           '<path d="M108.5,220L113.5,212.5H126.5L131.5,220L120,236Z" fill="url(#gem)" stroke="#0E2A8A" stroke-opacity=".6" stroke-width=".8"/>'
           '<path d="M113.5,212.5L117,220L120,212.5L123,220L126.5,212.5M108.5,220H131.5M117,220L120,236L123,220" fill="none" stroke="#E8FBFF" stroke-opacity=".7" stroke-width=".55"/>'
           '<path d="M113.5,212.5L117,220H108.5Z" fill="#fff" opacity=".55"/></g>')
    b.append(gem)
    style = (SPIN + '.s1{transform-origin:120px 120px;animation:spin 7s linear infinite}'
             '.s2{transform-origin:120px 120px;animation:spin 5s linear infinite reverse}'
             '.orbit{transform-origin:120px 120px;animation:spin 4.2s linear infinite}'
             '.zap{opacity:0;animation:zap 3.2s linear infinite}.z2{animation-delay:-1.6s}'
             '@keyframes zap{0%,60%{opacity:0}62%{opacity:1}65%{opacity:.2}68%{opacity:1}74%,100%{opacity:0}}'
             '.gem{transform-origin:120px 224px;animation:gem 2.4s ease-in-out infinite alternate}'
             '@keyframes gem{from{transform:scale(.94)}to{transform:scale(1.06)}}')
    return svg(240, 240, defs, style, ''.join(b))


def flame_tongue(th, rb, d, h, v, curl):
    b0, b1 = pol(rb, th - d), pol(rb, th + d)
    mid = pol(rb, th)
    perp = (-v[1], v[0])
    tip = add(add(mid, v, h), perp, curl * h * .32)
    c0a = add(add(b0, v, h * .35), perp, -h * .1)
    c0b = add(add(mid, v, h * .82), perp, curl * h * .06 - h * .16)
    c1a = add(add(mid, v, h * .6), perp, curl * h * .22 + h * .2)
    c1b = add(add(b1, v, h * .28), perp, h * .06)
    return f"M{P(b0)}C{P(c0a)} {P(c0b)} {P(tip)}C{P(c1a)} {P(c1b)} {P(b1)}Z"


def spirit_fire(seed):
    """Flames climbing both sides of the picture (front) and rising behind its top (back, masked)."""
    r = random.Random(seed)
    outer = mid = core = ''
    th = -58.0
    while th <= 238:
        if 72 < th < 108:  # the bottom stays calm
            th += 8
            continue
        t = math.radians(th)
        c, s_ = math.cos(t), math.sin(t)
        h = 6 + 24 * abs(c) ** 1.4 * (.55 + .45 * max(0.0, s_)) - 6 * max(0.0, -s_)
        h = max(3.5, h) * r.uniform(.72, 1.05)
        v = norm((c, s_ - 1.0))
        d = 4 + h * .36
        curl = r.uniform(-1, 1)
        outer += flame_tongue(th, 100.6, d, h, v, curl)
        mid += flame_tongue(th, 100.6, d * .66, h * .68, v, curl * .8)
        core += flame_tongue(th, 100.6, d * .34, h * .38, v, curl * .5)
        th += r.uniform(7.5, 10)
    back = backin = ''
    th = 196.0
    while th <= 344:
        t = math.radians(th)
        h = r.uniform(19, 28) * (.75 + .25 * abs(math.sin(t)))
        v = norm((math.cos(t) * .45, -1.0))
        curl = r.uniform(-1, 1)
        back += flame_tongue(th, 92, 7.5, h, v, curl)
        backin += flame_tongue(th, 92, 4.5, h * .7, v, curl * .8)
        th += r.uniform(9, 13)
    return outer, mid, core, back, backin


def frame_spirit():
    defs = (rad('wisp', [(0, '#F2FFFD'), (.3, '#9FFFF2', .9), (1, '#20C9D4', 0)])
            + lin('wf', [(0, '#1FB6D0'), (1, '#9CFFF2')], 0, 1, 0, 0)
            + rad('aura', [(0, '#2BE0D2', 0), (.8, '#2BE0D2', 0), (.85, '#5FFFF0', .4), (.95, '#1AA6C0', .14), (1, '#1AA6C0', 0)], 120, 112, 128, user=True)
            + BEHIND)
    b = ['<g mask="url(#soft)"><circle cx="120" cy="112" r="128" fill="url(#aura)" mask="url(#behind)"/></g>']
    variants = [spirit_fire(seed) for seed in (1, 2, 3)]
    for k, (o, m, c, bk, bi) in enumerate(variants):
        b.append(f'<g class="fl f{k}" mask="url(#behind)"><path d="{bk}" fill="#0C6F96" opacity=".9"/><path d="{bi}" fill="#22BFD3" opacity=".9"/></g>')
    b.append('<circle cx="120" cy="120" r="101.6" fill="none" stroke="#0B5C78" stroke-width="2.6"/>')
    b.append('<circle cx="120" cy="120" r="100.8" fill="none" stroke="#BFFFF7" stroke-opacity=".8" stroke-width=".8"/>')
    for k, (o, m, c, bk, bi) in enumerate(variants):
        b.append(f'<g class="fl f{k}"><path d="{o}" fill="#14A7C7" stroke="#065676" stroke-opacity=".55" stroke-width=".7" stroke-linejoin="round"/>'
                 f'<path d="{m}" fill="#68EFE5"/><path d="{c}" fill="#F0FFFD"/></g>')

    def wisp(x, y, s, cls):
        body = (f'M{f(x)},{f(y + s)}C{f(x - s * .8)},{f(y + s * .45)} {f(x - s * .55)},{f(y - s * .45)} {f(x + s * .1)},{f(y - s * 1.7)}'
                f'C{f(x + s * .2)},{f(y - s * .7)} {f(x + s * .8)},{f(y - s * .1)} {f(x + s * .7)},{f(y + s * .4)}C{f(x + s * .6)},{f(y + s * .85)} {f(x + s * .3)},{f(y + s)} {f(x)},{f(y + s)}Z')
        return (f'<g class="bob {cls}"><circle cx="{f(x)}" cy="{f(y)}" r="{f(s * 2.1)}" fill="url(#wisp)" opacity=".55"/>'
                f'<path d="{body}" fill="url(#wf)" stroke="#0B6F88" stroke-opacity=".45" stroke-width=".5"/>'
                f'<circle cx="{f(x)}" cy="{f(y + s * .25)}" r="{f(s * .42)}" fill="#F4FFFD"/></g>')
    b.append(wisp(28, 30, 7.8, 'w1') + wisp(214, 26, 6.2, 'w2') + wisp(120, 228, 5, 'w3'))
    style = ('.fl{animation:fl 1.35s linear infinite;opacity:0}.f1{animation-delay:-.45s}.f2{animation-delay:-.9s}'
             '@keyframes fl{0%,28%{opacity:1}36%,92%{opacity:0}100%{opacity:1}}'
             '.bob{animation:bob 2.6s ease-in-out infinite alternate}.w2{animation-delay:-1.3s}.w3{animation-delay:-.7s;animation-duration:2.1s}'
             '@keyframes bob{from{transform:translateY(-3px)}to{transform:translateY(3.5px)}}')
    return svg(240, 240, defs, style, ''.join(b))


def frame_film():
    defs = (lin('reel', [(0, '#F4F7FA'), (.45, '#AEB8C3'), (1, '#55606C')], 0, 0, 1, 1)
            + lin('face', [(0, '#D7DEE5'), (1, '#7D8995')], 0, 0, 1, 1)
            + lin('cell', [(0, '#6B4B30'), (.5, '#3E2B1E'), (1, '#2A1E16')], 0, 0, 1, 1)
            + rad('hole', [(0, '#3A3540'), (1, '#121116')]))
    b = []
    strip = ['<circle cx="120" cy="120" r="108.7" fill="none" stroke="#18171D" stroke-width="16.6"/>']
    cells = ''
    for i in range(15):
        a0, a1 = i * 24 + 1.2, i * 24 + 22.8
        p0, p1, p2, p3 = pol(105.2, a0), pol(112.2, a0), pol(112.2, a1), pol(105.2, a1)
        cells += f'M{P(p0)}L{P(p1)}A112.2,112.2 0 0 1 {P(p2)}L{P(p3)}A105.2,105.2 0 0 0 {P(p0)}Z'
    strip.append(f'<path d="{cells}" fill="url(#cell)" opacity=".95"/>')
    strip.append('<circle cx="120" cy="120" r="108.7" fill="none" stroke="#FFD9A0" stroke-opacity=".07" stroke-width="6"/>')
    holes = ''
    for i in range(60):
        a = i * 6 + 3
        for rr in (102.6, 114.8):
            x, y = pol(rr, a)
            holes += f'<rect x="{f(x - 1.9)}" y="{f(y - 1.15)}" width="3.8" height="2.3" rx=".6" transform="rotate({f(a + 90)} {f(x)} {f(y)})"/>'
    strip.append(f'<g fill="#F2E2C2">{holes}</g>')
    strip.append('<circle cx="120" cy="120" r="100.9" fill="none" stroke="#3A3843" stroke-width="1"/>')
    strip.append('<circle cx="120" cy="120" r="116.6" fill="none" stroke="#3A3843" stroke-width="1"/>')
    b.append(f'<g class="run">{"".join(strip)}</g>')
    b.append('<circle cx="120" cy="120" r="100.9" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width=".7"/>')
    # the reel at the bottom right
    cx, cy = 202, 202
    reel = [f'<circle cx="{cx}" cy="{cy}" r="29" fill="#0E0D12" opacity=".35"/>',
            f'<circle cx="{cx}" cy="{cy}" r="27.5" fill="url(#reel)" stroke="#20242B" stroke-opacity=".7" stroke-width=".9"/>',
            f'<circle cx="{cx}" cy="{cy}" r="24.5" fill="url(#face)"/>',
            f'<circle cx="{cx}" cy="{cy}" r="21" fill="none" stroke="#5E6976" stroke-opacity=".5" stroke-width=".7"/>']
    for k in range(5):
        x, y = pol(13.5, k * 72 - 90, cx, cy)
        reel.append(f'<circle cx="{f(x)}" cy="{f(y)}" r="6.4" fill="url(#hole)" stroke="#2A2F37" stroke-width=".6"/>')
        hx, hy = pol(13.5, k * 72 - 90 - 20, cx, cy)
    reel.append(f'<circle cx="{cx}" cy="{cy}" r="5.4" fill="#454E5A" stroke="#22272E" stroke-width=".6"/>')
    reel.append(f'<circle cx="{cx}" cy="{cy}" r="2" fill="#C9D1D9"/>')
    for k in range(3):
        x, y = pol(4, k * 120, cx, cy)
        reel.append(f'<rect x="{f(x - .7)}" y="{f(y - .7)}" width="1.4" height="1.4" fill="#1C2026"/>')
    b.append(f'<g class="reel">{"".join(reel)}</g>')
    b.append(f'<path d="M{cx - 21},{cy - 16}A26,26 0 0 1 {cx - 4},{cy - 25.5}" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="1.3" stroke-linecap="round"/>')
    style = (SPIN + '.run{transform-origin:120px 120px;animation:spin 60s linear infinite}'
             f'.reel{{transform-origin:{cx}px {cy}px;animation:spin 4.5s linear infinite}}')
    return svg(240, 240, defs, style, ''.join(b))


def gold_ring_defs(id_='gold'):
    return lin(id_, [(0, '#FFF8D8'), (.18, '#F7D372'), (.4, '#B47D20'), (.58, '#FFE9A8'), (.78, '#C8902C'), (1, '#7A4F12')], 0, 0, 1, 1)


def frame_spotlight():
    defs = (gold_ring_defs()
            + lin('metal', [(0, '#6A6F7D'), (.45, '#2E3039'), (1, '#15161B')], 0, 0, 0, 1)
            + rad('lens', [(0, '#FFFFFF'), (.5, '#FFF6CF'), (1, '#F2C14E')])
            + rad('bulb', [(0, '#FFFFFF'), (.45, '#FFF0B8'), (1, '#E59B2C')])
            + rad('glow', [(0, '#FFE7A0', .9), (1, '#FFD36B', 0)])
            + rad('rays', [(0, '#FFF8DC'), (.86, '#FFF3C8'), (.94, '#FFE7A0', .7), (1, '#FFE08A', 0)], 120, 120, 118, user=True)
            + lin('beamL', [(0, '#FFF9E0', .95), (.5, '#FFEDB0', .6), (1, '#FFE3A0', 0)], 34, 213, 60, 10, True)
            + lin('beamR', [(0, '#FFF9E0', .95), (.5, '#FFEDB0', .6), (1, '#FFE3A0', 0)], 206, 213, 180, 10, True)
            + BEHIND)
    b = []
    rays = ''
    for k in range(20):
        a0 = k * 18
        rays += f'M120,120L{P(pol(118, a0 - 4.2))}L{P(pol(118, a0 + 4.2))}Z'
    b.append(f'<g mask="url(#soft)"><g mask="url(#behind)"><g class="rays"><path d="{rays}" fill="url(#rays)"/></g>'
             f'<g class="bm b1"><path d="M34,213L-14,36L72,6Z" fill="url(#beamL)"/></g>'
             f'<g class="bm b2"><path d="M206,213L168,6L254,36Z" fill="url(#beamR)"/></g></g></g>')
    b.append('<circle cx="120" cy="120" r="104.6" fill="none" stroke="#3A2408" stroke-opacity=".45" stroke-width="11"/>')
    b.append('<circle cx="120" cy="120" r="104.6" fill="none" stroke="url(#gold)" stroke-width="8.4"/>')
    b.append('<circle cx="120" cy="120" r="108.8" fill="none" stroke="#FFF4C8" stroke-opacity=".75" stroke-width=".7"/>')
    b.append('<circle cx="120" cy="120" r="100.6" fill="none" stroke="#FFF4C8" stroke-opacity=".6" stroke-width=".6"/>')
    groups = ['', '', '', '']
    for k in range(18):
        x, y = pol(104.6, k * 20 - 90)
        groups[k % 4] += (f'<circle cx="{f(x)}" cy="{f(y)}" r="7.5" fill="url(#glow)"/>'
                          f'<circle cx="{f(x)}" cy="{f(y)}" r="3.5" fill="url(#bulb)" stroke="#8A5A12" stroke-width=".6"/>')
    for k in range(4):
        b.append(f'<g class="bu u{k}">{groups[k]}</g>')

    def lamp(lx, ly, ang):
        return (f'<g transform="translate({f(lx)} {f(ly)}) rotate({f(ang)})">'
                f'<path d="M-4,-14L2,-10M-4,14L2,10" stroke="#24262D" stroke-width="2.4" stroke-linecap="round"/>'
                f'<rect x="-24" y="-11" width="26" height="22" rx="5" fill="url(#metal)" stroke="#0E0F13" stroke-width=".9"/>'
                f'<path d="M-19,-11V11M-14,-11V11M-9,-11V11" stroke="#7A7F8D" stroke-opacity=".55" stroke-width=".9"/>'
                f'<path d="M3,-13L12,-18M3,13L12,18" stroke="#3A3D47" stroke-width="2.8" stroke-linecap="round"/>'
                f'<ellipse cx="2.6" cy="0" rx="4" ry="12" fill="url(#gold)" stroke="#6B4310" stroke-width=".6"/>'
                f'<ellipse cx="3.6" cy="0" rx="2.8" ry="9.6" fill="url(#lens)"/>'
                f'<path d="M-21,-8H-4" stroke="#fff" stroke-opacity=".4" stroke-width="1.1" stroke-linecap="round"/></g>')
    b.append(f'<g transform="translate(34 213) scale(.86) translate(-34 -213)">{lamp(34, 213, -104)}</g>'
             f'<g transform="translate(206 213) scale(.86) translate(-206 -213)">{lamp(206, 213, -76)}</g>')
    style = (SPIN + '.rays{transform-origin:120px 120px;animation:spin 40s linear infinite}'
             '.b1{transform-origin:34px 213px;animation:sw 5s ease-in-out infinite alternate}'
             '.b2{transform-origin:206px 213px;animation:sw 5s ease-in-out infinite alternate-reverse}'
             '@keyframes sw{from{transform:rotate(-9deg)}to{transform:rotate(7deg)}}'
             '.bu{animation:bu 1.6s ease-in-out infinite}.u1{animation-delay:-.4s}.u2{animation-delay:-.8s}.u3{animation-delay:-1.2s}'
             '@keyframes bu{0%,100%{opacity:.55}50%{opacity:1}}')
    return svg(240, 240, defs, style, ''.join(b))


def frame_premiere():
    defs = (lin('brass', [(0, '#FFF2C2'), (.35, '#F3C760'), (.7, '#B07A1E'), (1, '#6E4810')], 0, 0, 1, 1)
            + rad('ball', [(0, '#FFFBE6'), (.35, '#F6D271'), (.8, '#A8721C'), (1, '#6B460E')], .5, .5, .5, .35, .3)
            + lin('starg', [(0, '#FFF6D2'), (.5, '#F5C447'), (1, '#B3781C')], 0, 0, 1, 1)
            + rad('flash', [(0, '#FFFFFF'), (1, '#FFFFFF', 0)]))
    b = []
    # brass posts first, the rope runs over them
    for a in (128, 52):
        x, y = pol(107, a)
        b.append(f'<rect x="{f(x - 3.6)}" y="{f(y)}" width="7.2" height="{f(240 - y)}" rx="2" fill="url(#brass)" stroke="#5A3A0C" stroke-opacity=".6" stroke-width=".7"/>')
        b.append(f'<rect x="{f(x - 6.5)}" y="{f(232)}" width="13" height="5" rx="2" fill="url(#brass)" stroke="#5A3A0C" stroke-opacity=".6" stroke-width=".7"/>')
    b.append('<circle cx="120" cy="120" r="107" fill="none" stroke="#2A0510" stroke-opacity=".45" stroke-width="12"/>')
    b.append('<circle cx="120" cy="120" r="107" fill="none" stroke="#7E0B22" stroke-width="9.6"/>')
    strands = ''
    for i in range(72):
        a = i * 5
        p0, p1, p2, p3 = pol(102.4, a), pol(102.4, a + 2.2), pol(111.6, a + 5.4), pol(111.6, a + 3.2)
        strands += f'M{P(p0)}L{P(p1)}L{P(p2)}L{P(p3)}Z'
    b.append(f'<path d="{strands}" fill="#D3243F"/>')
    b.append('<circle cx="120" cy="120" r="107" fill="none" stroke="#FF8FA3" stroke-opacity=".3" stroke-width="2.4"/>')
    b.append('<circle cx="120" cy="120" r="102" fill="none" stroke="#4A0410" stroke-opacity=".6" stroke-width="1"/>')
    b.append('<circle cx="120" cy="120" r="112" fill="none" stroke="#4A0410" stroke-opacity=".6" stroke-width="1"/>')
    for a in (128, 52):
        x, y = pol(107, a)
        b.append(f'<circle cx="{f(x)}" cy="{f(y - 1)}" r="7.6" fill="url(#ball)" stroke="#5A3A0C" stroke-opacity=".6" stroke-width=".7"/>')
        b.append(f'<ellipse cx="{f(x - 2.4)}" cy="{f(y - 4)}" rx="2.2" ry="1.4" fill="#fff" opacity=".7"/>')
    # the star at the top
    b.append(f'<path d="{star5(120, 15, 16, .46)}" fill="#3A2208" opacity=".35" transform="translate(1.2 1.6)"/>')
    b.append(f'<path d="{star5(120, 15, 16, .46)}" fill="url(#starg)" stroke="#7A4F12" stroke-width=".9" stroke-linejoin="round"/>')
    b.append(f'<path d="{star5(120, 15.6, 9, .46)}" fill="#E34763" stroke="#9E1C33" stroke-width=".6" stroke-linejoin="round"/>')
    b.append(f'<path d="{star5(120, 15.6, 9, .46)}" fill="#fff" opacity=".2" transform="translate(-1 -1)"/>')
    # camera flashes
    flashes = ''
    for (x, y, r, dl) in [(36, 46, 9, 0), (206, 52, 8, -1.2), (222, 150, 7, -2.3), (18, 132, 7.5, -3.1), (176, 222, 6.5, -1.8)]:
        flashes += (f'<g class="fx" style="animation-delay:{dl}s;transform-origin:{x}px {y}px">'
                    f'<circle cx="{x}" cy="{y}" r="{f(r * 1.3)}" fill="url(#flash)" opacity=".8"/><path d="{star4(x, y, r, .12)}" fill="#fff"/></g>')
    b.append(flashes)
    style = ('.fx{opacity:0;animation:fx 3.6s ease-out infinite}'
             '@keyframes fx{0%,70%,100%{opacity:0;transform:scale(.2)}74%{opacity:1;transform:scale(1.1)}86%{opacity:0;transform:scale(.6)}}')
    return svg(240, 240, defs, style, ''.join(b))


def frame_neon():
    defs = ('<filter id="glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.6"/></filter>'
            + lin('cap', [(0, '#9AA0AC'), (.5, '#3B3F48'), (1, '#1B1D22')], 0, 0, 0, 1)
            + lin('tube', [(0, '#FF7BE5'), (.5, '#FF4FD8'), (1, '#A56BFF')], 20, 20, 220, 220, True)
            + lin('tubeg', [(0, '#FF2FCB'), (1, '#8A4BFF')], 20, 20, 220, 220, True))
    b = []
    a0, a1 = 146, 124 + 360
    p0, p1 = pol(106, a0), pol(106, a1)
    ring = f'M{P(p0)}A106,106 0 1 1 {P(p1)}'
    b.append(f'<g class="hum"><path d="{ring}" fill="none" stroke="url(#tubeg)" stroke-width="10" stroke-linecap="round" filter="url(#glow)" opacity=".9"/></g>')
    b.append(f'<path d="{ring}" fill="none" stroke="url(#tube)" stroke-width="3.8" stroke-linecap="round"/>')
    b.append(f'<path d="{ring}" fill="none" stroke="#FFF0FB" stroke-width="1.4" stroke-linecap="round"/>')
    # a second, cyan tube on the upper right
    q0, q1 = pol(113.5, -78), pol(113.5, 18)
    tube2 = f'M{P(q0)}A113.5,113.5 0 0 1 {P(q1)}'
    b.append(f'<path d="{tube2}" fill="none" stroke="#18E4FF" stroke-width="8" stroke-linecap="round" filter="url(#glow)" opacity=".8"/>')
    b.append(f'<path d="{tube2}" fill="none" stroke="#6CF4FF" stroke-width="3" stroke-linecap="round"/>')
    b.append(f'<path d="{tube2}" fill="none" stroke="#F0FFFF" stroke-width="1.1" stroke-linecap="round"/>')
    # electrode caps where the pink tube ends
    for a in (a0, a1):
        x, y = pol(106, a)
        b.append(f'<rect x="{f(x - 4)}" y="{f(y - 2.6)}" width="8" height="5.2" rx="1.4" fill="url(#cap)" transform="rotate({f(a + 90)} {f(x)} {f(y)})" stroke="#0D0E11" stroke-width=".5"/>')
    # clips holding the tube
    for a in (-120, -10, 60):
        x, y = pol(106, a)
        b.append(f'<rect x="{f(x - 1.6)}" y="{f(y - 4.6)}" width="3.2" height="9.2" rx=".8" fill="#2B2E36" stroke="#0D0E11" stroke-width=".5" transform="rotate({f(a)} {f(x)} {f(y)})"/>')
    # neon heart sign, bottom right
    hx, hy, s = 201, 196, 1.0
    heart = (f'M{f(hx)},{f(hy + 13 * s)}C{f(hx - 4 * s)},{f(hy + 9 * s)} {f(hx - 15 * s)},{f(hy + 3 * s)} {f(hx - 15 * s)},{f(hy - 5 * s)}'
             f'C{f(hx - 15 * s)},{f(hy - 12 * s)} {f(hx - 7 * s)},{f(hy - 15 * s)} {f(hx)},{f(hy - 8 * s)}'
             f'C{f(hx + 7 * s)},{f(hy - 15 * s)} {f(hx + 15 * s)},{f(hy - 12 * s)} {f(hx + 15 * s)},{f(hy - 5 * s)}'
             f'C{f(hx + 15 * s)},{f(hy + 3 * s)} {f(hx + 4 * s)},{f(hy + 9 * s)} {f(hx)},{f(hy + 13 * s)}Z')
    b.append(f'<g class="flick"><path d="{heart}" fill="#120A18" opacity=".55"/>'
             f'<path d="{heart}" fill="none" stroke="#18E4FF" stroke-width="7" filter="url(#glow)" stroke-linejoin="round"/>'
             f'<path d="{heart}" fill="none" stroke="#6CF4FF" stroke-width="2.8" stroke-linejoin="round"/>'
             f'<path d="{heart}" fill="none" stroke="#F0FFFF" stroke-width="1" stroke-linejoin="round"/></g>')
    # a little yellow neon star, top left
    sx, sy = 30, 40
    st = star5(sx, sy, 10, .48)
    b.append(f'<path d="{st}" fill="none" stroke="#FFE45C" stroke-width="6" filter="url(#glow)" stroke-linejoin="round"/>'
             f'<path d="{st}" fill="none" stroke="#FFF08A" stroke-width="2.4" stroke-linejoin="round"/>'
             f'<path d="{st}" fill="none" stroke="#FFFDE8" stroke-width=".9" stroke-linejoin="round"/>')
    style = ('.hum{animation:hum 3s ease-in-out infinite alternate}@keyframes hum{from{opacity:.7}to{opacity:1}}'
             '.flick{animation:flick 5s linear infinite}'
             '@keyframes flick{0%,40%,45%,47%,100%{opacity:1}42%,46%{opacity:.15}43%{opacity:.8}}')
    return svg(240, 240, defs, style, ''.join(b))


def frame_gold():
    defs = (gold_ring_defs()
            + lin('leaf', [(0, '#FFF4B8'), (.45, '#EDBB45'), (1, '#9C6514')], 0, 0, 1, 0)
            + rad('berry', [(0, '#FFF9DA'), (.4, '#F3CB5E'), (1, '#8C5A12')], .5, .5, .5, .35, .3)
            + lin('rib', [(0, '#F04B5C'), (.6, '#B71C2E'), (1, '#7A0E1C')], 0, 0, 0, 1)
            + lin('crown', [(0, '#FFF6CF'), (.4, '#F2C24E'), (1, '#9B6516')], 0, 0, 0, 1)
            + rad('ruby', [(0, '#FFC2CB'), (.4, '#E8344F'), (1, '#7A0618')], .5, .5, .5, .35, .3)
            + rad('sapph', [(0, '#D6E6FF'), (.4, '#3D74E8'), (1, '#0F2A7A')], .5, .5, .5, .35, .3)
            + rad('flash', [(0, '#FFFFFF'), (1, '#FFFFFF', 0)]))
    b = ['<circle cx="120" cy="120" r="103.8" fill="none" stroke="#3A2408" stroke-opacity=".4" stroke-width="6"/>',
         '<circle cx="120" cy="120" r="103.8" fill="none" stroke="url(#gold)" stroke-width="3.4"/>',
         '<circle cx="120" cy="120" r="101.4" fill="none" stroke="#FFF4C8" stroke-opacity=".55" stroke-width=".6"/>']

    def branch(start, end, sign):
        out = []
        n = 11
        stem = [pol(110.5, start + (end - start) * i / 40) for i in range(41)]
        out.append(f'<path d="M{"L".join(P(p) for p in stem)}" fill="none" stroke="#A8721C" stroke-width="1.8" stroke-linecap="round"/>')
        for i in range(n):
            t = (i + .5) / n
            a = start + (end - start) * t
            base = pol(110.5, a)
            o = norm((base[0] - C, base[1] - C))
            fwd = norm((-o[1] * sign, o[0] * sign))
            L = 17 - 8 * t
            for side, k in ((1, .55), (-1, .42)):
                dvec = norm((fwd[0] + o[0] * k * side, fwd[1] + o[1] * k * side))
                ang = math.degrees(math.atan2(dvec[1], dvec[0])) + 90
                Lw = L * (1 if side == 1 else .82)
                out.append(f'<path d="{leaf_d(Lw, Lw * .3)}" transform="translate({P(base)}) rotate({f(ang)})" fill="url(#leaf)" stroke="#6B4510" stroke-opacity=".5" stroke-width=".5"/>'
                           f'<path d="M0,{f(-Lw * .1)}L0,{f(-Lw * .85)}" transform="translate({P(base)}) rotate({f(ang)})" stroke="#8A5A12" stroke-opacity=".55" stroke-width=".5"/>')
            if i % 3 == 1:
                bp = add(base, o, 6)
                out.append(f'<circle cx="{f(bp[0])}" cy="{f(bp[1])}" r="2.4" fill="url(#berry)"/>')
        return ''.join(out)
    b.append(branch(100, 212, -1))
    b.append(branch(80, -32, 1))
    # ribbon tying the two branches
    b.append('<path d="M116,226L104,240L110,240L118,230Z M124,226L136,240L130,240L122,230Z" fill="url(#rib)" stroke="#5A0812" stroke-opacity=".6" stroke-width=".6"/>'
             '<path d="M120,224C112,214 100,216 103,224C105,231 114,229 120,224Z M120,224C128,214 140,216 137,224C135,231 126,229 120,224Z" fill="url(#rib)" stroke="#5A0812" stroke-opacity=".6" stroke-width=".7"/>'
             '<ellipse cx="120" cy="224.5" rx="4.4" ry="4" fill="#C2263A" stroke="#5A0812" stroke-opacity=".6" stroke-width=".6"/>'
             '<path d="M106,220C108,217 112,217 114,219" fill="none" stroke="#FF8C99" stroke-opacity=".7" stroke-width=".8" stroke-linecap="round"/>')
    # crown on top
    crown = ('M101,24L99,8L108,15L114,2L120,12L126,2L132,15L141,8L139,24Z')
    b.append(f'<path d="{crown}" fill="#3A2408" opacity=".35" transform="translate(1 1.5)"/>')
    b.append(f'<path d="{crown}" fill="url(#crown)" stroke="#6B4510" stroke-width=".9" stroke-linejoin="round"/>')
    b.append('<rect x="100" y="21" width="40" height="6.4" rx="2" fill="url(#gold)" stroke="#6B4510" stroke-width=".8"/>')
    b.append('<circle cx="120" cy="16.5" r="3.4" fill="url(#ruby)" stroke="#5A0812" stroke-width=".5"/>'
             '<circle cx="108.5" cy="18" r="2.3" fill="url(#sapph)" stroke="#0A1C55" stroke-width=".4"/>'
             '<circle cx="131.5" cy="18" r="2.3" fill="url(#sapph)" stroke="#0A1C55" stroke-width=".4"/>'
             '<circle cx="114" cy="24.2" r="1.3" fill="#fff" opacity=".85"/><circle cx="120" cy="24.2" r="1.3" fill="#fff" opacity=".85"/><circle cx="126" cy="24.2" r="1.3" fill="#fff" opacity=".85"/>')
    for x, y in ((99, 8), (114, 2), (126, 2), (141, 8)):
        b.append(f'<circle cx="{x}" cy="{y}" r="2.2" fill="#FFFBEF" stroke="#B8902E" stroke-width=".5"/>')
    b.append('<path d="M104,22L103,12" stroke="#fff" stroke-opacity=".6" stroke-width=".9" stroke-linecap="round"/>')
    glints = ''
    for (x, y, r, dl) in [(127, 4, 6, 0), (24, 112, 5.5, -1.4), (208, 80, 5, -2.6), (60, 210, 4.5, -.7)]:
        glints += (f'<g class="gl" style="animation-delay:{dl}s;transform-origin:{x}px {y}px">'
                   f'<circle cx="{x}" cy="{y}" r="{f(r)}" fill="url(#flash)" opacity=".7"/><path d="{star4(x, y, r, .14)}" fill="#FFFDF0"/></g>')
    b.append(glints)
    style = ('.gl{opacity:0;animation:gl 3.8s ease-in-out infinite}'
             '@keyframes gl{0%,62%,100%{opacity:0;transform:scale(.2) rotate(0)}75%{opacity:1;transform:scale(1) rotate(45deg)}88%{opacity:0;transform:scale(.3) rotate(90deg)}}')
    return svg(240, 240, defs, style, ''.join(b))


def frame_galaxy():
    rnd = random.Random(7)
    defs = (rad('neb1', [(0, '#8F6BFF', .75), (1, '#8F6BFF', 0)]) + rad('neb2', [(0, '#FF7AD9', .6), (1, '#FF7AD9', 0)])
            + rad('neb3', [(0, '#4FA3FF', .65), (1, '#4FA3FF', 0)]) + rad('neb4', [(0, '#C9A2FF', .6), (1, '#C9A2FF', 0)])
            + rad('planet', [(0, '#E4F7FF'), (.35, '#86B4FF'), (.75, '#5A47D4'), (1, '#24165E')], .5, .5, .5, .32, .28)
            + rad('moon', [(0, '#FBF9FF'), (.6, '#B9B2E6'), (1, '#6C64A6')], .5, .5, .5, .35, .3)
            + lin('ringp', [(0, '#FFE6F8'), (.5, '#C59BFF'), (1, '#7E6BFF')], 0, 0, 1, 0)
            + rad('comet', [(0, '#FFFFFF'), (.4, '#C9F1FF', .9), (1, '#6FD1FF', 0)])
            + '<clipPath id="pc"><circle cx="193.3" cy="32.7" r="17"/></clipPath>')
    b = ['<circle cx="120" cy="120" r="109" fill="none" stroke="#150F3A" stroke-opacity=".7" stroke-width="18"/>']
    blobs = ''
    for i in range(26):
        a = i * 360 / 26 + rnd.uniform(-6, 6)
        r = rnd.uniform(103, 115)
        x, y = pol(r, a)
        g = rnd.choice(['neb1', 'neb1', 'neb2', 'neb3', 'neb4'])
        blobs += f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(rnd.uniform(8, 15))}" fill="url(#{g})"/>'
    b.append(blobs)
    dots = ''
    for i in range(44):
        a = rnd.uniform(0, 360)
        x, y = pol(rnd.uniform(102, 118), a)
        dots += f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(rnd.uniform(.35, 1.05))}" opacity="{f(rnd.uniform(.5, 1))}"/>'
    b.append(f'<g fill="#fff">{dots}</g>')
    b.append('<circle cx="120" cy="120" r="101.3" fill="none" stroke="#E4DCFF" stroke-opacity=".75" stroke-width="1"/>')
    b.append('<ellipse cx="120" cy="120" rx="119" ry="119" fill="none" stroke="#B9A6FF" stroke-opacity=".28" stroke-width=".6" stroke-dasharray="2 4"/>')
    # comet on its orbit
    tail = [pol(118.5, -22 + 22 * i / 16) for i in range(17)]
    b.append(f'<g class="orbit"><path d="{tapered(tail, .4, 4.2)}" fill="#9FE3FF" opacity=".55"/>'
             f'<circle cx="{f(pol(118.5, 0)[0])}" cy="{f(pol(118.5, 0)[1])}" r="5.5" fill="url(#comet)"/>'
             f'<circle cx="{f(pol(118.5, 0)[0])}" cy="{f(pol(118.5, 0)[1])}" r="1.8" fill="#fff"/></g>')
    # moon, bottom left
    mx, my = pol(113, 138)
    b.append(f'<circle cx="{f(mx)}" cy="{f(my)}" r="10" fill="url(#moon)" stroke="#4B4380" stroke-opacity=".6" stroke-width=".6"/>'
             f'<circle cx="{f(mx + 2.8)}" cy="{f(my + 2)}" r="2.3" fill="#8E86C4" opacity=".7"/>'
             f'<circle cx="{f(mx - 3.4)}" cy="{f(my + 3.6)}" r="1.4" fill="#8E86C4" opacity=".7"/>'
             f'<circle cx="{f(mx - 1.5)}" cy="{f(my - 3.8)}" r="1.1" fill="#8E86C4" opacity=".6"/>')
    # ringed planet, top right (ring behind, planet, ring in front)
    px, py = 193.3, 32.7
    ring_back = f'M{f(px - 31)},{f(py)}A31,8.5 0 0 1 {f(px + 31)},{f(py)}'
    ring_front = f'M{f(px - 31)},{f(py)}A31,8.5 0 0 0 {f(px + 31)},{f(py)}'
    rot = f'rotate(-22 {px} {py})'
    b.append(f'<g transform="{rot}"><path d="{ring_back}" fill="none" stroke="url(#ringp)" stroke-width="3.4" opacity=".7"/>'
             f'<path d="{ring_back}" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width=".6" transform="translate(0 -2)"/></g>')
    b.append(f'<circle cx="{px}" cy="{py}" r="17" fill="url(#planet)"/>'
             f'<g clip-path="url(#pc)" opacity=".35"><path d="M{f(px - 20)},{f(py - 5)}Q{px},{f(py - 1)} {f(px + 20)},{f(py - 7)}" stroke="#E9F4FF" stroke-width="2.2" fill="none"/>'
             f'<path d="M{f(px - 20)},{f(py + 5)}Q{px},{f(py + 9)} {f(px + 20)},{f(py + 3)}" stroke="#C7B6FF" stroke-width="1.6" fill="none"/>'
             f'<circle cx="{f(px + 9)}" cy="{f(py + 9)}" r="17" fill="#120A3A" opacity=".9"/></g>'
             f'<circle cx="{px}" cy="{py}" r="17" fill="none" stroke="#2A1B6E" stroke-opacity=".6" stroke-width=".7"/>')
    b.append(f'<g transform="{rot}"><path d="{ring_front}" fill="none" stroke="url(#ringp)" stroke-width="3.6"/>'
             f'<path d="{ring_front}" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width=".6" transform="translate(0 1.6)"/></g>')
    tw = ''
    for (x, y, r, dl) in [(34, 30, 6, 0), (222, 140, 5, -1.1), (150, 226, 4.6, -2.2), (16, 96, 4.2, -.6), (96, 8, 4, -1.7)]:
        tw += (f'<g class="tw" style="animation-delay:{dl}s;transform-origin:{x}px {y}px">'
               f'<circle cx="{x}" cy="{y}" r="{f(r * .9)}" fill="#C9B6FF" opacity=".3"/><path d="{star4(x, y, r, .15)}" fill="#fff"/></g>')
    b.append(tw)
    style = (SPIN + TWINKLE + '.orbit{transform-origin:120px 120px;animation:spin 14s linear infinite}'
             '.tw{animation:tw 2.8s ease-in-out infinite}')
    return svg(240, 240, defs, style, ''.join(b))


FRAMES = {'sakura': frame_sakura, 'chakra': frame_chakra, 'spirit': frame_spirit, 'film': frame_film, 'spotlight': frame_spotlight,
          'premiere': frame_premiere, 'neon': frame_neon, 'gold': frame_gold, 'galaxy': frame_galaxy}


# ================================================================================================ NAMEPLATES (1200 x 220)
W, H = 1200, 220


def stars_field(rnd, n, x0, x1, y0, y1, rmin=.5, rmax=1.4, twinkle_every=4):
    out = ''
    for i in range(n):
        x, y = rnd.uniform(x0, x1), rnd.uniform(y0, y1)
        r = rnd.uniform(rmin, rmax)
        if i % twinkle_every == 0:
            out += f'<circle class="tw" cx="{f(x)}" cy="{f(y)}" r="{f(r)}" style="transform-origin:{f(x)}px {f(y)}px;animation-delay:-{f(rnd.uniform(0, 3))}s"/>'
        else:
            out += f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r)}" opacity="{f(rnd.uniform(.35, .9))}"/>'
    return out


def ridge(rnd, y_base, amp, x0=0, x1=W, step=40, rough=.5):
    pts = []
    x = x0
    while x <= x1 + step:
        pts.append((x, y_base - amp * (.5 + .5 * math.sin(x / 170 + rnd.uniform(0, .6))) * rnd.uniform(1 - rough, 1)))
        x += step
    return 'M' + f'{x0},{H}' + 'L' + 'L'.join(P(p) for p in pts) + f'L{x1 + step},{H}Z'


def np_sakura():
    rnd = random.Random(21)
    defs = (lin('sky', [(0, '#1C0A1D'), (.45, '#4C1B43'), (.78, '#B04F7C'), (1, '#F0A3C1')], 0, 0, 1, 0)
            + lin('shade', [(0, '#12050F', .55), (.4, '#12050F', 0), (1, '#2A0A22', .45)], 0, 0, 0, 1)
            + rad('moon', [(0, '#FFF6FA'), (.55, '#FFD7E6'), (1, '#FFB3CF')])
            + rad('halo', [(0, '#FFD3E4', .55), (1, '#FFD3E4', 0)])
            + lin('petal', [(0, '#EC5F93'), (.42, '#FFB3CB'), (1, '#FFF5F8')], 0, 1, 0, 0)
            + lin('petal2', [(0, '#F58AB0'), (1, '#FFE6EF')], 0, 1, 0, 0)
            + lin('bud', [(0, '#D93D78'), (1, '#FFB0CA')], 0, 1, 0, 0)
            + lin('bark', [(0, '#5A3428'), (1, '#24130E')], 0, 0, 1, 1)
            + lin('mist', [(0, '#FFE3EE', 0), (1, '#FFE3EE', .14)], 0, 0, 0, 1))
    b = [f'<rect width="{W}" height="{H}" fill="url(#sky)"/>',
         '<circle cx="1000" cy="78" r="120" fill="url(#halo)"/>',
         '<circle cx="1000" cy="78" r="40" fill="url(#moon)"/>']
    b.append(f'<path d="{ridge(rnd, 165, 55, 380, W, 50)}" fill="#7A2F5E" opacity=".55"/>')
    # pagoda on the far hill
    px, py = 1080, 150
    pag = ''
    for k, (w, y) in enumerate([(46, py), (38, py - 16), (31, py - 30), (25, py - 42), (19, py - 52)]):
        pag += f'M{f(px - w / 2)},{f(y)}Q{px},{f(y - 7)} {f(px + w / 2)},{f(y)}L{f(px + w / 2 - 6)},{f(y - 3)}L{f(px + w / 2 - 6)},{f(y - 12)}L{f(px - w / 2 + 6)},{f(y - 12)}L{f(px - w / 2 + 6)},{f(y - 3)}Z'
    pag += f'M{f(px - 1.2)},{f(py - 64)}L{f(px + 1.2)},{f(py - 64)}L{f(px + 1.2)},{f(py - 52)}L{f(px - 1.2)},{f(py - 52)}Z'
    b.append(f'<path d="{pag}" fill="#4A1840" opacity=".85"/>')
    b.append(f'<path d="{ridge(rnd, 200, 40, 0, W, 60)}" fill="#3A1236"/>')
    b.append(f'<rect width="{W}" height="{H}" fill="url(#shade)"/>')
    b.append(f'<rect y="150" width="{W}" height="70" fill="url(#mist)"/>')
    # branch from the top right corner
    main = [(1215 - 290 * t, -4 + 40 * t + 18 * math.sin(t * 3.2)) for t in [i / 40 for i in range(41)]]
    b.append(f'<path d="{tapered(main, 22, 5)}" fill="url(#bark)"/>')
    twigs = [((1120, 18), (1090, 64), 7), ((1040, 30), (1000, 8), 6), ((990, 48), (952, 82), 5), ((1160, 6), (1182, 52), 6)]
    for (x0, y0), (x1, y1), w in twigs:
        pts = [(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + 5 * math.sin(t * 3)) for t in [i / 10 for i in range(11)]]
        b.append(f'<path d="{tapered(pts, w, 1.6)}" fill="url(#bark)"/>')
    for (x, y, s, r) in [(1100, 30, 24, 10), (1088, 66, 19, -20), (1032, 40, 20, 30), (1000, 10, 16, 0), (950, 84, 17, 15),
                         (1180, 56, 18, 40), (1150, 22, 15, -10), (968, 52, 13, 25), (1060, 14, 13, 5), (920, 70, 11, 0)]:
        b.append(flower(x, y, s, r, rnd))
    for (x, y, s, r) in [(1125, 72, 11, 200), (1012, 66, 10, 160), (935, 98, 9, 190)]:
        b.append(bud(x, y, s, r))
    falls = ''
    for i in range(18):
        x = rnd.uniform(300, 1180) if i > 3 else rnd.uniform(60, 400)
        y = rnd.uniform(-20, 120)
        d = rnd.uniform(7, 12)
        dl = rnd.uniform(0, d)
        s = rnd.uniform(6, 10)
        falls += (f'<g transform="translate({f(x)} {f(y)})"><g class="fall" style="animation-duration:{f(d)}s;animation-delay:-{f(dl)}s">'
                  f'<g class="tum" style="animation-delay:-{f(rnd.uniform(0, 2))}s"><path d="{petal_d(s, s * .92)}" fill="url(#petal2)" opacity=".92"/></g></g></g>')
    b.append(falls)
    style = ('.fall{animation:fall 9s linear infinite}'
             '@keyframes fall{0%{transform:translate(0,0);opacity:0}8%{opacity:1}85%{opacity:1}100%{transform:translate(-140px,200px);opacity:0}}'
             '.tum{transform-box:fill-box;transform-origin:50% 50%;animation:tum 2s ease-in-out infinite alternate}'
             '@keyframes tum{from{transform:rotate(-40deg) scale(1,1)}to{transform:rotate(60deg) scale(.4,1)}}')
    return np_svg('sakura', '#1C0A1D', defs, style, ''.join(b))


def np_twilight():
    rnd = random.Random(31)
    defs = (lin('sky', [(0, '#100C2A'), (.45, '#2E1F57'), (.75, '#7A3F74'), (.9, '#E2795F'), (1, '#FFC18A')], 0, 0, 0, 1)
            + lin('left', [(0, '#0A0718', .75), (.55, '#0A0718', 0)], 0, 0, 1, 0)
            + rad('sun', [(0, '#FFE2B0', .95), (.4, '#FFB070', .55), (1, '#FF8A50', 0)]))
    b = [f'<rect width="{W}" height="{H}" fill="url(#sky)"/>', '<ellipse cx="980" cy="205" rx="260" ry="120" fill="url(#sun)"/>']
    b.append(f'<g fill="#FFF6E0">{stars_field(rnd, 46, 0, 1200, 4, 90, .5, 1.3)}</g>')
    mx, my = 780, 46
    b.append(f'<path d="M{mx},{my - 15}A15,15 0 1 0 {mx + 9},{my + 12}A12,12 0 1 1 {mx},{my - 15}Z" fill="#FFF1C9"/>'
             f'<circle cx="{mx - 2}" cy="{my}" r="24" fill="#FFF1C9" opacity=".08"/>')
    # far skyline
    far = ''
    x = 420
    while x < 1200:
        w = rnd.uniform(26, 58)
        h = rnd.uniform(40, 95)
        far += f'M{f(x)},{H}V{f(H - 30 - h)}H{f(x + w)}V{H}Z'
        x += w + rnd.uniform(-4, 6)
    b.append(f'<path d="{far}" fill="#3C2A5E"/>')
    # elevated railway with a train crossing
    b.append('<path d="M0,176H1200" stroke="#251A3F" stroke-width="5"/>')
    sup = ''.join(f'M{x},176V220' for x in range(20, 1200, 90))
    b.append(f'<path d="{sup}" stroke="#251A3F" stroke-width="6"/>')
    cars = ''
    for k in range(4):
        cx0 = 1260 + k * 66
        cars += f'<rect x="{cx0}" y="158" width="62" height="16" rx="5" fill="#20162F" stroke="#3E2D5C" stroke-width="1"/>'
        cars += ''.join(f'<rect x="{cx0 + 6 + j * 11}" y="162" width="7" height="5" rx="1" fill="#FFD98A"/>' for j in range(5))
    cars += '<path d="M1258,166Q1252,158 1262,158" fill="#20162F"/>'
    b.append(f'<g class="train">{cars}</g>')
    # near skyline with lit windows
    near = ''
    wins = ''
    tw = ''
    x = 300
    while x < 1205:
        w = rnd.uniform(30, 64)
        h = rnd.uniform(28, 82) * (.55 if x < 600 else 1)
        top = H - 18 - h
        near += f'M{f(x)},{H}V{f(top)}H{f(x + w)}V{H}Z'
        if rnd.random() < .3:
            near += f'M{f(x + w * .3)},{f(top)}V{f(top - 9)}H{f(x + w * .3 + 9)}V{f(top)}Z'
        if rnd.random() < .25:
            near += f'M{f(x + w * .7)},{f(top)}L{f(x + w * .7)},{f(top - 16)}L{f(x + w * .7 + 1.4)},{f(top - 16)}L{f(x + w * .7 + 1.4)},{f(top)}Z'
        if x > 520:
            cols = int((w - 8) // 9)
            rows = int((h - 6) // 11)
            for c in range(cols):
                for r_ in range(rows):
                    if rnd.random() < .34:
                        wx, wy = x + 6 + c * 9, top + 6 + r_ * 11
                        col = rnd.choice(['#FFCF70', '#FFE3A3', '#FFCF70', '#8FD3FF'])
                        if rnd.random() < .12:
                            tw += f'<rect class="win" x="{f(wx)}" y="{f(wy)}" width="4.4" height="5.6" fill="{col}" style="animation-delay:-{f(rnd.uniform(0, 7))}s"/>'
                        else:
                            wins += f'<rect x="{f(wx)}" y="{f(wy)}" width="4.4" height="5.6" fill="{col}" opacity="{f(rnd.uniform(.65, 1))}"/>'
        x += w + rnd.uniform(2, 8)
    b.append(f'<path d="{near}" fill="#170F2B"/>')
    b.append(wins + tw)
    b.append(f'<rect width="{W}" height="{H}" fill="url(#left)"/>')
    style = (TWINKLE + '.tw{animation:tw 3.2s ease-in-out infinite}'
             '.train{animation:train 18s linear infinite}@keyframes train{from{transform:translateX(0)}to{transform:translateX(-1700px)}}'
             '.win{animation:win 7s steps(1) infinite}@keyframes win{0%,45%{opacity:1}46%,100%{opacity:.12}}')
    return np_svg('twilight', '#0E0A22', defs, style, ''.join(b))


def np_noir():
    rnd = random.Random(41)
    defs = (lin('bg', [(0, '#0A0A0C'), (.6, '#1C1C21'), (1, '#2C2C33')], 0, 0, 1, 0)
            + rad('lamp', [(0, '#FFFDF2', .9), (.25, '#F2EEDC', .45), (1, '#F2EEDC', 0)])
            + lin('cone', [(0, '#F7F2DE', .4), (1, '#F7F2DE', 0)], 0, 0, 0, 1)
            + rad('vig', [(0, '#000', 0), (.7, '#000', .25), (1, '#000', .7)], .62, .5, .75))
    b = [f'<rect width="{W}" height="{H}" fill="url(#bg)"/>']
    # light through window blinds on the wall
    blinds = ''
    for k in range(7):
        y = 14 + k * 26
        blinds += f'M{760 + k * 6},{y}L1150,{y - 30}L1150,{y - 16}L{760 + k * 6},{y + 13}Z'
    b.append(f'<path d="{blinds}" fill="#EDE8D8" opacity=".09"/>')
    b.append('<path d="M760,14V196M1150,-16V166" stroke="#EDE8D8" stroke-opacity=".05" stroke-width="2"/>')
    # street lamp
    lx = 1040
    b.append(f'<path d="M{lx - 60},220L{lx},70L{lx + 60},220Z" fill="url(#cone)" opacity=".55"/>')
    b.append(f'<circle cx="{lx}" cy="66" r="70" fill="url(#lamp)"/>')
    b.append(f'<path d="M{lx - 3},70V220H{lx + 3}V70Z M{lx - 14},54H{lx + 14}L{lx + 9},70H{lx - 9}Z M{lx - 5},48H{lx + 5}L{lx + 3},54H{lx - 3}Z M{lx - 8},214H{lx + 8}V220H{lx - 8}Z" fill="#050506"/>')
    b.append(f'<path d="M{lx - 8},70H{lx + 8}L{lx + 6},74H{lx - 6}Z" fill="#FFFBEA"/>')
    # a figure in a fedora under the lamp
    fx_, fy_ = 1078, 220
    fig = (f'M{fx_ - 13},{fy_}L{fx_ - 15},{fy_ - 58}Q{fx_ - 16},{fy_ - 74} {fx_ - 8},{fy_ - 78}L{fx_ - 6},{fy_ - 86}'
           f'Q{fx_ - 9},{fy_ - 90} {fx_ - 5},{fy_ - 95}L{fx_ - 14},{fy_ - 96}Q{fx_ - 3},{fy_ - 99} {fx_ + 1},{fy_ - 106}'
           f'Q{fx_ + 6},{fy_ - 99} {fx_ + 16},{fy_ - 96}L{fx_ + 7},{fy_ - 95}Q{fx_ + 10},{fy_ - 90} {fx_ + 7},{fy_ - 86}L{fx_ + 9},{fy_ - 78}'
           f'Q{fx_ + 18},{fy_ - 74} {fx_ + 17},{fy_ - 58}L{fx_ + 14},{fy_}Z')
    b.append(f'<path d="{fig}" fill="#030304"/>')
    # rain
    for layer, (n, op, dur, ln) in enumerate([(70, .16, .9, 22), (40, .26, .7, 30)]):
        drops = ''
        for i in range(n):
            x, y = rnd.uniform(0, 1300), rnd.uniform(-60, 220)
            drops += f'M{f(x)},{f(y)}l{f(-ln * .28)},{f(ln)}'
        b.append(f'<g class="rain r{layer}"><path d="{drops}" stroke="#DCE3F0" stroke-opacity="{op}" stroke-width="1"/>'
                 f'<path d="{drops}" stroke="#DCE3F0" stroke-opacity="{op}" stroke-width="1" transform="translate(-61.6 -220)"/></g>')
    b.append(f'<rect width="{W}" height="{H}" fill="url(#vig)"/>')
    style = ('.rain{animation:rain .9s linear infinite}.r1{animation-duration:.65s}'
             '@keyframes rain{from{transform:translate(0,0)}to{transform:translate(61.6px,220px)}}')
    return np_svg('noir', '#0A0A0C', defs, style, ''.join(b))


def np_marquee():
    rnd = random.Random(51)
    defs = (lin('vel', [(0, '#2E040C'), (.55, '#6A0C1E'), (1, '#8E1428')], 0, 0, 1, 0)
            + lin('fold', [(0, '#000', .35), (.5, '#fff', .07), (1, '#000', .35)], 0, 0, 1, 0, extra=' spreadMethod="repeat"')
            + lin('trim', [(0, '#FFF0B8'), (.45, '#E1AE45'), (1, '#8A5C14')], 0, 0, 0, 1)
            + rad('bulbon', [(0, '#FFFFFF'), (.45, '#FFF0B0'), (1, '#F0B040')])
            + rad('halo', [(0, '#FFE08A', .75), (1, '#FFD36B', 0)])
            + lin('starg', [(0, '#FFF6D2'), (.5, '#F5C447'), (1, '#B3781C')], 0, 0, 1, 1)
            + '<pattern id="folds" width="54" height="220" patternUnits="userSpaceOnUse"><rect width="54" height="220" fill="url(#fold)"/></pattern>'
            + lin('left', [(0, '#12020A', .6), (.5, '#12020A', 0)], 0, 0, 1, 0))
    b = [f'<rect width="{W}" height="{H}" fill="url(#vel)"/>', f'<rect width="{W}" height="{H}" fill="url(#folds)" opacity=".7"/>']
    # art deco sunburst behind the star
    cx, cy = 1050, 110
    rays = ''
    for k in range(28):
        a0, a1 = k * 360 / 28, k * 360 / 28 + 6
        rays += f'M{cx},{cy}L{P(pol(260, a0, cx, cy))}L{P(pol(260, a1, cx, cy))}Z'
    b.append(f'<path d="{rays}" fill="#FFD36B" opacity=".08"/>')
    b.append(f'<circle cx="{cx}" cy="{cy}" r="48" fill="none" stroke="#FFD36B" stroke-opacity=".25" stroke-width="2"/>'
             f'<circle cx="{cx}" cy="{cy}" r="56" fill="none" stroke="#FFD36B" stroke-opacity=".15" stroke-width="1"/>')
    b.append(f'<path d="{star5(cx, cy, 36, .46)}" fill="#2A1404" opacity=".4" transform="translate(2 3)"/>'
             f'<path d="{star5(cx, cy, 36, .46)}" fill="url(#starg)" stroke="#7A4F12" stroke-width="1.4" stroke-linejoin="round"/>'
             f'<path d="{star5(cx, cy + 1, 20, .46)}" fill="#C8243C" stroke="#7E1022" stroke-width="1" stroke-linejoin="round"/>')
    for (sx, sy, r) in [(930, 70, 14), (1160, 150, 12), (950, 160, 9)]:
        b.append(f'<path d="{star5(sx, sy, r, .46)}" fill="url(#starg)" stroke="#7A4F12" stroke-width=".8" stroke-linejoin="round" opacity=".9"/>')
    # gold trim bands with bulbs
    for y in (8, 186):
        b.append(f'<rect y="{y}" width="{W}" height="26" fill="url(#trim)"/><rect y="{y + 4}" width="{W}" height="18" fill="#3A0610"/>'
                 f'<rect y="{y + 4}" width="{W}" height="18" fill="none" stroke="#FFE7A0" stroke-opacity=".5" stroke-width="1"/>')
        bulbs = ['', '', '']
        dim = ''
        for k, x in enumerate(range(14, 1200, 28)):
            dim += f'<circle cx="{x}" cy="{y + 13}" r="5" fill="#7A4A16" stroke="#3A2006" stroke-width=".6"/>'
            bulbs[k % 3] += f'<circle cx="{x}" cy="{y + 13}" r="12" fill="url(#halo)"/><circle cx="{x}" cy="{y + 13}" r="5" fill="url(#bulbon)"/>'
        b.append(dim)
        for k in range(3):
            b.append(f'<g class="ch c{k}">{bulbs[k]}</g>')
    b.append(f'<rect width="{W}" height="{H}" fill="url(#left)"/>')
    style = ('.ch{animation:ch 1.2s steps(1) infinite}.c1{animation-delay:-.4s}.c2{animation-delay:-.8s}'
             '@keyframes ch{0%{opacity:1}33.3%,100%{opacity:.18}}')
    return np_svg('marquee', '#2A040B', defs, style, ''.join(b))


def wave_path(y0, amp, lam, phase=0.0, x0=-10, x1=W + 400):
    pts = []
    x = x0
    while x <= x1:
        pts.append((x, y0 + amp * math.sin(2 * math.pi * x / lam + phase)))
        x += 12
    return 'M' + 'L'.join(P(p) for p in pts) + f'L{f(x1)},{H}L{f(x0)},{H}Z', 'M' + 'L'.join(P(p) for p in pts)


def np_ocean():
    rnd = random.Random(61)
    defs = (lin('sky', [(0, '#040B1E'), (.55, '#0B2350'), (1, '#24477F')], 0, 0, 0, 1)
            + lin('sea', [(0, '#0A2A55'), (1, '#03112A')], 0, 0, 0, 1)
            + rad('moon', [(0, '#FFFFFF'), (.7, '#E9F1FF'), (1, '#BFD3F5')])
            + rad('halo', [(0, '#BFD8FF', .5), (1, '#BFD8FF', 0)])
            + lin('left', [(0, '#020611', .7), (.5, '#020611', 0)], 0, 0, 1, 0))
    b = [f'<rect width="{W}" height="{H}" fill="url(#sky)"/>']
    b.append(f'<g fill="#EAF2FF">{stars_field(rnd, 60, 0, 1200, 4, 100, .4, 1.2)}</g>')
    b.append('<circle cx="930" cy="58" r="90" fill="url(#halo)"/><circle cx="930" cy="58" r="27" fill="url(#moon)"/>'
             '<circle cx="922" cy="52" r="4" fill="#C9D6EE" opacity=".6"/><circle cx="938" cy="66" r="3" fill="#C9D6EE" opacity=".5"/><circle cx="936" cy="48" r="2" fill="#C9D6EE" opacity=".5"/>')
    b.append(f'<rect y="118" width="{W}" height="102" fill="url(#sea)"/>')
    b.append('<path d="M0,118H1200" stroke="#5E86C6" stroke-opacity=".35" stroke-width="1"/>')
    # moonlight on the water
    glints = ['', '', '']
    for i in range(46):
        y = rnd.uniform(124, 214)
        spread = 14 + (y - 118) * .55
        x = 930 + rnd.uniform(-spread, spread)
        w = rnd.uniform(6, 22) * (1 - abs(x - 930) / (spread * 1.6))
        glints[i % 3] += f'<rect x="{f(x - w / 2)}" y="{f(y)}" width="{f(w)}" height="1.6" rx=".8"/>'
    for k in range(3):
        b.append(f'<g class="gl g{k}" fill="#EAF2FF">{glints[k]}</g>')
    # sailboat bobbing near the reflection
    boat = ('<g class="boat"><path d="M842,150L878,150L872,158H848Z" fill="#06142B"/>'
            '<path d="M860,149V112L882,147Z" fill="#0A1F3F"/><path d="M858,149V118L842,147Z" fill="#0A1F3F"/>'
            '<path d="M860,112V150" stroke="#06142B" stroke-width="1.6"/></g>')
    b.append(boat)
    for k, (y0, amp, lam, col, dur, op) in enumerate([(160, 4, 220, '#0E3A70', 9, .85), (182, 5, 260, '#0A2F5C', 12, .95), (204, 6, 300, '#072347', 15, 1)]):
        fill, line = wave_path(y0, amp, lam, k)
        b.append(f'<g class="wv" style="animation-duration:{dur}s;--l:-{lam}px"><path d="{fill}" fill="{col}" opacity="{op}"/>'
                 f'<path d="{line}" fill="none" stroke="#7FB8FF" stroke-opacity=".28" stroke-width="1.2"/></g>')
    b.append(f'<rect width="{W}" height="{H}" fill="url(#left)"/>')
    style = (TWINKLE + '.tw{animation:tw 3.4s ease-in-out infinite}'
             '.gl{animation:gl 1.8s ease-in-out infinite}.g1{animation-delay:-.6s}.g2{animation-delay:-1.2s}'
             '@keyframes gl{0%,100%{opacity:.25}50%{opacity:.95}}'
             '.wv{animation:wv 12s linear infinite}@keyframes wv{from{transform:translateX(0)}to{transform:translateX(var(--l))}}'
             '.boat{transform-box:fill-box;transform-origin:50% 100%;animation:boat 3.2s ease-in-out infinite alternate}'
             '@keyframes boat{from{transform:rotate(-3deg) translateY(0)}to{transform:rotate(3deg) translateY(2px)}}')
    return np_svg('ocean', '#030A1C', defs, style, ''.join(b))


def np_aurora():
    rnd = random.Random(71)
    defs = (lin('sky', [(0, '#020611'), (.6, '#06142B'), (1, '#0C2140')], 0, 0, 0, 1)
            + lin('a1', [(0, '#46FFB4', 0), (.55, '#46FFB4', .35), (1, '#C6FFE6', .85)], 0, 0, 0, 1)
            + lin('a2', [(0, '#3DE3FF', 0), (.55, '#3DE3FF', .3), (1, '#D2FAFF', .75)], 0, 0, 0, 1)
            + lin('a3', [(0, '#B47BFF', 0), (.6, '#B47BFF', .3), (1, '#F1E2FF', .6)], 0, 0, 0, 1)
            + '<pattern id="streak" width="9" height="220" patternUnits="userSpaceOnUse"><rect width="2.2" height="220" fill="#fff" opacity=".22"/><rect x="5" width="1" height="220" fill="#fff" opacity=".12"/></pattern>'
            + lin('snow', [(0, '#F4F9FF'), (1, '#AFC6E8')], 0, 0, 0, 1)
            + lin('left', [(0, '#01040C', .65), (.5, '#01040C', 0)], 0, 0, 1, 0))
    b = [f'<rect width="{W}" height="{H}" fill="url(#sky)"/>']
    b.append(f'<g fill="#EAF2FF">{stars_field(rnd, 90, 0, 1200, 2, 150, .35, 1.1, 5)}</g>')

    def curtain(x0, x1, ytop, ybot, amp, seed):
        r = random.Random(seed)
        ph1, ph2 = r.uniform(0, 6), r.uniform(0, 6)
        top, bot = [], []
        x = x0
        while x <= x1:
            k = (x - x0) / (x1 - x0)
            env = math.sin(math.pi * k)
            yb = ybot + amp * math.sin(x / 90 + ph1) + 8 * math.sin(x / 37 + ph2)
            yt = yb - (ybot - ytop) * (.45 + .55 * env) - 10 * math.sin(x / 55 + ph2)
            top.append((x, yt))
            bot.append((x, yb))
            x += 12
        return 'M' + 'L'.join(P(p) for p in top) + 'L' + 'L'.join(P(p) for p in bot[::-1]) + 'Z'
    for k, (x0, x1, yt, yb, amp, g, dur) in enumerate([(380, 1240, 10, 120, 16, 'a1', 11), (640, 1240, 0, 92, 12, 'a2', 14), (820, 1240, -10, 70, 10, 'a3', 9)]):
        d = curtain(x0, x1, yt, yb, amp, k + 3)
        b.append(f'<g class="cu u{k}" style="animation-duration:{dur}s"><path d="{d}" fill="url(#{g})"/><path d="{d}" fill="url(#streak)" opacity=".8"/></g>')
    # mountains with snow, and pines in front
    peaks = [(560, 162), (640, 128), (720, 150), (800, 112), (880, 146), (960, 104), (1040, 140), (1120, 118), (1200, 150)]
    m = f'M500,{H}L' + 'L'.join(f'{x},{y}' for x, y in peaks) + f'L1240,{H}Z'
    b.append(f'<path d="{m}" fill="#0E1D38"/>')
    snow = ''
    for i in range(1, len(peaks) - 1):
        x, y = peaks[i]
        if y < 150:
            (xl, yl), (xr, yr) = peaks[i - 1], peaks[i + 1]
            t = .28
            snow += (f'M{x},{y}L{f(x + (xl - x) * t)},{f(y + (yl - y) * t)}L{f(x + (xl - x) * t * .6)},{f(y + (yl - y) * t * .75)}'
                     f'L{f(x)},{f(y + (yl - y) * t * .9)}L{f(x + (xr - x) * t * .55)},{f(y + (yr - y) * t * .7)}L{f(x + (xr - x) * t)},{f(y + (yr - y) * t)}Z')
    b.append(f'<path d="{snow}" fill="url(#snow)" opacity=".9"/>')
    pines = ''
    x = 420
    while x < 1220:
        h = rnd.uniform(22, 42)
        w = h * .45
        base = H - rnd.uniform(0, 6)
        pines += f'M{f(x)},{f(base - h)}L{f(x + w / 2)},{f(base)}L{f(x - w / 2)},{f(base)}Z'
        x += rnd.uniform(9, 20)
    b.append(f'<path d="{pines}" fill="#03091A"/>')
    b.append(f'<rect width="{W}" height="{H}" fill="url(#left)"/>')
    style = (TWINKLE + '.tw{animation:tw 3.6s ease-in-out infinite}'
             '.cu{transform-box:fill-box;transform-origin:50% 100%;animation:cu 11s ease-in-out infinite alternate}'
             '.u1{animation-delay:-4s}.u2{animation-delay:-7s}'
             '@keyframes cu{0%{transform:translateX(-18px) skewX(4deg);opacity:.75}100%{transform:translateX(22px) skewX(-5deg);opacity:1}}')
    return np_svg('aurora', '#020611', defs, style, ''.join(b))


def flames_group(cx, base, w, hmax, seed, n=9):
    """Three flickering versions of a campfire flame (crossfaded)."""
    out = ''
    for k in range(3):
        r = random.Random(seed + k)
        layers = []
        for (scale, col, op) in [(1, '#E2471B', .95), (.72, '#FF9A2E', .95), (.42, '#FFE7A0', 1)]:
            d = ''
            for i in range(n):
                t = (i + .5) / n
                x = cx - w / 2 + w * t
                env = math.sin(math.pi * t) ** .8
                h = hmax * env * scale * r.uniform(.6, 1.05)
                bw = w / n * 1.5 * scale
                tipx = x + r.uniform(-8, 8)
                d += (f'M{f(x - bw)},{f(base)}C{f(x - bw)},{f(base - h * .5)} {f(tipx - 3)},{f(base - h * .7)} {f(tipx)},{f(base - h)}'
                      f'C{f(tipx + 3)},{f(base - h * .7)} {f(x + bw)},{f(base - h * .5)} {f(x + bw)},{f(base)}Z')
            layers.append(f'<path d="{d}" fill="{col}" opacity="{op}"/>')
        out += f'<g class="fl f{k}">{"".join(layers)}</g>'
    return out


def np_ember():
    rnd = random.Random(81)
    defs = (lin('bg', [(0, '#0B0505'), (.5, '#1E0907'), (1, '#320F09')], 0, 0, 1, 0)
            + rad('heat', [(0, '#FF6A1F', .6), (.5, '#E0360F', .22), (1, '#E0360F', 0)])
            + rad('emb', [(0, '#FFF6C8'), (.35, '#FFB040'), (1, '#FF5A14', 0)])
            + lin('log', [(0, '#3A1A0E'), (1, '#150805')], 0, 0, 0, 1)
            + lin('left', [(0, '#050202', .6), (.5, '#050202', 0)], 0, 0, 1, 0))
    b = [f'<rect width="{W}" height="{H}" fill="url(#bg)"/>', '<ellipse cx="1030" cy="230" rx="420" ry="150" fill="url(#heat)"/>']
    # smoke
    smoke = ''
    for k in range(3):
        x = 990 + k * 40
        smoke += (f'<path class="sm s{k}" d="M{x},150C{x - 30},120 {x + 30},90 {x},60S{x - 20},10 {x + 10},-20" fill="none" stroke="#A89A94" '
                  f'stroke-opacity=".09" stroke-width="{18 + k * 6}" stroke-linecap="round"/>')
    b.append(smoke)
    b.append(flames_group(1035, 206, 120, 120, 5))
    # logs and glowing cracks
    b.append('<path d="M960,214L1110,190L1116,204L966,228Z" fill="url(#log)"/><path d="M968,192L1112,222L1104,234L962,206Z" fill="url(#log)"/>'
             '<path d="M990,206L1020,200M1040,197L1070,193M1000,212L1030,218M1060,222L1086,228" stroke="#FF7A2F" stroke-width="1.6" stroke-linecap="round" class="glow"/>')
    coals = ''
    for i in range(14):
        x = rnd.uniform(965, 1105)
        y = rnd.uniform(214, 222)
        coals += f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="{f(rnd.uniform(4, 8))}" ry="{f(rnd.uniform(2, 3.5))}" fill="#FF6A1F" opacity="{f(rnd.uniform(.5, .9))}"/>'
    b.append(f'<g class="glow">{coals}</g>')
    embers = ''
    for i in range(46):
        near = i < 30
        x = rnd.uniform(980, 1100) if near else rnd.uniform(380, 1200)
        y = rnd.uniform(150, 220)
        d = rnd.uniform(3.5, 7)
        r = rnd.uniform(1, 2.6)
        embers += (f'<g transform="translate({f(x)} {f(y)})"><g class="up" style="animation-duration:{f(d)}s;animation-delay:-{f(rnd.uniform(0, d))}s">'
                   f'<circle r="{f(r * 2.6)}" fill="url(#emb)"/></g></g>')
    b.append(embers)
    b.append(f'<rect width="{W}" height="{H}" fill="url(#left)"/>')
    style = ('.fl{animation:fl 1.1s linear infinite;opacity:0}.f1{animation-delay:-.37s}.f2{animation-delay:-.74s}'
             '@keyframes fl{0%,28%{opacity:1}36%,92%{opacity:0}100%{opacity:1}}'
             '.up{animation:up 5s linear infinite}'
             '@keyframes up{0%{transform:translate(0,0);opacity:0}10%{opacity:1}70%{opacity:.9}100%{transform:translate(-90px,-210px);opacity:0}}'
             '.glow{animation:glow 2.4s ease-in-out infinite alternate}@keyframes glow{from{opacity:.55}to{opacity:1}}'
             '.sm{animation:sm 9s ease-in-out infinite alternate}.s1{animation-delay:-3s}.s2{animation-delay:-6s}'
             '@keyframes sm{from{transform:translate(0,0)}to{transform:translate(-30px,-14px)}}')
    return np_svg('ember', '#0B0505', defs, style, ''.join(b))


NAMEPLATES = {'sakura': np_sakura, 'twilight': np_twilight, 'noir': np_noir, 'marquee': np_marquee, 'ocean': np_ocean,
              'aurora': np_aurora, 'ember': np_ember}


# ================================================================================================ EFFECTS (2000 x 200)
EW, EH = 2000, 200


def fx_petals():
    rnd = random.Random(91)
    defs = (lin('p1', [(0, '#EC6A9C'), (1, '#FFE8F0')], 0, 1, 0, 0) + lin('p2', [(0, '#F7A1C0'), (1, '#FFF6F9')], 0, 1, 0, 0)
            + lin('p3', [(0, '#E0558C'), (1, '#FFC9DB')], 0, 1, 0, 0))
    out = ''
    for i in range(54):
        x, y = rnd.uniform(-40, EW + 40), rnd.uniform(-60, 40)
        depth = rnd.random()
        s = 9 + depth * 15
        d = 10 - depth * 3.5 + rnd.uniform(-1, 1)
        g = rnd.choice(['p1', 'p2', 'p3'])
        sway = rnd.choice(['sa', 'sb'])
        out += (f'<g transform="translate({f(x)} {f(y)})"><g class="fall {sway}" style="animation-duration:{f(d)}s;animation-delay:-{f(rnd.uniform(0, d))}s">'
                f'<g class="tum" style="animation-duration:{f(rnd.uniform(1.4, 2.6))}s;animation-delay:-{f(rnd.uniform(0, 2))}s">'
                f'<path d="{petal_d(s, s * .9)}" fill="url(#{g})" opacity="{f(.55 + depth * .45)}"/></g></g></g>')
    style = ('.fall{animation:fa 9s linear infinite}.sb{animation-name:fb}'
             '@keyframes fa{0%{transform:translate(0,0);opacity:0}8%{opacity:1}30%{transform:translate(28px,80px)}60%{transform:translate(-10px,160px)}88%{opacity:1}100%{transform:translate(20px,260px);opacity:0}}'
             '@keyframes fb{0%{transform:translate(0,0);opacity:0}8%{opacity:1}35%{transform:translate(-30px,90px)}65%{transform:translate(12px,170px)}88%{opacity:1}100%{transform:translate(-18px,260px);opacity:0}}'
             '.tum{transform-box:fill-box;transform-origin:50% 50%;animation:tum 2s ease-in-out infinite alternate}'
             '@keyframes tum{from{transform:rotate(-50deg) scale(1,1)}to{transform:rotate(70deg) scale(.35,1)}}')
    return svg(EW, EH, defs, style, out)


def fx_sparkles():
    rnd = random.Random(92)
    defs = rad('gl', [(0, '#FFF4C8', .85), (1, '#FFE08A', 0)])
    out = ''
    for i in range(40):
        x, y = rnd.uniform(20, EW - 20), rnd.uniform(14, EH - 14)
        r = rnd.uniform(9, 19)
        col = rnd.choice(['#FFFFFF', '#FFF2B8', '#FFE08A', '#FFFFFF'])
        d = rnd.uniform(2.6, 4.2)
        out += (f'<g class="sp" style="transform-origin:{f(x)}px {f(y)}px;animation-duration:{f(d)}s;animation-delay:-{f(rnd.uniform(0, d))}s">'
                f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r * 1.2)}" fill="url(#gl)"/><path d="{star4(x, y, r, .13)}" fill="{col}"/>'
                f'<path d="{star4(x, y, r * .45, .2)}" fill="#fff" transform="rotate(45 {f(x)} {f(y)})"/></g>')
    dots = ''
    for i in range(70):
        x, y = rnd.uniform(0, EW), rnd.uniform(0, EH)
        dots += f'<circle class="dt" cx="{f(x)}" cy="{f(y)}" r="{f(rnd.uniform(.8, 1.8))}" style="transform-origin:{f(x)}px {f(y)}px;animation-delay:-{f(rnd.uniform(0, 3))}s"/>'
    style = ('.sp{opacity:0;animation:sp 3.4s ease-in-out infinite}'
             '@keyframes sp{0%,100%{opacity:0;transform:scale(0) rotate(0)}45%{opacity:1;transform:scale(1) rotate(30deg)}70%{opacity:.6;transform:scale(.7) rotate(60deg)}90%{opacity:0;transform:scale(.1) rotate(90deg)}}'
             '.dt{animation:dt 3s ease-in-out infinite}@keyframes dt{0%,100%{opacity:0}50%{opacity:.9}}')
    return svg(EW, EH, defs, style, out + f'<g fill="#FFF6D6">{dots}</g>')


def fx_stars():
    rnd = random.Random(93)
    defs = (lin('tail', [(0, '#FFFFFF', 0), (1, '#FFFFFF', .95)], 0, 0, 1, 0) + rad('head', [(0, '#FFFFFF'), (.4, '#DDF1FF', .8), (1, '#9FD4FF', 0)]))
    dots = stars_field(rnd, 190, 0, EW, 0, EH, .7, 2.1, 3)
    big = ''
    for i in range(12):
        x, y = rnd.uniform(20, EW - 20), rnd.uniform(10, EH - 10)
        r = rnd.uniform(6, 10)
        big += (f'<g class="bs" style="transform-origin:{f(x)}px {f(y)}px;animation-delay:-{f(rnd.uniform(0, 4))}s">'
                f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r)}" fill="#BFE3FF" opacity=".25"/><path d="{star4(x, y, r, .14)}" fill="#fff"/></g>')
    shoot = ''
    for i, (x, y, dl) in enumerate([(380, 20, 0), (1250, 10, -2.4), (820, 40, -4.6), (1700, 30, -6.2)]):
        shoot += (f'<g transform="translate({x} {y}) rotate(28)"><g class="sh" style="animation-delay:{dl}s">'
                  f'<rect x="-170" y="-1.4" width="170" height="2.8" rx="1.4" fill="url(#tail)"/><circle r="5" fill="url(#head)"/></g></g>')
    style = (TWINKLE + '.tw{animation:tw 3s ease-in-out infinite}'
             '.bs{animation:bs 4s ease-in-out infinite}@keyframes bs{0%,100%{opacity:.2;transform:scale(.5) rotate(0)}50%{opacity:1;transform:scale(1) rotate(45deg)}}'
             '.sh{opacity:0;animation:sh 8s ease-in infinite}'
             '@keyframes sh{0%,82%{opacity:0;transform:translateX(0)}84%{opacity:1}96%{opacity:1}100%{opacity:0;transform:translateX(420px)}}')
    return svg(EW, EH, defs, style, f'<g fill="#F2F7FF">{dots}</g>{big}{shoot}')


def fx_embers():
    rnd = random.Random(94)
    defs = (rad('emb', [(0, '#FFF6C8'), (.3, '#FFC04A'), (.65, '#FF6A1A', .6), (1, '#FF4A0A', 0)])
            + lin('heat', [(0, '#FF5A14', 0), (1, '#FF5A14', .22)], 0, 0, 0, 1))
    out = f'<rect y="120" width="{EW}" height="80" fill="url(#heat)"/>'
    for i in range(72):
        x, y = rnd.uniform(-20, EW + 20), rnd.uniform(170, 230)
        r = rnd.uniform(2.2, 5.2)
        d = rnd.uniform(4.5, 8.5)
        dr = rnd.choice(['ua', 'ub'])
        out += (f'<g transform="translate({f(x)} {f(y)})"><g class="up {dr}" style="animation-duration:{f(d)}s;animation-delay:-{f(rnd.uniform(0, d))}s">'
                f'<g class="fk" style="animation-delay:-{f(rnd.uniform(0, 1))}s"><circle r="{f(r * 2.4)}" fill="url(#emb)"/></g></g></g>')
    style = ('.up{animation:ua 6s linear infinite}.ub{animation-name:ub}'
             '@keyframes ua{0%{transform:translate(0,0);opacity:0}10%{opacity:1}50%{transform:translate(-26px,-110px)}80%{opacity:.8}100%{transform:translate(10px,-240px);opacity:0}}'
             '@keyframes ub{0%{transform:translate(0,0);opacity:0}10%{opacity:1}50%{transform:translate(24px,-120px)}80%{opacity:.8}100%{transform:translate(-14px,-240px);opacity:0}}'
             '.fk{animation:fk .8s ease-in-out infinite alternate}@keyframes fk{from{opacity:.55}to{opacity:1}}')
    return svg(EW, EH, defs, style, out)


EFFECTS = {'petals': fx_petals, 'sparkles': fx_sparkles, 'stars': fx_stars, 'embers': fx_embers}


if __name__ == '__main__':
    for kind, items in (('frames', FRAMES), ('nameplates', NAMEPLATES), ('effects', EFFECTS)):
        for name, make in items.items():
            text = make()
            write(kind, name, text)
            print(f'{kind}/{name}.svg  {len(text) / 1024:.1f} KB')
    # the nameplate background colours, for src/styles.css
    for name, color in EDGE.items():
        print(f'.np-{name} {{ background: {color} url(/deco/nameplates/{name}.svg) right center / auto 100% no-repeat; }}')
