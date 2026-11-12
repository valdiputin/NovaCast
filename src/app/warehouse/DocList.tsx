import Link from "next/link";
import { Card, Pill, TH, TD, Pagination, withParams } from "@/components/ui/kit";
import { DOC_STATUS } from "@/lib/labels";
import { formatDateTime } from "@/lib/format";
import { Eye, Printer } from "lucide-react";

export interface DocRow {
  id: string;
  code: string;
  date: Date;
  typeLine: string;
  partyLine: string;
  qtyLine: string;
  amount: bigint;
  by: string;
  status: "DRAFT" | "APPROVED" | "CANCELLED";
}

/** Bảng phiếu nhập kho / xuất kho (ảnh "Nhập kho" / "Xuất kho") */
export function DocList({
  rows, total, page, size, base, params, printKind, selectedId,
}: { rows: DocRow[]; total: number; page: number; size: number; base: string; params: Record<string, string | undefined>; printKind: "receipt" | "issue"; selectedId?: string }) {
  return (
    <Card className="overflow-hidden">
      <table className="w-full">
        <thead className="bg-[#F1F5FD]">
          <tr className="[&>th]:text-[17px]">
            <th className={TH + " w-16 text-center"}><input type="checkbox" className="w-5 h-5" aria-label="Chọn tất cả" /></th>
            <th className={TH}>Mã phiếu</th>
            <th className={TH}>Ngày chứng từ</th>
            <th className={TH}>Loại giao dịch</th>
            <th className={TH + " text-center leading-tight"}>Tổng số lượng /<br />Giá trị</th>
            <th className={TH}>Người lập phiếu</th>
            <th className={TH + " text-center"}>Trạng thái</th>
            <th className={TH + " text-center"}>Thao tác</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-[17px] text-[#1E293B]">
          {rows.map((r) => {
            const st = DOC_STATUS[r.status];
            return (
              <tr key={r.id} className={selectedId === r.id ? "bg-blue-50/50" : ""}>
                <td className={TD + " text-center"}><input type="checkbox" className="w-5 h-5" aria-label={`Chọn ${r.code}`} /></td>
                <td className={TD + " font-medium whitespace-nowrap"}>{r.code}</td>
                <td className={TD + " whitespace-nowrap"}>{formatDateTime(r.date)}</td>
                <td className={TD + " leading-snug"}>
                  {r.typeLine}
                  <br />
                  {r.partyLine}
                </td>
                <td className={TD + " text-center leading-snug whitespace-nowrap"}>
                  {r.qtyLine} /<br />
                  {Number(r.amount).toLocaleString("vi-VN")} đ
                </td>
                <td className={TD}>{r.by}</td>
                <td className={TD + " text-center"}><Pill label={st.label} tone={st.tone} className="text-[16px] px-4 py-1.5" /></td>
                <td className={TD}>
                  <div className="flex items-center justify-center gap-3">
                    <Link href={`/print/${printKind}/${r.id}`} target="_blank" className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-blue-50 text-[#1565F5] text-[16px] font-medium whitespace-nowrap">
                      <Printer className="w-5 h-5" /> In phiếu (PDF)
                    </Link>
                    <Link href={withParams(base, params, { edit: r.id })} scroll={false} className="text-[#1565F5]" title="Xem / sửa">
                      <Eye className="w-6 h-6" />
                    </Link>
                  </div>
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="py-10 text-center text-slate-400">Không có phiếu nào phù hợp</td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-100">
        <span className="text-[17px] text-[#1E293B]">
          Hiển thị {total ? (page - 1) * size + 1 : 0} - {Math.min(page * size, total)} trong {total} phiếu
        </span>
        <Pagination page={page} totalPages={Math.max(1, Math.ceil(total / size))} hrefFor={(p) => withParams(base, params, { page: p })} />
      </div>
    </Card>
  );
}
