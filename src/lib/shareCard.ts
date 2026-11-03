/** Draws someone's profile card as a picture (1200 x 630) to download or share. */
import { BADGES } from './badges';
import { NAME_COLORS, NAME_FONTS, NAMEPLATE_EDGE, PFRAME_COLORS, PFRAMES, FRAMES } from './decorations';
import { BANNER_RE, discordPlate, DPLATE_RE } from './profile';
import type { Profile } from './profile';
import type { WatchStats } from './stats';

const W = 1200;
const H = 630;

function loadImg(src: string, cors: boolean): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const im = new Image();
    if (cors) im.crossOrigin = 'anonymous';
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null); // a picture that can't be used just gets left out
    im.src = src;
  });
}
const sameOrigin = (src: string) => src.startsWith('/');

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function cover(ctx: CanvasRenderingContext2D, im: HTMLImageElement, x: number, y: number, w: number, h: number, alignRight = false) {
  const s = Math.max(w / im.naturalWidth, h / im.naturalHeight);
  const dw = im.naturalWidth * s;
  const dh = im.naturalHeight * s;
  ctx.drawImage(im, alignRight ? x + w - dw : x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

export async function renderProfileCard(p: Profile, stats: WatchStats, badges: string[]): Promise<Blob> {
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d')!;
  const deco = p.deco || {};
  const name = '@' + (p.username || 'comvie');
  const font = NAME_FONTS.find((x) => x.id === deco.nameFont);
  const family = font?.family || "'Fredoka', sans-serif";
  try {
    await Promise.all([document.fonts.load(`700 72px ${family}`), document.fonts.load(`800 26px 'Nunito'`), document.fonts.load(`600 30px 'Fredoka'`)]);
  } catch {
    /* fonts are a nice-to-have */
  }

  // page background
  ctx.fillStyle = '#120C18';
  ctx.fillRect(0, 0, W, H);
  const cx = 56, cy = 56, cw = W - 112, ch = H - 112, cr = 30;

  // card background: banner, Discord nameplate, Comvie nameplate, or plain
  ctx.save();
  rounded(ctx, cx, cy, cw, ch, cr);
  ctx.clip();
  ctx.fillStyle = (deco.nameplate && NAMEPLATE_EDGE[deco.nameplate]) || '#1d1424';
  ctx.fillRect(cx, cy, cw, ch);
  let bg: HTMLImageElement | null = null;
  if (deco.banner && BANNER_RE.test(deco.banner)) bg = await loadImg(deco.banner, true);
  if (bg) {
    cover(ctx, bg, cx, cy, cw, ch);
  } else if (deco.dplate && DPLATE_RE.test(deco.dplate)) {
    const im = await loadImg(discordPlate(deco.dplate).img, true);
    if (im) cover(ctx, im, cx, cy, cw, ch);
  } else if (deco.nameplate) {
    const im = await loadImg(`/deco/nameplates/${deco.nameplate}.svg`, false);
    if (im) {
      const h = ch;
      const w = (im.naturalWidth / im.naturalHeight) * h;
      ctx.drawImage(im, cx + cw - w, cy, w, h);
    }
  }
  const shade = ctx.createLinearGradient(cx, 0, cx + cw, 0);
  shade.addColorStop(0, 'rgba(10,6,14,.82)');
  shade.addColorStop(.55, 'rgba(10,6,14,.45)');
  shade.addColorStop(1, 'rgba(10,6,14,.15)');
  ctx.fillStyle = shade;
  ctx.fillRect(cx, cy, cw, ch);
  ctx.restore();

  // border (the profile frame's colours, or a soft line)
  const cols = (deco.pframe && PFRAME_COLORS[deco.pframe]) || ['rgba(255,233,214,.25)', 'rgba(255,233,214,.12)'];
  const g = ctx.createLinearGradient(cx, cy, cx + cw, cy + ch);
  cols.forEach((c, i) => g.addColorStop(i / (cols.length - 1), c));
  rounded(ctx, cx, cy, cw, ch, cr);
  ctx.lineWidth = deco.pframe ? 6 : 2;
  ctx.strokeStyle = g;
  ctx.stroke();

  // avatar with its decoration
  const ax = cx + 70, ay = cy + 70, as = 220;
  ctx.save();
  ctx.beginPath();
  ctx.arc(ax + as / 2, ay + as / 2, as / 2, 0, Math.PI * 2);
  ctx.clip();
  let pic: HTMLImageElement | null = null;
  if (p.avatar?.url) pic = await loadImg(p.avatar.url, true);
  if (pic) {
    cover(ctx, pic, ax, ay, as, as);
  } else {
    ctx.fillStyle = p.avatar?.color || '#ff6b57';
    ctx.fillRect(ax, ay, as, as);
    ctx.fillStyle = '#1a0d0a';
    ctx.font = `900 ${as * .45}px 'Nunito', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((p.username || '?').charAt(0).toUpperCase(), ax + as / 2, ay + as / 2 + 6);
  }
  ctx.restore();
  const decoSrc = deco.discord || (deco.frame && FRAMES.some((f) => f.id === deco.frame) ? `/deco/frames/${deco.frame}.svg` : '');
  if (decoSrc) {
    const im = await loadImg(decoSrc, !sameOrigin(decoSrc));
    if (im) ctx.drawImage(im, ax - as * .1, ay - as * .1, as * 1.2, as * 1.2);
  }

  // name in its colour and font
  const tx = ax + as + 56;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  let size = 72;
  ctx.font = `700 ${size}px ${family}`;
  while (ctx.measureText(name).width > cw - (tx - cx) - 40 && size > 30) {
    size -= 4;
    ctx.font = `700 ${size}px ${family}`;
  }
  const ny = cy + 140;
  const nw = ctx.measureText(name).width;
  const color = NAME_COLORS.find((x) => x.id === deco.nameColor);
  const hexes = color ? color.css.match(/#[0-9a-fA-F]{6}/g) || [] : [];
  if (hexes.length > 1) {
    const ng = ctx.createLinearGradient(tx, 0, tx + nw, 0);
    hexes.forEach((c, i) => ng.addColorStop(i / (hexes.length - 1), c));
    ctx.fillStyle = ng;
  } else {
    ctx.fillStyle = '#ffffff';
  }
  ctx.shadowColor = 'rgba(0,0,0,.6)';
  ctx.shadowBlur = 10;
  ctx.fillText(name, tx, ny);
  ctx.shadowBlur = 0;

  // badges as little pills
  let bx = tx;
  const by = ny + 26;
  ctx.font = `800 20px 'Nunito', sans-serif`;
  for (const b of BADGES.filter((x) => badges.includes(x.id)).slice(0, 5)) {
    const w = ctx.measureText(b.name).width + 28;
    if (bx + w > cx + cw - 30) break;
    rounded(ctx, bx, by, w, 34, 12);
    ctx.fillStyle = 'rgba(18,12,24,.75)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = b.color;
    ctx.stroke();
    ctx.fillStyle = b.color;
    ctx.fillText(b.name, bx + 14, by + 24);
    bx += w + 10;
  }

  // stats
  const tiles: [string, string][] = [
    [`${stats.hours}`, 'hours watched'],
    [`${stats.movies}`, 'movies'],
    [`${stats.episodes + stats.animeEpisodes}`, 'episodes'],
    [`${stats.bestStreak}`, 'best day streak']
  ];
  const sy = cy + ch - 170, sw = (cw - 140) / 4;
  tiles.forEach(([n, l], i) => {
    const x = cx + 70 + i * (sw + 0);
    rounded(ctx, x, sy, sw - 18, 110, 18);
    ctx.fillStyle = 'rgba(18,12,24,.62)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,233,214,.14)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#FFF3E8';
    ctx.font = `600 46px 'Fredoka', sans-serif`;
    ctx.fillText(n, x + 22, sy + 58);
    ctx.fillStyle = 'rgba(255,233,214,.7)';
    ctx.font = `700 21px 'Nunito', sans-serif`;
    ctx.fillText(l, x + 22, sy + 90);
  });

  // footer
  ctx.font = `600 26px 'Fredoka', sans-serif`;
  ctx.fillStyle = '#ff9a2e';
  ctx.fillText('comvie', cx + 70, cy + ch - 26);
  ctx.fillStyle = 'rgba(255,233,214,.75)';
  ctx.font = `700 22px 'Nunito', sans-serif`;
  const link = p.is_public && p.username ? `comvie.lol/u/${p.username}` : 'comvie.lol';
  ctx.textAlign = 'right';
  ctx.fillText(link, cx + cw - 50, cy + ch - 26);

  // profile frame corners on top
  if (deco.pframe && PFRAMES.some((f) => f.id === deco.pframe)) {
    const size = 210;
    const off = size * .2;
    const spots: [string, number, number][] = [['tl', cx - off, cy - off], ['tr', cx + cw - size + off, cy - off], ['bl', cx - off, cy + ch - size + off], ['br', cx + cw - size + off, cy + ch - size + off]];
    for (const [c, x, y] of spots) {
      const im = await loadImg(`/deco/pframes/${deco.pframe}-${c}.svg`, false);
      if (im) ctx.drawImage(im, x, y, size, size);
    }
  }

  return new Promise((resolve, reject) => cv.toBlob((b) => (b ? resolve(b) : reject(new Error('no picture'))), 'image/png'));
}
