// Hatch pixelize pipeline.
//
// Ported from poc/pixelize.js with the v0.2 P0 → P2 promotion: adds
// cropAndLetterboxToSquare() before the pixelize step. This is condition #1
// from the POC PO sign-off: bg-removed bboxes were too thin/sparse on
// landscape and multi-subject inputs unless we crop and square them.
//
// Pipeline: bg-removed canvas → cropAndLetterboxToSquare → pixelize → 192×192 PNG

const DISPLAY_SIZE = 192;
const ALPHA_THRESHOLD = 128;
const OUTLINE_DARKEN = 0.35;
const BBOX_ALPHA_THRESHOLD = 16; // anything > this counts as "subject" for bbox
const LETTERBOX_PADDING = 0.08;  // 8% padding around subject inside the square

// ---- crop + letterbox (NEW in P2) ----

export function cropAndLetterboxToSquare(srcCanvas, padding = LETTERBOX_PADDING) {
  const bbox = computeAlphaBbox(srcCanvas);
  if (!bbox) return null;

  const bw = bbox.right - bbox.left + 1;
  const bh = bbox.bottom - bbox.top + 1;
  const side = Math.round(Math.max(bw, bh) * (1 + padding * 2));

  const out = document.createElement("canvas");
  out.width = side;
  out.height = side;
  const ctx = out.getContext("2d");

  // Center the bbox in the square: dx/dy = offset to place srcCanvas (0,0)
  // such that bbox ends up centered.
  const dx = Math.round((side - bw) / 2 - bbox.left);
  const dy = Math.round((side - bh) / 2 - bbox.top);
  ctx.drawImage(srcCanvas, dx, dy);

  return out;
}

function computeAlphaBbox(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const w = canvas.width;
  const h = canvas.height;
  const data = ctx.getImageData(0, 0, w, h).data;

  let left = w;
  let right = -1;
  let top = h;
  let bottom = -1;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > BBOX_ALPHA_THRESHOLD) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }

  return right < 0 ? null : { left, right, top, bottom };
}

// ---- pixelize (same algorithm as POC) ----

export function pixelize(srcCanvas, { pixelSize = 64, paletteSize = 16, outline = 0 } = {}) {
  const w = srcCanvas.width;
  const h = srcCanvas.height;

  const scale = pixelSize / Math.max(w, h);
  const lowW = Math.max(1, Math.round(w * scale));
  const lowH = Math.max(1, Math.round(h * scale));

  const low = document.createElement("canvas");
  low.width = lowW;
  low.height = lowH;
  const lowCtx = low.getContext("2d", { willReadFrequently: true });
  lowCtx.imageSmoothingEnabled = true;
  lowCtx.imageSmoothingQuality = "high";
  lowCtx.drawImage(srcCanvas, 0, 0, lowW, lowH);

  const img = lowCtx.getImageData(0, 0, lowW, lowH);
  const data = img.data;

  for (let i = 3; i < data.length; i += 4) {
    data[i] = data[i] >= ALPHA_THRESHOLD ? 255 : 0;
  }

  quantize(data, paletteSize);
  if (outline > 0) addOutline(data, lowW, lowH, outline);

  lowCtx.putImageData(img, 0, 0);

  const upScale = DISPLAY_SIZE / Math.max(lowW, lowH);
  const finalW = Math.round(lowW * upScale);
  const finalH = Math.round(lowH * upScale);

  const out = document.createElement("canvas");
  out.width = finalW;
  out.height = finalH;
  const outCtx = out.getContext("2d");
  outCtx.imageSmoothingEnabled = false;
  outCtx.drawImage(low, 0, 0, finalW, finalH);

  return out;
}

function quantize(data, paletteSize) {
  const pixels = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 255) {
      pixels.push([data[i], data[i + 1], data[i + 2], i]);
    }
  }
  if (pixels.length === 0) return;

  let buckets = [pixels];
  while (buckets.length < paletteSize) {
    let bestIdx = -1;
    let bestRange = -1;
    let bestChannel = 0;

    for (let i = 0; i < buckets.length; i++) {
      const b = buckets[i];
      if (b.length < 2) continue;
      for (let c = 0; c < 3; c++) {
        let min = 255;
        let max = 0;
        for (const p of b) {
          if (p[c] < min) min = p[c];
          if (p[c] > max) max = p[c];
        }
        const range = max - min;
        if (range > bestRange) {
          bestRange = range;
          bestIdx = i;
          bestChannel = c;
        }
      }
    }
    if (bestIdx === -1) break;

    const b = buckets[bestIdx];
    b.sort((a, z) => a[bestChannel] - z[bestChannel]);
    const mid = b.length >> 1;
    buckets.splice(bestIdx, 1, b.slice(0, mid), b.slice(mid));
  }

  for (const b of buckets) {
    if (b.length === 0) continue;
    let r = 0;
    let g = 0;
    let bl = 0;
    for (const p of b) {
      r += p[0];
      g += p[1];
      bl += p[2];
    }
    r = Math.round(r / b.length);
    g = Math.round(g / b.length);
    bl = Math.round(bl / b.length);
    for (const p of b) {
      data[p[3]] = r;
      data[p[3] + 1] = g;
      data[p[3] + 2] = bl;
    }
  }
}

function addOutline(data, w, h, thickness) {
  const n = w * h;
  let edge = new Uint8Array(n);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (data[i * 4 + 3] !== 255) continue;
      let onEdge = false;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) {
        onEdge = true;
      } else if (
        data[(i - 1) * 4 + 3] === 0 ||
        data[(i + 1) * 4 + 3] === 0 ||
        data[(i - w) * 4 + 3] === 0 ||
        data[(i + w) * 4 + 3] === 0
      ) {
        onEdge = true;
      }
      if (onEdge) edge[i] = 1;
    }
  }

  for (let pass = 1; pass < thickness; pass++) {
    const next = new Uint8Array(edge);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (edge[i]) continue;
        if (data[i * 4 + 3] !== 255) continue;
        if (
          (x > 0 && edge[i - 1]) ||
          (x < w - 1 && edge[i + 1]) ||
          (y > 0 && edge[i - w]) ||
          (y < h - 1 && edge[i + w])
        ) {
          next[i] = 1;
        }
      }
    }
    edge = next;
  }

  for (let i = 0; i < n; i++) {
    if (!edge[i]) continue;
    const di = i * 4;
    data[di] = Math.round(data[di] * OUTLINE_DARKEN);
    data[di + 1] = Math.round(data[di + 1] * OUTLINE_DARKEN);
    data[di + 2] = Math.round(data[di + 2] * OUTLINE_DARKEN);
  }
}
