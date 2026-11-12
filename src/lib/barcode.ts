// Sinh mã vạch Code128 dạng SVG ở server (bwip-js thuần JS, chạy được trên Vercel)
import bwipjs from "bwip-js/node";

const cache = new Map<string, string>();

export function barcodeSvg(text: string, opts: { height?: number; includeText?: boolean } = {}): string {
  const key = `${text}|${opts.height ?? 8}|${opts.includeText ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit) return hit;
  try {
    const svg = bwipjs.toSVG({
      bcid: "code128",
      text,
      height: opts.height ?? 8,
      includetext: !!opts.includeText,
      textxalign: "center",
      textsize: 8,
    });
    cache.set(key, svg);
    return svg;
  } catch {
    return "";
  }
}
