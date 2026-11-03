/** Draws someone's profile card as a picture (1200 x 630) to download or share. */
import { BADGES } from './badges';
import { ICON_PATHS } from '../components/Icon';
import { NAME_COLORS, NAME_FONTS, NAMEPLATE_EDGE, PFRAME_COLORS, PFRAMES, FRAMES } from './decorations';
import { BANNER_RE, discordPlate, DPLATE_RE } from './profile';
import type { Profile } from './profile';
import type { WatchStats } from './stats';

const W = 1200;
const H = 630;

function loadOne(src: string, cors: boolean): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const im = new Image();
    if (cors) im.crossOrigin = 'anonymous';
    im.onload = () => resolve(im.naturalWidth ? im : null);
    im.onerror = () => resolve(null); // a picture that can't be used just gets left out
    im.src = src;
  });
}
/** Pictures from this site load directly. Pictures from elsewhere (TMDB, AniList, Discord) come through the site's
 *  own image relay, since a canvas can't be saved with a picture another site didn't allow. */
async function loadImg(src: string): Promise<HTMLImageElement | null> {
  if (!src) return null;
  if (src.startsWith('/') || src.startsWith('data:')) return loadOne(src, false);
  const viaSite = await loadOne(`/api/account?action=img&u=${encodeURIComponent(src)}`, false);
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
  if (font?.google && !document.querySelector(`link[data-cvfont="${font.id}"]`)) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.dataset.cvfont = font.id;
    l.href = `https://fonts.googleapis.com/css2?family=${font.google}&display=swap`;
    document.head.appendChild(l);
  }
  const myBadges = BADGES.filter((x) => badges.includes(x.id));

  // start every download at once
  const bannerSrc = deco.banner && BANNER_RE.test(deco.banner) ? deco.banner : '';
  const plateSrc = deco.dplate && DPLATE_RE.test(deco.dplate) ? discordPlate(deco.dplate).img : deco.nameplate ? `/deco/nameplates/${deco.nameplate}-still.svg` : '';
  const decoSrc = deco.discord || (deco.frame && FRAMES.some((f) => f.id === deco.frame) ? `/deco/frames/${deco.frame}-still.svg` : '');
  const hasPf = !!deco.pframe && PFRAMES.some((f) => f.id === deco.pframe);
  const [bannerIm, plateIm, effectIm, picIm, decoIm, badgeIms, cornerIms] = await Promise.all([
    loadImg(bannerSrc),
    loadImg(plateSrc),
    loadImg(deco.effect ? `/deco/effects/${deco.effect}-still.svg` : ''),
    loadImg(p.avatar?.url || ''),
    loadImg(decoSrc),
    Promise.all(myBadges.map((b) => iconImg(b.icon, b.color))),
    Promise.all((['tl', 'tr', 'bl', 'br'] as const).map((c) => (hasPf ? loadImg(`/deco/pframes/${deco.pframe}-${c}-still.svg`) : Promise.resolve(null)))),
    Promise.all([document.fonts.load(`700 64px ${family}`), document.fonts.load(`800 22px 'Nunito'`), document.fonts.load(`600 30px 'Fredoka'`)]).catch(() => undefined)
  ]);

  // page background
  ctx.fillStyle = '#120C18';
  ctx.fillRect(0, 0, W, H);
  const cx = 56, cy = 56, cw = W - 112, ch = H - 112, cr = 30;
  const bh = bannerIm ? 200 : 0; // banner height
  const hy = cy + bh; // top of the part under the banner
  const hh = ch - bh;

  ctx.save();
  rounded(ctx, cx, cy, cw, ch, cr);
  ctx.clip();
  ctx.fillStyle = (deco.nameplate && !deco.dplate && NAMEPLATE_EDGE[deco.nameplate]) || '#1d1424';
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
    if (deco.dplate) cover(ctx, plateIm, cx, hy, cw, hh, true);
    else {
      const w = (plateIm.naturalWidth / plateIm.naturalHeight) * hh;
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
  const as = 168;
  const ax = cx + 56;
  const ay = bannerIm ? hy - 64 : cy + 104;
  const mid = { x: ax + as / 2, y: ay + as / 2 };
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

  // profile frame corners on top
  if (hasPf) {
    const size = 210;
    const off = size * .2;
    const spots: [number, number][] = [[cx - off, cy - off], [cx + cw - size + off, cy - off], [cx - off, cy + ch - size + off], [cx + cw - size + off, cy + ch - size + off]];
    spots.forEach(([x, y], i) => cornerIms[i] && ctx.drawImage(cornerIms[i]!, x, y, size, size));
  }

  return new Promise((resolve, reject) => cv.toBlob((b) => (b ? resolve(b) : reject(new Error('no picture'))), 'image/png'));
}
