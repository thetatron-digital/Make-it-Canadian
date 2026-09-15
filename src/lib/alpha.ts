import type { Box } from "./geometry";

/**
 * Bounding box of the pixels that are actually visible. Used to default the
 * split line to the mouth area and to place the hinge on the artwork rather
 * than on empty transparent margin. Sampled at reduced resolution, since a
 * couple of pixels of slack does not matter here.
 */
export function alphaBounds(image: HTMLImageElement | ImageBitmap, width: number, height: number): Box {
  const full: Box = { x: 0, y: 0, w: width, h: height };
  const scale = Math.min(1, 256 / Math.max(width, height));
  const sw = Math.max(1, Math.round(width * scale));
  const sh = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return full;

  ctx.drawImage(image as CanvasImageSource, 0, 0, sw, sh);
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, sw, sh).data;
  } catch {
    // Tainted canvas (image served without CORS headers). Fall back to the
    // whole image rather than breaking the editor.
    return full;
  }

  let minX = sw;
  let minY = sh;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      if (data[(y * sw + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return full;

  const inverse = 1 / scale;
  const x = Math.max(0, Math.floor(minX * inverse));
  const y = Math.max(0, Math.floor(minY * inverse));
  return {
    x,
    y,
    w: Math.min(width - x, Math.ceil((maxX + 1) * inverse) - x),
    h: Math.min(height - y, Math.ceil((maxY + 1) * inverse) - y),
  };
}
