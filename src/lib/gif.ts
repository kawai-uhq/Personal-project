/** A small animated GIF maker for the share card.
 *  One shared 255-colour palette (median cut) with light ordered dithering, so parts of the picture that don't move
 *  stay exactly the same from frame to frame. Each later frame only stores the box that changed, with unchanged
 *  pixels left see-through, which keeps the file small. */

const T = 255; // palette slot kept for "see-through"

class Bytes {
  buf = new Uint8Array(1 << 20);
  n = 0;
  byte(b: number) {
    if (this.n === this.buf.length) {
      const nb = new Uint8Array(this.buf.length * 2);
      nb.set(this.buf);
      this.buf = nb;
    }
    this.buf[this.n++] = b;
  }
  word(w: number) {
    this.byte(w & 255);
    this.byte((w >> 8) & 255);
  }
  str(s: string) {
    for (let i = 0; i < s.length; i++) this.byte(s.charCodeAt(i));
  }
  bytes(a: ArrayLike<number>) {
    for (let i = 0; i < a.length; i++) this.byte(a[i]);
  }
  done() {
    return this.buf.subarray(0, this.n);
  }
}

/** Picks 255 colours that best cover the sampled pixels */
function medianCut(rgb: Uint8Array, count: number): Uint8Array {
  type Box = { idx: Uint32Array; ch: number; range: number };
  const make = (idx: Uint32Array): Box => {
    const lo = [255, 255, 255], hi = [0, 0, 0];
    for (let k = 0; k < idx.length; k++) {
      const o = idx[k] * 3;
      for (let c = 0; c < 3; c++) {
        const v = rgb[o + c];
        if (v < lo[c]) lo[c] = v;
        if (v > hi[c]) hi[c] = v;
      }
    }
    // green matters most to the eye, blue least
    const r = [(hi[0] - lo[0]) * 1.0, (hi[1] - lo[1]) * 1.2, (hi[2] - lo[2]) * 0.8];
    const ch = r[0] >= r[1] && r[0] >= r[2] ? 0 : r[1] >= r[2] ? 1 : 2;
    return { idx, ch, range: r[ch] };
  };
  const all = new Uint32Array(rgb.length / 3);
  for (let i = 0; i < all.length; i++) all[i] = i;
  const boxes: Box[] = [make(all)];
  while (boxes.length < count) {
    let best = -1, score = 0;
    for (let i = 0; i < boxes.length; i++) {
      const s = boxes[i].range * Math.sqrt(boxes[i].idx.length);
      if (boxes[i].idx.length > 1 && s > score) {
        score = s;
        best = i;
      }
    }
    if (best < 0) break;
    const b = boxes[best];
    const sorted = Array.from(b.idx).sort((x, y) => rgb[x * 3 + b.ch] - rgb[y * 3 + b.ch]);
    const mid = sorted.length >> 1;
    boxes.splice(best, 1, make(Uint32Array.from(sorted.slice(0, mid))), make(Uint32Array.from(sorted.slice(mid))));
  }
  const pal = new Uint8Array(256 * 3);
  boxes.forEach((b, i) => {
    let r = 0, g = 0, bl = 0;
    for (let k = 0; k < b.idx.length; k++) {
      const o = b.idx[k] * 3;
      r += rgb[o];
      g += rgb[o + 1];
      bl += rgb[o + 2];
    }
    const n = b.idx.length || 1;
    pal[i * 3] = Math.round(r / n);
    pal[i * 3 + 1] = Math.round(g / n);
    pal[i * 3 + 2] = Math.round(bl / n);
  });
  return pal;
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v - 7.5) * 0.7);

/** Turns a frame's pixels into palette slots */
function mapper(pal: Uint8Array, used: number) {
  const cache = new Int16Array(32768).fill(-1);
  const nearest = (r: number, g: number, b: number) => {
    let best = 0, bd = Infinity;
    for (let i = 0; i < used; i++) {
      const dr = pal[i * 3] - r, dg = pal[i * 3 + 1] - g, db = pal[i * 3 + 2] - b;
      const d = dr * dr * 3 + dg * dg * 4 + db * db * 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  };
  return (px: Uint8ClampedArray, w: number, h: number) => {
    const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x, o = i * 4;
        const d = BAYER[(y & 3) * 4 + (x & 3)];
        const r = Math.max(0, Math.min(255, px[o] + d)), g = Math.max(0, Math.min(255, px[o + 1] + d)), b = Math.max(0, Math.min(255, px[o + 2] + d));
        const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
        let v = cache[key];
        if (v < 0) v = cache[key] = nearest((r & 248) + 4, (g & 248) + 4, (b & 248) + 4);
        out[i] = v;
      }
    }
    return out;
  };
}

