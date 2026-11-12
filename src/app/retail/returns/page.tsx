import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentStore } from "@/lib/auth";
import { Header } from "@/components/layout/Header";
import { Card, PageBody, Pill, TH, TD, Pagination, withParams } from "@/components/ui/kit";
import { LinkTabs } from "@/components/ui/Tabs";
import { SearchBox, RangeSelect } from "@/components/ui/RangeSelect";
import { SlipPanel, type SlipDraft, type SlipKindName } from "@/components/docs/SlipPanel";
import { SLIP_STATUS } from "@/lib/labels";
import { RANGE_OPTIONS, rangeFilter } from "@/lib/stats";
import { formatDateTime } from "@/lib/format";
import { toVnInput } from "@/lib/date";
import { Eye, Printer, RotateCw, AlertTriangle, ArrowLeftRight, Plus } from "lucide-react";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 10;
const money = (n: bigint | number) => `${Number(n).toLocaleString("vi-VN")} ₫`;
const TAB_KIND: Record<string, SlipKindName> = { return: "CUSTOMER_RETURN", dispose: "DISPOSE", transfer: "TRANSFER" };
const CREATE_LABEL: Record<SlipKindName, string> = { CUSTOMER_RETURN: "Tạo phiếu trả hàng", DISPOSE: "Tạo phiếu xuất hủy", TRANSFER: "Tạo phiếu chuyển kho" };

type SP = { tab?: string; q?: string; range?: string; page?: string; new?: string; edit?: string };

