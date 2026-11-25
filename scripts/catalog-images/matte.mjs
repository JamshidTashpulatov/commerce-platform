// Remove a plain studio background (white or Apple's light grey) from a photo.
//
// Deterministic and local. Two signals are combined:
//  * colour: the background colour is read from the image border, and every
//    pixel connected to the border whose colour stays close to it is
//    background. Its alpha grows with the distance from that colour, so soft
//    edges and faint contact shadows fade out instead of being cut hard.
//  * Vision (optional): Apple's on-device subject mask protects light parts of
//    the product (a white AirPods case on a white background) from being
//    flooded away. It never removes pixels on its own, because it misjudges
//    pale metal edges.
// Edge colours are then un-mixed from the background colour, so no white or
// grey halo is left when the cut-out sits on another background.
import sharp from "sharp";

export async function matte(bytes, visionPng, options = {}) {
  const near = options.near ?? 3;      // at or below: pure background
  const far = options.far ?? 28;       // above: certainly the product
  const {data, info} = await sharp(bytes).removeAlpha().toColourspace("srgb").raw().toBuffer({resolveWithObject: true});
  const W = info.width, H = info.height, N = W * H;
  let vision = null;
  if (visionPng) {
    const v = await sharp(visionPng).ensureAlpha().extractChannel(3).resize(W, H, {fit: "fill"}).raw().toBuffer();
    vision = v;
  }
  // Background colour: per-channel median of the border.
  const border = [[], [], []];
  for (let x = 0; x < W; x++) for (const y of [0, H - 1]) for (let c = 0; c < 3; c++) border[c].push(data[(y * W + x) * 3 + c]);
  for (let y = 0; y < H; y++) for (const x of [0, W - 1]) for (let c = 0; c < 3; c++) border[c].push(data[(y * W + x) * 3 + c]);
  const bg = border.map(ch => ch.sort((a, b) => a - b)[ch.length >> 1]);
  const dist = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const p = i * 3;
    dist[i] = Math.max(Math.abs(data[p] - bg[0]), Math.abs(data[p + 1] - bg[1]), Math.abs(data[p + 2] - bg[2]));
  }
  const protectedPx = i => vision !== null && vision[i] >= 128;
  // Flood the background from the border and from large pure-background
  // pockets the subject encloses (the gap inside a headband or watch strap).
  const inBg = new Uint8Array(N);
  const queue = new Int32Array(N);
  let head = 0, tail = 0;
  const seed = i => { if (!inBg[i] && dist[i] <= far && !protectedPx(i)) { inBg[i] = 1; queue[tail++] = i; } };
  for (let x = 0; x < W; x++) { seed(x); seed((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { seed(y * W); seed(y * W + W - 1); }
  if (vision) for (let i = 0; i < N; i++) if (dist[i] <= near && vision[i] < 26) seed(i);
  while (head < tail) {
    const i = queue[head++], x = i % W;
    if (x > 0) seed(i - 1);
    if (x < W - 1) seed(i + 1);
    if (i >= W) seed(i - W);
    if (i < N - W) seed(i + W);
  }
  const out = Buffer.alloc(N * 4);
  let edgeTouch = 0;
  for (let i = 0; i < N; i++) {
    const d = dist[i];
    const colourAlpha = Math.min(1, Math.max(0, (d - near) / (far - near)));
    let a;
    if (inBg[i]) a = colourAlpha;
    else if (d <= far && vision) a = Math.max(colourAlpha, vision[i] / 255);
    else a = 1;
    const p = i * 3, q = i * 4;
    if (a <= 0.004) { out[q] = out[q + 1] = out[q + 2] = out[q + 3] = 0; continue; }
    // Un-mix: observed = a * colour + (1 - a) * background.
    for (let c = 0; c < 3; c++) out[q + c] = Math.max(0, Math.min(255, Math.round((data[p + c] - (1 - a) * bg[c]) / a)));
    out[q + 3] = Math.round(a * 255);
    const x = i % W, y = (i / W) | 0;
    if (a > 0.5 && (x === 0 || y === 0 || x === W - 1 || y === H - 1)) edgeTouch++;
  }
  return {
    data: out, info: {width: W, height: H, channels: 4},
    background: `rgb(${bg.join(",")})`,
    warning: edgeTouch > 0 ? "matte: subject reaches the photo border" : null,
  };
}
