"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Home, Loader2, CheckCircle2, Check, ScanLine, Camera } from "lucide-react";
import { recordScanCountAction } from "@/app/actions/docs";
import { Thumb } from "@/components/ui/Thumb";

interface Item {
  code: string;
  barcode: string;
  name: string;
  img: string | null;
  unit: string;
  systemQty: number;
  actualQty: number;
}

export function MobileScanner({ auditId, auditCode, items, backHref, previewSvg }: { auditId: string | null; auditCode: string | null; items: Item[]; backHref: string; previewSvg: string }) {
  const [current, setCurrent] = useState<Item | null>(items[0] ?? null);
  const [qty, setQty] = useState(String(items[0]?.actualQty ?? ""));
  const [manual, setManual] = useState("");
  const [camera, setCamera] = useState(false);
  const [pending, start] = useTransition();
  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null);

  const pick = (code: string) => {
    const c = code.trim().toLowerCase();
    const it = items.find((i) => i.code.toLowerCase() === c || i.barcode.toLowerCase() === c);
    if (!it) return void toast.error(`Mã ${code} không có trong phiếu kiểm kê`);
    setCurrent(it);
    setQty(String(it.actualQty));
    if (navigator.vibrate) navigator.vibrate(80);
  };

  useEffect(() => {
    if (!camera) return;
    let stopped = false;
    (async () => {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (stopped) return;
      const scanner = new Html5Qrcode("reader");
      scannerRef.current = scanner;
      try {
        await scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 260, height: 140 } }, (text) => pick(text), () => {});
      } catch {
        toast.error("Không mở được camera — hãy cấp quyền camera hoặc nhập mã bằng tay");
        setCamera(false);
      }
    })();
    return () => {
      stopped = true;
      scannerRef.current?.stop().catch(() => {});
      scannerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera]);

  const record = () => {
    if (!auditId || !current) return;
    const n = Number(qty);
    if (!Number.isInteger(n) || n < 0) return void toast.error("Số lượng thực tế không hợp lệ");
    start(async () => {
      const res = await recordScanCountAction(auditId, current.code, n);
      if ("error" in res) return void toast.error(res.error);
      current.actualQty = n;
      toast.success(`Đã ghi nhận ${res.name}: ${n}`);
    });
  };

  return (
    <div className="min-h-screen bg-[#EEF2F8] flex flex-col max-w-md mx-auto">
      <div className="bg-[#16213E] text-white px-4 pt-3 pb-4">
        <div className="flex items-center justify-between">
          <Link href={backHref} target="_top" aria-label="Quay lại"><ArrowLeft className="w-7 h-7" /></Link>
          <h1 className="text-[22px] font-semibold">Kiểm kê tồn kho</h1>
          <Link href={backHref} target="_top" aria-label="Trang chủ"><Home className="w-7 h-7" fill="currentColor" /></Link>
        </div>
      </div>

      <div className="bg-[#2A3550] px-4 pt-4 pb-6">
        <div className="relative rounded-2xl overflow-hidden bg-[#3A465F] aspect-[4/3]">
          {camera ? (
            <div id="reader" className="w-full h-full [&_video]:object-cover" />
          ) : (
            <button onClick={() => setCamera(true)} className="absolute inset-0 flex items-center justify-center" aria-label="Bật camera quét mã">
              <div className="w-[82%] h-[62%] bg-white/90 rounded-lg p-3 [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: previewSvg }} />
              <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 text-[#1565F5] text-sm font-semibold">
                <Camera className="w-4 h-4" /> Bật camera
              </span>
            </button>
          )}
          {/* khung ngắm */}
          <div className="pointer-events-none absolute inset-6">
            {["top-0 left-0 border-t-4 border-l-4 rounded-tl-xl", "top-0 right-0 border-t-4 border-r-4 rounded-tr-xl", "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-xl", "bottom-0 right-0 border-b-4 border-r-4 rounded-br-xl"].map((c) => (
              <span key={c} className={`absolute w-10 h-10 border-[#1D7BF2] ${c}`} />
            ))}
            <span className="absolute left-0 right-0 top-1/2 h-0.5 bg-rose-500/90" />
          </div>
        </div>
        <div className="flex items-center justify-center gap-2 text-white/90 mt-3 text-[17px]">
          <Loader2 className="w-5 h-5 animate-spin" /> Đang quét mã...
        </div>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            pick(manual);
            setManual("");
          }}
        >
          <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Hoặc nhập mã SKU / mã vạch" className="flex-1 h-10 rounded-lg px-3 text-sm bg-white/95" />
          <button className="h-10 px-3 rounded-lg bg-[#1D7BF2] text-white text-sm font-semibold">Tìm</button>
        </form>
      </div>

      <div className="-mt-3 mx-4 rounded-2xl bg-white p-4 shadow-lg flex items-center gap-4">
        {current ? (
          <>
            <Thumb src={current.img} alt={current.name} size={84} />
            <div className="min-w-0">
              <div className="text-[19px] font-semibold text-[#1E293B] truncate">{current.name}</div>
              <div className="text-[16px] text-slate-500">SKU: {current.code}</div>
              <div className="text-[18px] font-semibold text-[#1E293B]">Tồn kho: {current.systemQty}</div>
            </div>
          </>
        ) : (
          <div className="text-slate-500">{auditId ? "Quét mã để chọn sản phẩm" : "Chưa có phiếu kiểm kê đang mở — tạo phiếu trên máy tính trước."}</div>
        )}
      </div>

      <div className="flex-1 mt-4 bg-white rounded-t-3xl px-5 pt-5 pb-6 space-y-3">
        <div className="text-[18px] text-[#1E293B]">Số lượng thực tế</div>
        <div className="flex">
          <input type="number" min={0} inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} disabled={!current} className="flex-1 h-14 rounded-l-xl border border-slate-200 px-4 text-[20px]" />
          <span className="h-14 px-5 flex items-center rounded-r-xl border border-l-0 border-slate-200 bg-slate-50 text-[17px] text-slate-500">{current?.unit ?? "cái"}</span>
        </div>
        <button type="button" disabled={!current} onClick={() => current && setQty(String(current.systemQty))} className="w-full h-14 rounded-xl bg-blue-50 text-[#1565F5] text-[19px] font-semibold flex items-center justify-center gap-2.5 disabled:opacity-50">
          <CheckCircle2 className="w-6 h-6 text-white" fill="#1565F5" /> Khớp số liệu
        </button>
        <button type="button" disabled={!current || pending} onClick={record} className="w-full h-14 rounded-xl bg-[#1565F5] text-white text-[19px] font-semibold flex items-center justify-center gap-2.5 disabled:opacity-50">
          <Check className="w-6 h-6" /> {pending ? "Đang lưu..." : "Ghi nhận"}
        </button>
        <button type="button" onClick={() => { setCamera(true); setCurrent(null); setQty(""); }} className="w-full h-14 rounded-xl border-2 border-[#1565F5] text-[#1565F5] text-[19px] font-semibold flex items-center justify-center gap-2.5">
          <ScanLine className="w-6 h-6" /> Quét tiếp
        </button>
        {auditCode && <p className="text-center text-xs text-slate-400">Phiếu {auditCode}</p>}
      </div>
    </div>
  );
}