export default async function RetailReturnsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const store = await getCurrentStore("RETAIL");
  const sp = await searchParams;
  const tab = sp.tab && sp.tab in TAB_KIND ? sp.tab : "return";
  const kind = TAB_KIND[tab];
  const page = Math.max(1, Number(sp.page) || 1);
  const range = sp.range ?? "7d";
  const where: Prisma.ReturnSlipWhereInput = {
    storeId: store.id,
    kind,
    ...(rangeFilter(range) ? { slipDate: rangeFilter(range) } : {}),
    ...(sp.q ? { OR: [{ code: { contains: sp.q, mode: "insensitive" } }, { customerName: { contains: sp.q, mode: "insensitive" } }] } : {}),
  };
  const [slips, total, customers, locations, variants, levels, editing] = await Promise.all([
    prisma.returnSlip.findMany({ where, include: { items: true }, orderBy: { slipDate: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.returnSlip.count({ where }),
    prisma.partner.findMany({ where: { storeId: store.id, type: "CUSTOMER", deletedAt: null }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
    prisma.stockLocation.findMany({ where: { storeId: store.id }, orderBy: { name: "asc" } }),
    prisma.productVariant.findMany({ where: { deletedAt: null, product: { storeId: store.id, deletedAt: null } }, include: { product: true }, orderBy: { sku: "asc" } }),
    prisma.stockLevel.findMany({ where: { storeId: store.id, variantId: { not: null } }, select: { variantId: true, locationId: true, quantity: true } }),
    sp.edit ? prisma.returnSlip.findFirst({ where: { id: sp.edit, storeId: store.id }, include: { items: true } }) : null,
  ]);
  const locName = new Map(locations.map((l) => [l.id, l.name]));
  const params = { tab, q: sp.q, range: sp.range, page: sp.page };
  const base = withParams("/retail/returns", params, {});

  const stock = new Map<string, Record<string, number>>();
  for (const l of levels) stock.set(l.variantId!, { ...(stock.get(l.variantId!) ?? {}), [l.locationId]: l.quantity });
  const catalog = variants.map((v) => ({
    id: v.id, code: v.sku, barcode: v.barcode, name: `${v.product.name}${v.name ? ` (${v.name})` : ""}`, img: v.product.imageUrl,
    price: kind === "CUSTOMER_RETURN" ? Number(v.price) : Number(v.costPrice), stockByLoc: stock.get(v.id) ?? {},
  }));
  const shelf = locations.find((l) => l.kind === "SHELF");
  const wh = locations.find((l) => l.kind === "WAREHOUSE");
  const draft: SlipDraft | null = editing
    ? {
        id: editing.id, code: editing.code, status: editing.status, kind: editing.kind, partnerId: editing.partnerId ?? "", condition: editing.condition ?? "GOOD",
        fromLocationId: editing.fromLocationId ?? "", toLocationId: editing.toLocationId ?? "", date: toVnInput(editing.slipDate), note: editing.note ?? "",
        lines: editing.items.map((i) => ({ key: i.id, itemId: i.variantId, qty: i.quantity, price: Number(i.unitPrice), discount: 0, locationId: editing.fromLocationId ?? undefined })),
      }
    : sp.new
    ? {
        kind, partnerId: customers[0]?.id ?? "", condition: "GOOD", date: toVnInput(), note: "", lines: [],
        fromLocationId: (kind === "TRANSFER" ? wh?.id : shelf?.id) ?? locations[0]?.id ?? "", toLocationId: kind === "TRANSFER" ? shelf?.id ?? "" : "",
      }
    : null;

  return (
    <div className="flex-1 flex flex-col">
      <Header title="Xuất & Trả hàng / Chuyển kho" />
      <PageBody className="space-y-4">
        <LinkTabs
          size="lg"
          active={tab}
          tabs={[
            { key: "return", label: "Khách trả hàng (Hoàn kho)", href: "/retail/returns", icon: <RotateCw className="w-7 h-7" /> },
            { key: "dispose", label: "Xuất hủy / Hàng lỗi", href: "/retail/returns?tab=dispose", icon: <AlertTriangle className="w-8 h-8 text-white" fill="#F59E0B" /> },
            { key: "transfer", label: "Chuyển kho", href: "/retail/returns?tab=transfer", icon: <ArrowLeftRight className="w-7 h-7" /> },
          ]}
        />
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <SearchBox placeholder={tab === "return" ? "Tìm kiếm mã phiếu, tên khách hàng..." : "Tìm kiếm mã phiếu..."} value={sp.q} className="w-[500px] [&_input]:h-[52px] [&_input]:text-[17px]" />
            <RangeSelect param="range" value={range} icon options={RANGE_OPTIONS} className="h-[52px] min-w-[240px]" />
            <Link href={withParams("/retail/returns", params, { new: 1 })} scroll={false} className="ml-auto inline-flex items-center gap-2.5 h-[52px] px-6 rounded-xl bg-[#1565F5] text-white text-[17px] font-semibold hover:bg-[#0F55D8]">
              <Plus className="w-6 h-6" /> {CREATE_LABEL[kind]}
            </Link>
          </div>
          <table className="w-full">
            <thead className="bg-[#F1F5FD]">
              <tr>
                <th className={TH + " w-14 text-center rounded-l-xl"}><input type="checkbox" className="w-5 h-5" aria-label="Chọn tất cả" /></th>
                <th className={TH + " text-[17px] text-center"}>Mã phiếu</th>
                <th className={TH + " text-[17px] text-center"}>{tab === "return" ? "Ngày trả" : "Ngày chứng từ"}</th>
                <th className={TH + " text-[17px] text-center"}>{tab === "return" ? "Khách hàng" : tab === "dispose" ? "Vị trí" : "Từ → Đến"}</th>
                <th className={TH + " text-[17px] text-center"}>Số lượng</th>
                <th className={TH + " text-[17px] text-center"}>{tab === "return" ? "Giá trị hoàn" : "Giá trị"}</th>
                <th className={TH + " text-[17px] text-center"}>{tab === "return" ? "Tình trạng hàng" : "Ghi chú"}</th>
                <th className={TH + " text-[17px] text-center"}>Trạng thái</th>
                <th className={TH + " text-[17px] text-center rounded-r-xl"}>Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[17px] text-[#1E293B]">
              {slips.map((s) => {
                const st = SLIP_STATUS[s.status];
                return (
                  <tr key={s.id} className={sp.edit === s.id ? "bg-blue-50/50" : ""}>
                    <td className={TD + " text-center"}><input type="checkbox" className="w-5 h-5" aria-label={`Chọn ${s.code}`} /></td>
                    <td className={TD + " text-center font-medium"}>{s.code}</td>
                    <td className={TD + " text-center"}>{formatDateTime(s.slipDate)}</td>
                    <td className={TD + " text-center"}>
                      {tab === "return" ? s.customerName : tab === "dispose" ? locName.get(s.fromLocationId ?? "") : `${locName.get(s.fromLocationId ?? "")} → ${locName.get(s.toLocationId ?? "")}`}
                    </td>
                    <td className={TD + " text-center"}>{s.items.reduce((x, i) => x + i.quantity, 0)}</td>
                    <td className={TD + " text-center"}>{money(s.totalAmount)}</td>
                    <td className={TD + " text-center"}>{tab === "return" ? (s.condition === "DAMAGED" ? "Hàng lỗi" : "Hàng nguyên vẹn") : s.note ?? ""}</td>
                    <td className={TD + " text-center"}><Pill label={st.label} tone={st.tone} /></td>
                    <td className={TD}>
                      <div className="flex items-center justify-center gap-2">
                        <Link href={withParams("/retail/returns", params, { edit: s.id })} scroll={false} className="w-11 h-10 rounded-xl bg-blue-50 text-[#1565F5] flex items-center justify-center" title="Xem / sửa"><Eye className="w-6 h-6" /></Link>
                        <Link href={`/print/slip/${s.id}`} target="_blank" className="w-11 h-10 rounded-xl bg-blue-50 text-[#1565F5] flex items-center justify-center" title="In phiếu"><Printer className="w-5 h-5" /></Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {slips.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">Chưa có phiếu nào trong khoảng thời gian này</td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="flex items-center justify-between px-2 pt-3">
            <span className="text-[17px] font-semibold text-[#1E293B]">
              Hiển thị {total ? (page - 1) * PAGE_SIZE + 1 : 0} - {Math.min(page * PAGE_SIZE, total)} trong {total} phiếu
            </span>
            <Pagination page={page} totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))} hrefFor={(p) => withParams("/retail/returns", params, { page: p })} />
          </div>
        </Card>
        {draft && (
          <SlipPanel
            key={draft.id ?? `new-${kind}`}
            catalog={catalog}
            customers={customers}
            locations={locations.map((l) => ({ id: l.id, name: l.name, kind: l.kind }))}
            initial={draft}
            closeHref={base}
          />
        )}
      </PageBody>
    </div>
  );
}
