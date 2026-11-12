import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentStore } from "@/lib/auth";
import { SLIP_STATUS } from "@/lib/labels";
import { DocSheet } from "../../DocSheet";

export const dynamic = "force-dynamic";
const TITLE = { CUSTOMER_RETURN: "Phiếu khách trả hàng", DISPOSE: "Phiếu xuất hủy hàng", TRANSFER: "Phiếu chuyển kho" } as const;

export default async function PrintSlip({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = await getCurrentStore();
  const s = await prisma.returnSlip.findFirst({ where: { id, storeId: store.id }, include: { items: { include: { variant: { include: { product: true } } } } } });
  if (!s) notFound();
  const locs = await prisma.stockLocation.findMany({ where: { storeId: store.id } });
  const ln = (lid: string | null) => locs.find((l) => l.id === lid)?.name ?? "—";
  const meta: [string, string][] =
    s.kind === "CUSTOMER_RETURN"
      ? [["Khách hàng", s.customerName ?? "—"], ["Tình trạng hàng", s.condition === "DAMAGED" ? "Hàng lỗi" : "Hàng nguyên vẹn"], ["Ghi chú", s.note || "—"]]
      : s.kind === "DISPOSE"
      ? [["Vị trí", ln(s.fromLocationId)], ["Lý do", s.note || "—"]]
      : [["Từ vị trí", ln(s.fromLocationId)], ["Đến vị trí", ln(s.toLocationId)], ["Ghi chú", s.note || "—"]];
  return (
    <DocSheet
      storeName={store.name}
      storeAddress={store.address}
      title={TITLE[s.kind]}
      code={s.code}
      date={s.slipDate}
      status={SLIP_STATUS[s.status].label}
      meta={meta}
      lines={s.items.map((i) => ({ code: i.variant.sku, name: `${i.variant.product.name} (${i.variant.name})`, unit: "Cái", qty: i.quantity, price: Number(i.unitPrice), total: Number(i.totalAmount) }))}
      total={Number(s.totalAmount)}
      by={s.createdByName}
      signers={s.kind === "CUSTOMER_RETURN" ? ["Khách hàng", "Nhân viên", "Quản lý"] : ["Người lập phiếu", "Thủ kho", "Quản lý"]}
    />
  );
}
