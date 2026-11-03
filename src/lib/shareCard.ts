/** Draws someone's profile card to download or share: an animated GIF when any of their decorations move,
 *  otherwise a still PNG (1200 x 630). */
import { BADGES } from './badges';
import { ICON_PATHS } from '../components/Icon';
import { NAME_COLORS, NAME_FONTS, NAMEPLATE_EDGE, PFRAME_COLORS, PFRAMES, FRAMES } from './decorations';
import { BANNER_RE, discordPlate, DPLATE_RE } from './profile';
import { GifWriter } from './gif';
import type { Profile } from './profile';
import type { WatchStats } from './stats';

const W = 1200;
const H = 630;
const GIF_SCALE = 0.75; // the GIF is 900 x 473 to keep the file a sensible size
const FPS = 12.5;
const SECONDS = 4;

export interface CardResult {
  blob: Blob;
  animated: boolean;
}

/* ---------------- loading pictures ---------------- */

type Src = CanvasImageSource;

function loadOne(src: string, cors: boolean): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const im = new Image();
    if (cors) im.crossOrigin = 'anonymous';
    im.onload = () => resolve(im.naturalWidth ? im : null);
    im.onerror = () => resolve(null); // a picture that can't be used just gets left out
    im.src = src;
  });
}
const relay = (src: string) => `/api/account?action=img&u=${encodeURIComponent(src)}`;
/** Pictures from this site load directly. Pictures from elsewhere (TMDB, AniList, Discord) come through the site's
 *  own image relay, since a canvas can't be saved with a picture another site didn't allow. */