/** LZW-compresses palette slots into GIF image data */
function lzw(out: Bytes, px: Uint8Array) {
  const min = 8, clear = 1 << min, eoi = clear + 1;
  let size = min + 1, next = eoi + 1, clearing = false;
  const dict = new Map<number, number>();
  const block: number[] = [];
  let cur = 0, bits = 0;
  const push = (b: number) => {
    block.push(b);
    if (block.length === 255) {
      out.byte(255);
      out.bytes(block);
      block.length = 0;
    }
  };
  const emit = (code: number) => {
    cur |= code << bits;
    bits += size;
    while (bits >= 8) {
      push(cur & 255);
      cur >>>= 8;
      bits -= 8;
    }
    if (clearing) {
      size = min + 1;
      clearing = false;
    } else if (next > (1 << size) - 1 && size < 12) size++;
  };
  out.byte(min);
  emit(clear);
  let prefix = px[0];
  for (let i = 1; i < px.length; i++) {
    const k = px[i];
    const key = prefix * 256 + k;
    const hit = dict.get(key);
    if (hit !== undefined) {
      prefix = hit;
      continue;
    }
    emit(prefix);
    if (next < 4096) dict.set(key, next++);
    else {
      dict.clear();
      next = eoi + 1;
      clearing = true;
      emit(clear);
    }
    prefix = k;
  }
  emit(prefix);
  emit(eoi);
  if (bits > 0) push(cur & 255);
  if (block.length) {
    out.byte(block.length);
    out.bytes(block);
  }
  out.byte(0);
}

/**
 * Writes a looping GIF one frame at a time, so a phone never has to hold every frame at once.
 * samples: a few frames spread over the animation, used to choose the colours.
 * delay is in hundredths of a second.
 */
export class GifWriter {
  private out = new Bytes();
  private prev: Uint8Array | null = null;
  private map: (px: Uint8ClampedArray, w: number, h: number) => Uint8Array;

  constructor(private w: number, private h: number, private delay: number, samples: Uint8ClampedArray[]) {
    const per = Math.max(1, Math.floor(60000 / samples.length));
    const step = Math.max(1, Math.floor((w * h) / per));
    const sample = new Uint8Array(samples.length * per * 3);
    let s = 0;
    samples.forEach((f, n) => {
      for (let i = n % step, c = 0; i < w * h && c < per; i += step, c++) {
        sample[s++] = f[i * 4];
        sample[s++] = f[i * 4 + 1];
        sample[s++] = f[i * 4 + 2];
      }
    });
    const pal = medianCut(sample.subarray(0, s), 255);
    this.map = mapper(pal, 255);
    const out = this.out;
    out.str('GIF89a');
    out.word(w);
    out.word(h);
    out.byte(0xf7); // global palette, 256 colours
    out.byte(0);
    out.byte(0);
    out.bytes(pal);
    out.bytes([0x21, 0xff, 11]); // loop forever
    out.str('NETSCAPE2.0');
    out.bytes([3, 1, 0, 0, 0]);
  }

  add(px: Uint8ClampedArray) {
    const { w, h, out, prev } = this;
    const idx = this.map(px, w, h);
    let x0 = 0, y0 = 0, x1 = w - 1, y1 = h - 1;
    let data = idx;
    if (prev) {
      // only the box that changed, with unchanged pixels see-through
      x0 = w; y0 = h; x1 = -1; y1 = -1;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          if (idx[i] !== prev[i]) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
        }
      }
      if (x1 < 0) x0 = y0 = x1 = y1 = 0;
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
      data = new Uint8Array(bw * bh);
      for (let y = 0; y < bh; y++) {
        for (let x = 0; x < bw; x++) {
          const i = (y + y0) * w + x + x0;
          data[y * bw + x] = idx[i] === prev[i] ? T : idx[i];
        }
      }
    }
    // frame timing and see-through slot; the previous frame stays underneath
    out.bytes([0x21, 0xf9, 4, (1 << 2) | (prev ? 1 : 0)]);
    out.word(this.delay);
    out.bytes([T, 0]);
    out.byte(0x2c);
    out.word(x0);
    out.word(y0);
    out.word(x1 - x0 + 1);
    out.word(y1 - y0 + 1);
    out.byte(0);
    lzw(out, data);
    this.prev = idx;
  }

  finish(): Blob {
    this.out.byte(0x3b);
    return new Blob([this.out.done()], { type: 'image/gif' });
  }
}
