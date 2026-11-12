import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { selectStoreTypeAction } from "@/app/actions/auth";
import { BlueBackdrop } from "@/components/shell/BlueBackdrop";

export const dynamic = "force-dynamic";

function RetailIcon() {
  return (
    <svg viewBox="0 0 120 96" className="w-32 h-24" aria-hidden>
      <path d="M14 30 L22 8 H98 L106 30 Z" fill="#1565F5" />
      <path d="M14 30 q8 12 16 0 q8 12 16 0 q8 12 16 0 q8 12 16 0 q8 12 16 0 q7 12 16 0" fill="#3B82F6" stroke="white" strokeWidth="2" />
      <path d="M38 8 L34 30 M60 8 V30 M82 8 L86 30" stroke="#93C5FD" strokeWidth="4" />
      <rect x="20" y="40" width="80" height="50" rx="3" fill="#1D4ED8" />
      <rect x="28" y="50" width="40" height="26" rx="2" fill="#BFDBFE" />
      <path d="M32 72 l10 -10 l8 7 l6 -5 l10 8" stroke="#60A5FA" strokeWidth="3" fill="none" />
      <rect x="74" y="50" width="20" height="40" rx="2" fill="#93C5FD" />
      <circle cx="90" cy="70" r="2" fill="#1D4ED8" />
    </svg>
  );
}
function FoodIcon() {
  return (
    <svg viewBox="0 0 120 96" className="w-32 h-24" aria-hidden>
      <g fill="#1D4ED8">
        <rect x="30" y="4" width="8" height="34" rx="4" />
        <rect x="42" y="4" width="8" height="34" rx="4" />
        <rect x="54" y="4" width="8" height="34" rx="4" />
        <path d="M28 30 h36 v6 a18 18 0 0 1 -14 16 V88 a4 4 0 0 1 -8 0 V52 a18 18 0 0 1 -14 -16 z" />
        <ellipse cx="88" cy="26" rx="14" ry="24" />
        <rect x="84" y="42" width="8" height="48" rx="4" />
      </g>
    </svg>
  );
}
function WarehouseIcon() {
  return (
    <svg viewBox="0 0 120 96" className="w-32 h-24" aria-hidden>
      <path d="M10 34 L60 6 L110 34 V90 H10 Z" fill="#1D4ED8" />
      <circle cx="60" cy="24" r="4" fill="#1565F5" />
      <rect x="26" y="40" width="68" height="50" fill="white" />
      <rect x="49" y="46" width="22" height="16" rx="1" fill="#F59E0B" />
      <rect x="36" y="64" width="22" height="22" rx="1" fill="#F59E0B" />
      <rect x="62" y="64" width="22" height="22" rx="1" fill="#F59E0B" />
      <path d="M60 46 v6 M47 64 v6 M73 64 v6" stroke="#B45309" strokeWidth="2" />
    </svg>
  );
}

const CARDS = [
  { type: "RETAIL" as const, title: ["Cửa hàng", "bán lẻ"], icon: <RetailIcon /> },
  { type: "FOOD" as const, title: ["Cửa hàng", "đồ ăn"], icon: <FoodIcon /> },
  { type: "WAREHOUSE" as const, title: ["Kho doanh", "nghiệp"], icon: <WarehouseIcon /> },
];

export default async function StoreSelectionPage() {
  if (!(await getCurrentUser())) redirect("/login");
  return (
    <BlueBackdrop>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 w-full max-w-5xl">
        {CARDS.map((c) => (
          <form
            key={c.type}
            action={async () => {
              "use server";
              await selectStoreTypeAction(c.type);
            }}
          >
            <button className="w-full aspect-[1.05] bg-white rounded-[28px] shadow-2xl shadow-blue-950/30 flex flex-col items-center justify-center gap-6 hover:-translate-y-1 hover:shadow-blue-950/40 transition">
              {c.icon}
              <span className="text-[30px] font-bold text-[#1E293B] leading-tight text-center">
                {c.title[0]}
                <br />
                {c.title[1]}
              </span>
            </button>
          </form>
        ))}
      </div>
    </BlueBackdrop>
  );
}
