import { prisma } from "@/lib/prisma";
import { getCurrentStore } from "@/lib/auth";
import { Header } from "@/components/layout/Header";
import { PageBody, withParams } from "@/components/ui/kit";
import { DocToolbar } from "@/components/docs/DocToolbar";
import { ReceiptPanel, type ReceiptDraft } from "@/components/docs/ReceiptPanel";
import { DocList } from "../DocList";
import { warehouseCatalog } from "../docData";
import { RECEIPT_TYPE } from "@/lib/labels";
import { RANGE_OPTIONS, rangeFilter } from "@/lib/stats";
import { toVnInput } from "@/lib/date";
import { Box } from "lucide-react";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
const SIZE = 5;

type SP = { q?: string; type?: string; range?: string; page?: string; new?: string; edit?: string };

export default async function WarehouseReceiptsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const store = await getCurrentStore("WAREHOUSE");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const range = sp.range ?? "30d";
  const where: Prisma.StockReceiptWhereInput = {
    storeId: store.id,
    ...(sp.type && sp.type in RECEIPT_TYPE ? { receiptType: sp.type } : {}),
    ...(rangeFilter(range) ? { receiptDate: rangeFilter(range) } : {}),
    ...(sp.q ? { OR: [{ code: { contains: sp.q, mode: "insensitive" } }, { supplier: { name: { contains: sp.q, mode: "insensitive" } } }] } : {}),
  };
  const [rows, total, suppliers, { catalog, locations }, editing] = await Promise.all([
    prisma.stockReceipt.findMany({ where, include: { supplier: true, items: { include: { material: true } } }, orderBy: { receiptDate: "desc" }, skip: (page - 1) * SIZE, take: SIZE }),
    prisma.stockReceipt.count({ where }),
    prisma.partner.findMany({ where: { storeId: store.id, type: "SUPPLIER", deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    warehouseCatalog(store.id),
    sp.edit ? prisma.stockReceipt.findFirst({ where: { id: sp.edit, storeId: store.id }, include: { items: true } }) : null,
  ]);
  const params = { q: sp.q, type: sp.type, range: sp.range, page: sp.page };
  const base = "/warehouse/receipts";
  const draft: ReceiptDraft | null = editing
    ? {
        id: editing.id, code: editing.code, status: editing.status, supplierId: editing.supplierId ?? "", receiptType: editing.receiptType,
        date: toVnInput(editing.receiptDate), note: editing.note ?? "",
        lines: editing.items.map((i) => ({ key: i.id, itemId: i.materialId ?? "", qty: i.quantity, price: Number(i.unitCost), discount: i.discountRate, locationId: i.locationId ?? undefined })),
      }
    : sp.new
    ? { supplierId: suppliers[0]?.id ?? "", receiptType: "PURCHASE", date: toVnInput(), note: "", lines: [] }
    : null;

  return (
    <div className="flex-1 flex flex-col">
      <Header title="Nhập kho" />
      <PageBody className="space-y-4">
        <DocToolbar
          labeled
          showSearch={false}
          q={sp.q}
          selects={[
            { param: "type", value: sp.type, label: "Loại phiếu", placeholder: "Tất cả loại phiếu", icon: <Box className="w-5 h-5 mr-3" />, options: Object.entries(RECEIPT_TYPE).map(([v, l]) => ({ value: v, label: l })) },
            { param: "range", value: range, label: "Khoảng thời gian", options: RANGE_OPTIONS },
          ]}
          createHref={withParams(base, params, { new: 1 })}
          createLabel="Tạo phiếu nhập"
        />
        <DocList
          base={base}
          params={params}
          page={page}
          size={SIZE}
          total={total}
          printKind="receipt"
          selectedId={sp.edit}
          rows={rows.map((r) => {
            const units = [...new Set(r.items.map((i) => i.material?.unit?.toLowerCase() ?? ""))];
            return {
              id: r.id, code: r.code, date: r.receiptDate, typeLine: RECEIPT_TYPE[r.receiptType] ?? r.receiptType, partyLine: r.supplier?.name ?? "",
              qtyLine: `${r.items.reduce((s, i) => s + i.quantity, 0).toLocaleString("vi-VN")} ${units.length === 1 ? units[0] : "đv"}`,
              amount: r.totalAmount, by: r.createdByName ?? "—", status: r.status,
            };
          })}
        />
        {draft && (
          <ReceiptPanel key={draft.id ?? "new"} mode="warehouse" title={draft.id ? "Phiếu nhập kho" : "Tạo phiếu nhập kho"} catalog={catalog} locations={locations} suppliers={suppliers} initial={draft} closeHref={withParams(base, params, {})} />
        )}
      </PageBody>
    </div>
  );
}
