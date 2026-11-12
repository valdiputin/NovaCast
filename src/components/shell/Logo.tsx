import { cn } from "../ui/common";

/** Biểu tượng NovaCast: nhà kho trắng + thùng hàng cam + xe đẩy (theo mockup) */
export function LogoMark({ className, cart = true }: { className?: string; cart?: boolean }) {
  return (
    <svg viewBox="0 0 120 96" className={className} aria-hidden>
      {/* mái & thân nhà kho */}
      <path d="M8 40 L52 8 L96 40" fill="none" stroke="white" strokeWidth="9" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M18 38 V86 H86 V38" fill="none" stroke="white" strokeWidth="9" strokeLinejoin="round" />
      {/* thanh cửa cuốn */}
      <rect x="30" y="34" width="44" height="6" rx="2" fill="#1565F5" />
      {/* thùng hàng cam */}
      <rect x="40" y="46" width="20" height="16" rx="2" fill="#F59E0B" />
      <rect x="28" y="64" width="20" height="18" rx="2" fill="#F59E0B" />
      <rect x="51" y="64" width="20" height="18" rx="2" fill="#F59E0B" />
      <path d="M50 46 v6 M38 64 v6 M61 64 v6" stroke="#B45309" strokeWidth="2" />
      {cart && (
        <g fill="none" stroke="white" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M74 50 h8 l8 26 h22 l6 -18 h-32" />
          <circle cx="94" cy="86" r="4" fill="white" />
          <circle cx="110" cy="86" r="4" fill="white" />
        </g>
      )}
    </svg>
  );
}

export function LogoText({ className }: { className?: string }) {
  return (
    <span className={cn("font-extrabold tracking-tight text-white", className)}>
      Nova<span className="text-[#F59E0B]">Cast</span>
    </span>
  );
}
