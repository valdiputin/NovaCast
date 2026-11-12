import { formatDateTime } from "@/lib/format";
import { PrintToolbar } from "./PrintToolbar";

export interface SheetLine {
  code: string;
  name: string;
  unit?: string;
  qty: number;
  price: number;
  discount?: number;
  total: number;
}

/** Mẫu in chứng từ kho (khổ A4) */
export function DocSheet({
  storeName, storeAddress, title, code, date, status, meta, lines, total, by, signers,
}: {
  storeName: string;
  storeAddress?: string | null;
  title: string;
  code: string;
  date: Date;
  status: string;
  meta: [string, string][];
  lines: SheetLine[];
  total: number;
  by?: string | null;
  signers: string[];
}) {
  const fmt = (n: number) => n.toLocaleString("vi-VN");
  return (
    <div className="max-w-[820px] mx-auto bg-white p-10 print:p-0 text-[14px] text-slate-900">
      <PrintToolbar />
      <div className="flex justify-between items-start">
        <div>
          <div className="text-lg font-bold">{storeName}</div>
          {storeAddress && <div className="text-slate-600">{storeAddress}</div>}
        </div>
        <div className="text-right text-slate-600">
          Mã phiếu: <b className="text-slate-900">{code}</b>
          <br />
          Trạng thái: {status}
        </div>
      </div>
      <h1 className="text-center text-2xl font-bold uppercase mt-6">{title}</h1>
      <div className="text-center text-slate-600 mb-5">Ngày {formatDateTime(date)}</div>
      <div className="grid grid-cols-2 gap-x-8 gap-y-1 mb-4">
        {meta.map(([k, v]) => (
          <div key={k}>
            <span className="text-slate-600">{k}: </span>
            <b>{v}</b>
          </div>
        ))}
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr className="[&>th]:border [&>th]:border-slate-400 [&>th]:px-2 [&>th]:py-1.5 bg-slate-100">
            <th className="w-8">#</th>
            <th>Mã hàng</th>
            <th className="text-left">Tên hàng</th>
            <th>ĐVT</th>
            <th className="text-right">Số lượng</th>
            <th className="text-right">Đơn giá</th>
            {lines.some((l) => l.discount) && <th className="text-right">CK %</th>}
            <th className="text-right">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} className="[&>td]:border [&>td]:border-slate-300 [&>td]:px-2 [&>td]:py-1.5">
              <td className="text-center">{i + 1}</td>
              <td>{l.code}</td>
              <td>{l.name}</td>
              <td className="text-center">{l.unit ?? ""}</td>
              <td className="text-right">{fmt(l.qty)}</td>
              <td className="text-right">{fmt(l.price)}</td>
              {lines.some((x) => x.discount) && <td className="text-right">{l.discount ?? 0}</td>}
              <td className="text-right">{fmt(l.total)}</td>
            </tr>
          ))}
          <tr className="[&>td]:border [&>td]:border-slate-300 [&>td]:px-2 [&>td]:py-1.5 font-bold">
            <td colSpan={lines.some((l) => l.discount) ? 7 : 6} className="text-right">Tổng cộng</td>
            <td className="text-right">{fmt(total)} đ</td>
          </tr>
        </tbody>
      </table>
      <div className="mt-2 text-slate-600">Người lập phiếu: {by ?? "—"}</div>
      <div className="grid mt-10 text-center" style={{ gridTemplateColumns: `repeat(${signers.length}, 1fr)` }}>
        {signers.map((s) => (
          <div key={s}>
            <b>{s}</b>
            <div className="text-slate-500 text-xs">(Ký, ghi rõ họ tên)</div>
          </div>
        ))}
      </div>
    </div>
  );
}
