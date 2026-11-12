import { cn } from "./common";

/**
 * Ảnh sản phẩm. Dữ liệu demo dùng "emoji:🍗" (minh họa) — có thể thay bằng URL ảnh thật
 * (http(s)://... hoặc /images/...) trong form sửa sản phẩm.
 */
export function Thumb({ src, alt, size = 44, className }: { src?: string | null; alt: string; size?: number; className?: string }) {
  const style = { width: size, height: size };
  if (src && !src.startsWith("emoji:")) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} style={style} className={cn("rounded-xl object-cover border border-slate-100 bg-slate-50", className)} />;
  }
  const emoji = src?.slice(6) || "📦";
  return (
    <span
      role="img"
      aria-label={alt}
      style={{ ...style, fontSize: size * 0.55 }}
      className={cn("inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-100 shrink-0", className)}
    >
      {emoji}
    </span>
  );
}

/** Mã vạch SVG đã sinh sẵn ở server */
export function BarcodeImg({ svg, className }: { svg?: string; className?: string }) {
  if (!svg) return null;
  return <span className={cn("block [&>svg]:h-full [&>svg]:w-full", className)} dangerouslySetInnerHTML={{ __html: svg }} />;
}
