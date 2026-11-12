import { LogoMark, LogoText } from "./Logo";

/** Nền gradient xanh có sóng nhạt + logo NovaCast (màn đăng nhập & chọn loại hình) */
export function BlueBackdrop({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(ellipse_at_top_left,#1F6BFF_0%,#0A4FE0_45%,#0637B8_100%)] flex flex-col items-center justify-center px-4 py-10">
      <svg className="absolute inset-0 w-full h-full opacity-[0.18] pointer-events-none" viewBox="0 0 1440 900" preserveAspectRatio="none" aria-hidden>
        <path d="M0 160 C 300 60, 420 300, 760 220 S 1200 40, 1440 140 L1440 0 L0 0 Z" fill="#5B9BFF" />
        <path d="M0 700 C 360 560, 620 860, 980 720 S 1300 600, 1440 660 L1440 900 L0 900 Z" fill="#2E7BFF" />
        <path d="M900 900 C 1100 760, 1250 820, 1440 700 L1440 900 Z" fill="#7FB2FF" opacity="0.6" />
      </svg>
      <div className="relative flex flex-col items-center text-center mb-8">
        <LogoMark className="w-36 h-28" />
        <LogoText className="text-5xl mt-1" />
        <p className="text-white/95 text-xl mt-3">Quản lý cửa hàng của bạn một cách thông minh</p>
      </div>
      <div className="relative w-full flex justify-center">{children}</div>
    </div>
  );
}
