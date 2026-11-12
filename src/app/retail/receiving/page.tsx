import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentStore } from "@/lib/auth";
import { Header } from "@/components/layout/Header";
import { Card, PageBody, Pill, TH, TD, Pagination, withParams } from "@/components/ui/kit";
import { DocToolbar } from "@/components/docs/DocToolbar";
import { ReceiptPanel, type ReceiptDraft } from "@/components/docs/ReceiptPanel";
import { DOC_STATUS } from "@/lib/labels";
import { RANGE_OPTIONS, rangeFilter } from "@/lib/stats";
import { formatDateTime } from "@/lib/format";
import { toVnInput } from "@/lib/date";
import { Eye, Printer } from "lucide-react";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 10;
const money = (n: bigint | number) => `${Number(n).toLocaleString("vi-VN")} ₫`;

type SP = { q?: string; range?: string; page?: string; new?: string; edit?: string };

export default async function RetailReceivingPage({ searchParams }: { searchParams: Promise<SP> }) {
  const store = await getCurrentStore("RETAIL");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const range = sp.range ?? "7d";
  const where: Prisma.StockReceiptWhereInput = {
    storeId: store.id,
    ...(rangeFilter(range) ? { receiptDate: rangeFilter(range) } : {}),
    ...(sp.q ? { OR: [{ code: { contains: sp.q, mode: "insensitive" } }, { supplier: { name: { contains: sp.q, mode: "insensitive" } } }] } : {}),
  };
  const [receipts, total, suppliers, variants, editing] = await Promise.all([
    prisma.stockReceipt.findMany({ where, include: { supplier: true, items: true }, orderBy: { receiptDate: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.stockReceipt.count({ where }),
    prisma.partner.findMany({ where: { storeId: store.id, type: "SUPPLIER", deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.productVariant.findMany({ where: { deletedAt: null, product: { storeId: store.id, deletedAt: null } }, include: { product: true }, orderBy: { sku: "asc" } }),
    sp.edit ? prisma.stockReceipt.findFirst({ where: { id: sp.edit, storeId: store.id }, include: { items: true } }) : null,
  ]);
  const params = { q: sp.q, range: sp.range, page: sp.page };
  const base = withParams("/retail/receiving", params, {});

  const catalog = variants.map((v) => ({
    id: v.id, code: v.sku, barcode: v.barcode, name: `${v.product.name}${v.name ? ` (${v.name})` : ""}`, img: v.product.imageUrl, price: Number(v.costPrice),
  }));
  const draft: ReceiptDraft | null = editing
    ? {
        id: editing.id, code: editing.code, status: editing.status, supplierId: editing.supplierId ?? "", receiptType: editing.receiptType,
        date: toVnInput(editing.receiptDate), note: editing.note ?? "",
        lines: editing.items.map((i) => ({ key: i.id, itemId: i.variantId ?? "", qty: i.quantity, price: Number(i.unitCost), discount: i.discountRate, locationId: i.locationId ?? undefined })),
      }
    : sp.new
    ? { supplierId: suppliers[0]?.id ?? "", receiptType: "SUPPLIER", date: toVnInput(), note: "", lines: [] }
    : null;

  return (
    <div className="flex-1 flex flex-col">
      <Header title="Nhập hàng (Từ NCC)" />
      <PageBody className="space-y-4">
        <DocToolbar
          placeholder="Tìm kiếm mã phiếu, nhà cung cấp..."
          q={sp.q}
          selects={[{ param: "range", value: range, options: RANGE_OPTIONS }]}
          createHref={withParams("/retail/receiving", params, { new: 1 })}
          createLabel="Tạo phiếu nhập hàng"
        />
        <Card className="overflow-hidden">
          <table className="w-full">
            <thead className="bg-[#F1F5FD]">
              <tr>
                <th className={TH + " w-14 text-center"}><input type="checkbox" className="w-5 h-5" aria-label="Chọn tất cả" /></th>
                <th className={TH + " text-[17px]"}>Mã phiếu</th>
                <th className={TH + " text-[17px]"}>Ngày nhập</th>
                <th className={TH + " text-[17px]"}>Nhà cung cấp</th>
                <th className={TH + " text-[17px] text-right"}>Tổng số lượng</th>
                <th className={TH + " text-[17px] text-right"}>Tổng giá trị</th>
                <th className={TH + " text-[17px]"}>Người lập</th>
                <th className={TH + " text-[17px] text-center"}>Trạng thái</th>
                <th className={TH + " text-[17px] text-center"}>Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[17px] text-[#1E293B]">
              {receipts.map((r) => {
                const st = DOC_STATUS[r.status];
                return (
                  <tr key={r.id} className={sp.edit === r.id ? "bg-blue-50/50" : ""}>
                    <td className={TD + " text-center"}><input type="checkbox" className="w-5 h-5" aria-label={`Chọn ${r.code}`} /></td>
                    <td className={TD + " font-medium"}>{r.code}</td>
                    <td className={TD}>{formatDateTime(r.receiptDate)}</td>
                    <td className={TD}>{r.supplier?.name ?? "—"}</td>
                    <td className={TD + " text-right"}>{r.items.reduce((s, i) => s + i.quantity, 0).toLocaleString("vi-VN")} SP</td>
                    <td className={TD + " text-right"}>{money(r.totalAmount)}</td>
                    <td className={TD}>{r.createdByName ?? "—"}</td>
                    <td className={TD + " text-center"}><Pill label={st.label} tone={st.tone} /></td>
                    <td className={TD}>
                      <div className="flex items-center justify-center gap-2">
                        <Link href={withParams("/retail/receiving", params, { edit: r.id })} scroll={false} className="w-11 h-10 rounded-xl bg-blue-50 text-[#1565F5] flex items-center justify-center" title="Xem / sửa"><Eye className="w-6 h-6" /></Link>
                        <Link href={`/print/receipt/${r.id}`} target="_blank" className="w-11 h-10 rounded-xl bg-blue-50 text-[#1565F5] flex items-center justify-center" title="In phiếu"><Printer className="w-5 h-5" /></Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {receipts.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">Không có phiếu nhập trong khoảng thời gian này</td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
            <span className="text-[17px] font-semibold text-[#1E293B]">
              Hiển thị {total ? (page - 1) * PAGE_SIZE + 1 : 0} - {Math.min(page * PAGE_SIZE, total)} trong {total} phiếu
            </span>
            <Pagination page={page} totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))} hrefFor={(p) => withParams("/retail/receiving", params, { page: p })} />
          </div>
        </Card>
        {draft && (
          <ReceiptPanel key={draft.id ?? "new"} mode="retail" title={draft.id ? "Phiếu nhập" : "Tạo phiếu nhập hàng"} catalog={catalog} suppliers={suppliers} initial={draft} closeHref={base} />
        )}
      </PageBody>
    </div>
  );
}