async function loadImg(src: string): Promise<HTMLImageElement | null> {
  if (!src) return null;
  if (src.startsWith('/') || src.startsWith('data:')) return loadOne(src, false);
  const viaSite = await loadOne(relay(src), false);
  if (viaSite) return viaSite;
  const sep = src.includes('?') ? '&' : '?';
  return loadOne(`${src}${sep}cv=1`, true); // the extra bit skips a cached copy saved without permission
}
const iconImg = (name: keyof typeof ICON_PATHS, color: string) =>
  loadImg(
    'data:image/svg+xml;charset=utf-8,' +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[name]}</svg>`
      )
  );

/** A picture that may move: at(t) gives what it looks like t seconds in. */
interface Layer {
  animated: boolean;
  at(t: number): Promise<Src | null>;
  close?(): void;
}
const none: Layer = { animated: false, at: async () => null };
const still = (im: Src | null): Layer => ({ animated: false, at: async () => im });

/** Comvie's decoration artwork. Its animations are plain CSS, so each frame is the same file with every animation
 *  paused at that moment. */
async function svgLayer(src: string): Promise<Layer> {
  if (!src) return none;
  let text = '';
  try {
    const r = await fetch(src);
    if (r.ok) text = await r.text();
  } catch {
    /* left out below */
  }
  if (!text.includes('<svg')) return none;
  const animated = /animation:[A-Za-z_-][\w-]* [\d.]+s/.test(text);
  const shifted = (t: number) =>
    text
      .replace(/animation:([A-Za-z_-][\w-]*) ([\d.]+)s/g, (_m, n, d) => `animation:${n} ${d}s ${(-t).toFixed(3)}s`)
      .replace(/animation-delay:(-?[\d.]+)s/g, (_m, v) => `animation-delay:${(Number(v) - t).toFixed(3)}s`)
      .replace(/<\/svg>\s*$/, '<style>*{animation-play-state:paused!important}</style></svg>');
  const cache = new Map<number, HTMLImageElement | null>();
  return {
    animated,
    at: async (t) => {
      const k = animated ? Math.round(t * 1000) : 0;
      if (!cache.has(k)) {
        cache.clear(); // one frame at a time is all that's needed
        cache.set(k, await loadOne('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(shifted(animated ? t : 0)), false));
      }
      return cache.get(k) ?? null;
    }
  };
}

/** A GIF or animated PNG from Discord (avatar decorations, animated banners), split into its frames where the
 *  browser can, otherwise drawn still. */
async function rasterLayer(src: string): Promise<Layer> {
  if (!src) return none;
  const Decoder = (window as any).ImageDecoder;
  if (Decoder) {
    try {
      const r = await fetch(relay(src));
      const type = r.headers.get('content-type') || '';
      if (r.ok && (await Decoder.isTypeSupported(type))) {
        const dec = new Decoder({ data: await r.arrayBuffer(), type });
        await dec.tracks.ready;
        const n = Math.min(240, dec.tracks.selectedTrack?.frameCount ?? 1);
        if (n > 1) {
          const frames: { img: any; end: number }[] = [];
          let total = 0;
          for (let i = 0; i < n; i++) {
            const { image } = await dec.decode({ frameIndex: i });
            total += Math.max(20, (image.duration ?? 100000) / 1000);
            frames.push({ img: image, end: total });
          }
          dec.close();
          return {
            animated: true,
            at: async (t) => {
              const ms = (t * 1000) % total;
              return (frames.find((f) => ms < f.end) ?? frames[frames.length - 1]).img;
            },
            close: () => frames.forEach((f) => f.img.close?.())
          };
        }
        dec.close();
      }
    } catch (e) {
      console.warn('[share card] frames', e);
    }
  }
  return still(await loadImg(src));
}

/** A Discord nameplate's looping video, stepped to each moment; its still picture if the video can't be used. */
async function videoLayer(video: string, fallback: string): Promise<Layer> {
  const v = document.createElement('video');
  v.muted = true;
  v.playsInline = true;
  v.preload = 'auto';
  const ok = await new Promise<boolean>((resolve) => {
    const t = window.setTimeout(() => resolve(false), 8000);
    v.onloadeddata = () => { window.clearTimeout(t); resolve(true); };
    v.onerror = () => { window.clearTimeout(t); resolve(false); };
    v.src = relay(video);
  });
  if (!ok || !v.duration || !isFinite(v.duration)) return still(await loadImg(fallback));
  return {
    animated: true,
    at: (t) =>
      new Promise((resolve) => {
        const to = window.setTimeout(() => resolve(v), 1500);
        v.onseeked = () => { window.clearTimeout(to); resolve(v); };
        v.currentTime = t % v.duration;
      }),
    close: () => v.removeAttribute('src')
  };
}

/* ---------------- drawing ---------------- */

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
const dims = (im: Src) => {
  const a = im as any;
  return { w: a.naturalWidth || a.videoWidth || a.displayWidth || a.width, h: a.naturalHeight || a.videoHeight || a.displayHeight || a.height };
};
function cover(ctx: CanvasRenderingContext2D, im: Src, x: number, y: number, w: number, h: number, alignRight = false) {
  const d = dims(im);
  if (!d.w || !d.h) return;
  const s = Math.max(w / d.w, h / d.h);
  const dw = d.w * s;
  const dh = d.h * s;
  ctx.drawImage(im, alignRight ? x + w - dw : x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

export async function renderProfileCard(p: Profile, stats: WatchStats, badges: string[], onProgress?: (p: number) => void): Promise<CardResult> {
  const deco = p.deco || {};
  const name = '@' + (p.username || 'comvie');
  const font = NAME_FONTS.find((x) => x.id === deco.nameFont);
  const family = font?.family || "'Fredoka', sans-serif";
  if (font?.google && !document.querySelector(`link[data-cvfont="${font.id}"]`)) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.dataset.cvfont = font.id;
    l.href = `https://fonts.googleapis.com/css2?family=${font.google}&display=swap`;
    document.head.appendChild(l);
  }
  const myBadges = BADGES.filter((x) => badges.includes(x.id));
  const hasPf = !!deco.pframe && PFRAMES.some((f) => f.id === deco.pframe);
  const bannerSrc = deco.banner && BANNER_RE.test(deco.banner) ? deco.banner : '';
  const frameId = !deco.discord && deco.frame && FRAMES.some((f) => f.id === deco.frame) ? deco.frame : '';
  const dplate = deco.dplate && DPLATE_RE.test(deco.dplate) ? discordPlate(deco.dplate) : null;

  // start every download at once
  const [banner, plate, effect, picIm, avDeco, badgeIms, corners] = await Promise.all([
    bannerSrc ? rasterLayer(bannerSrc) : Promise.resolve(none),
    dplate ? videoLayer(dplate.video, dplate.img) : deco.nameplate ? svgLayer(`/deco/nameplates/${deco.nameplate}.svg`) : Promise.resolve(none),
    deco.effect ? svgLayer(`/deco/effects/${deco.effect}.svg`) : Promise.resolve(none),
    loadImg(p.avatar?.url || ''),
    deco.discord ? rasterLayer(deco.discord) : frameId ? svgLayer(`/deco/frames/${frameId}.svg`) : Promise.resolve(none),
    Promise.all(myBadges.map((b) => iconImg(b.icon, b.color))),
    Promise.all((['tl', 'tr', 'bl', 'br'] as const).map((c) => (hasPf ? svgLayer(`/deco/pframes/${deco.pframe}-${c}.svg`) : Promise.resolve(none)))),
    Promise.all([document.fonts.load(`700 64px ${family}`), document.fonts.load(`800 22px 'Nunito'`), document.fonts.load(`600 30px 'Fredoka'`)]).catch(() => undefined)
  ]);
  const layers = [banner, plate, effect, avDeco, ...corners];
  const animated = layers.some((l) => l.animated);
  const bannerStill = await banner.at(0);

  const cx = 56, cy = 56, cw = W - 112, ch = H - 112, cr = 30;
  const bh = bannerStill ? 200 : 0; // banner height
  const hy = cy + bh; // top of the part under the banner
  const hh = ch - bh;
  const as = 168;
  const ax = cx + 56;
  const ay = bannerStill ? hy - 64 : cy + 104;
  const mid = { x: ax + as / 2, y: ay + as / 2 };

  const draw = async (ctx: CanvasRenderingContext2D, t: number) => {
    const [bannerIm, plateIm, effectIm, decoIm, ...cornerIms] = await Promise.all(layers.map((l) => l.at(t)));

    ctx.fillStyle = '#120C18';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    rounded(ctx, cx, cy, cw, ch, cr);
    ctx.clip();
    ctx.fillStyle = (deco.nameplate && !dplate && NAMEPLATE_EDGE[deco.nameplate]) || '#1d1424';
    ctx.fillRect(cx, cy, cw, ch);

    // banner
    if (bannerIm) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(cx, cy, cw, bh);
      ctx.clip();
      cover(ctx, bannerIm, cx, cy, cw, bh);
      ctx.restore();
    }

    // nameplate behind the name area, like on the site
    if (plateIm) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(cx, hy, cw, hh);
      ctx.clip();
      if (dplate) cover(ctx, plateIm, cx, hy, cw, hh, true);
      else {
        const d = dims(plateIm);
        const w = (d.w / d.h) * hh;
        ctx.drawImage(plateIm, cx + cw - w, hy, w, hh);
      }
      ctx.restore();
    }
    const shade = ctx.createLinearGradient(cx, 0, cx + cw, 0);
    shade.addColorStop(0, 'rgba(10,6,14,.72)');
    shade.addColorStop(.5, 'rgba(10,6,14,.38)');
    shade.addColorStop(1, 'rgba(10,6,14,.08)');
    ctx.fillStyle = shade;
    ctx.fillRect(cx, hy, cw, hh);

    // profile decoration over the name area
    if (effectIm) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(cx, hy, cw, hh);
      ctx.clip();
      cover(ctx, effectIm, cx, hy, cw, hh);
      ctx.restore();
    }
    ctx.restore();

    // border (the profile frame's colours, or a soft line)
    const cols = (hasPf && PFRAME_COLORS[deco.pframe!]) || ['rgba(255,233,214,.25)', 'rgba(255,233,214,.12)'];
    const g = ctx.createLinearGradient(cx, cy, cx + cw, cy + ch);
    cols.forEach((c, i) => g.addColorStop(i / Math.max(1, cols.length - 1), c));
    rounded(ctx, cx, cy, cw, ch, cr);
    ctx.lineWidth = hasPf ? 6 : 2;
    ctx.strokeStyle = g;
    ctx.stroke();

    // picture with its avatar decoration; it sits over the banner's lower edge when there is one
    if (bannerIm) {
      ctx.beginPath();
      ctx.arc(mid.x, mid.y, as / 2 + 7, 0, Math.PI * 2);
      ctx.fillStyle = '#1d1424';
      ctx.fill();
    }
    ctx.save();
    ctx.beginPath();
    ctx.arc(mid.x, mid.y, as / 2, 0, Math.PI * 2);
    ctx.clip();
    if (picIm) {
      cover(ctx, picIm, ax, ay, as, as);
    } else {
      ctx.fillStyle = p.avatar?.color || '#ff6b57';
      ctx.fillRect(ax, ay, as, as);
      ctx.fillStyle = '#1a0d0a';
      ctx.font = `900 ${as * .45}px 'Nunito', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((p.username || '?').charAt(0).toUpperCase(), mid.x, mid.y + 5);
    }
    ctx.restore();
    if (decoIm) ctx.drawImage(decoIm, ax - as * .1, ay - as * .1, as * 1.2, as * 1.2);

    // name in its colour and font, with badge icons beside it
    const tx = ax + as + 40;
    const room = cx + cw - 44 - tx;
    const bs = 40, bgap = 10;
    const badgeW = myBadges.length ? myBadges.length * (bs + bgap) + 8 : 0;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    let size = 64;
    const setFont = () => (ctx.font = `700 ${size}px ${family}`);
    setFont();
    while (ctx.measureText(name).width > room - Math.min(badgeW, room * .45) && size > 30) {
      size -= 4;
      setFont();
    }
    const ny = bannerIm ? hy + 74 : mid.y + size * .34;
    const nw = ctx.measureText(name).width;
    const color = NAME_COLORS.find((x) => x.id === deco.nameColor);
    const hexes = color ? color.css.match(/#[0-9a-fA-F]{6}/g) || [] : [];
    if (hexes.length > 1) {
      const ng = ctx.createLinearGradient(tx, 0, tx + nw, 0);
      hexes.forEach((c, i) => ng.addColorStop(i / (hexes.length - 1), c));
      ctx.fillStyle = ng;
    } else {
      ctx.fillStyle = hexes[0] || '#ffffff';
    }
    ctx.shadowColor = 'rgba(0,0,0,.6)';
    ctx.shadowBlur = 10;
    ctx.fillText(name, tx, ny);
    ctx.shadowBlur = 0;

    // badges: the same round icons as on the site
    const inline = tx + nw + 18 + badgeW <= cx + cw - 30;
    let bx = inline ? tx + nw + 18 : tx;
    const by = inline ? ny - size * .36 - bs / 2 : ny + 18;
    myBadges.forEach((b, i) => {
      if (bx + bs > cx + cw - 30) return;
      ctx.beginPath();
      ctx.arc(bx + bs / 2, by + bs / 2, bs / 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(18,12,24,.82)';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = b.color;
      ctx.stroke();
      const im = badgeIms[i];
      if (im) ctx.drawImage(im, bx + bs * .22, by + bs * .22, bs * .56, bs * .56);
      bx += bs + bgap;
    });

    // stats
    const tiles: [string, string][] = [
      [`${stats.hours}`, 'hours watched'],
      [`${stats.movies}`, 'movies'],
      [`${stats.episodes + stats.animeEpisodes}`, 'episodes'],
      [`${stats.bestStreak}`, 'best day streak']
    ];
    const sy = cy + ch - 146, sw = (cw - 112) / 4;
    tiles.forEach(([n, l], i) => {
      const x = cx + 56 + i * sw;
      rounded(ctx, x, sy, sw - 16, 92, 18);
      ctx.fillStyle = 'rgba(18,12,24,.66)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,233,214,.14)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#FFF3E8';
      ctx.font = `600 40px 'Fredoka', sans-serif`;
      ctx.fillText(n, x + 20, sy + 48);
      ctx.fillStyle = 'rgba(255,233,214,.7)';
      ctx.font = `700 19px 'Nunito', sans-serif`;
      ctx.fillText(l, x + 20, sy + 76);
    });

    // footer
    ctx.font = `600 26px 'Fredoka', sans-serif`;
    ctx.fillStyle = '#ff9a2e';
    ctx.fillText('comvie', cx + 56, cy + ch - 22);
    ctx.fillStyle = 'rgba(255,233,214,.75)';
    ctx.font = `700 22px 'Nunito', sans-serif`;
    const link = p.is_public && p.username ? `comvie.lol/u/${p.username}` : 'comvie.lol';
    ctx.textAlign = 'right';
    ctx.fillText(link, cx + cw - 44, cy + ch - 22);
    ctx.textAlign = 'left';

    // profile frame corners on top
    if (hasPf) {
      const fs = 210;
      const off = fs * .2;
      const spots: [number, number][] = [[cx - off, cy - off], [cx + cw - fs + off, cy - off], [cx - off, cy + ch - fs + off], [cx + cw - fs + off, cy + ch - fs + off]];
      spots.forEach(([x, y], i) => cornerIms[i] && ctx.drawImage(cornerIms[i]!, x, y, fs, fs));
    }
  };

  try {
    if (!animated) {
      const cv = document.createElement('canvas');
      cv.width = W;
      cv.height = H;
      const ctx = cv.getContext('2d')!;
      await draw(ctx, 0);
      onProgress?.(1);
      const blob = await new Promise<Blob>((resolve, reject) => cv.toBlob((b) => (b ? resolve(b) : reject(new Error('no picture'))), 'image/png'));
      return { blob, animated: false };
    }

    // animated: draw each moment and add it to the GIF as it's made
    const gw = Math.round(W * GIF_SCALE), gh = Math.round(H * GIF_SCALE);
    const cv = document.createElement('canvas');
    cv.width = gw;
    cv.height = gh;
    const ctx = cv.getContext('2d', { willReadFrequently: true })!;
    ctx.setTransform(GIF_SCALE, 0, 0, GIF_SCALE, 0, 0);
    const frame = async (t: number) => {
      await draw(ctx, t);
      return ctx.getImageData(0, 0, gw, gh).data;
    };
    const count = Math.round(FPS * SECONDS);
    // a few moments spread over the loop choose the colours
    const samples = [];
    for (const t of [0, SECONDS * .25, SECONDS * .5, SECONDS * .75]) samples.push(await frame(t));
    const gif = new GifWriter(gw, gh, Math.round(100 / FPS), samples);
    for (let i = 0; i < count; i++) {
      gif.add(await frame(i / FPS));
      onProgress?.((i + 1) / count);
      await new Promise((r) => setTimeout(r, 0)); // keep the page responsive
    }
    return { blob: gif.finish(), animated: true };
  } finally {
    layers.forEach((l) => l.close?.());
  }
}
