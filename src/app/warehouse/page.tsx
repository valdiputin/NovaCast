import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentStore } from "@/lib/auth";
import { Header } from "@/components/layout/Header";
import { Card, CardTitle, Change, PageBody, pctChange, TH, TD, IconTile } from "@/components/ui/kit";
import { LinkTabs } from "@/components/ui/Tabs";
import { Thumb } from "@/components/ui/Thumb";
import { InOutAreaChart, InOutBarChart } from "@/components/charts/Charts";
import { dayRange, lastDays, bucketByDay, daysAgoDate } from "@/lib/stats";
import { startOfVnDay } from "@/lib/date";
import { cn } from "@/components/ui/common";
import { Database, AlertTriangle, PackageCheck, Upload, BarChart3, ArrowRight, Box, Package, RefreshCw } from "lucide-react";

export const dynamic = "force-dynamic";

const IN_TYPES = ["RECEIPT"] as const;
const OUT_TYPES = ["ISSUE", "DISPOSE"] as const;

async function inOutSeries(storeId: string) {
  const days = lastDays(7);
  const moves = await prisma.stockMovement.findMany({
    where: { storeId, createdAt: { gte: days[0].start }, type: { in: [...IN_TYPES, ...OUT_TYPES] }, NOT: [{ refType: "OPENING" }, { refType: { startsWith: "CANCEL_" } }] },
    select: { createdAt: true, quantityChange: true, type: true },
  });
  const inQ = bucketByDay(days, moves.filter((m) => m.type === "RECEIPT"), (m) => m.createdAt, (m) => m.quantityChange);
  const outQ = bucketByDay(days, moves.filter((m) => m.type !== "RECEIPT"), (m) => m.createdAt, (m) => -m.quantityChange);
  return days.map((d, i) => ({ label: d.label, inQty: inQ[i], outQty: outQ[i] }));
}

export default async function WarehouseDashboard({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const store = await getCurrentStore("WAREHOUSE");
  const sp = await searchParams;
  const tab = sp.tab === "activity" ? "activity" : "overview";
  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Tổng quan"
        actions={<LinkTabs active={tab} tabs={[{ key: "overview", label: "Tổng quan", href: "/warehouse" }, { key: "activity", label: "Hoạt động kho", href: "/warehouse?tab=activity" }]} />}
      />
      <PageBody>{tab === "overview" ? <OverviewTab storeId={store.id} /> : <ActivityTab storeId={store.id} />}</PageBody>
    </div>
  );
}

function WaveCard({ icon, tile, label, value, sub, wave, href }: { icon: React.ReactNode; tile: string; label: string; value: React.ReactNode; sub: React.ReactNode; wave: string; href?: string }) {
  const body = (
    <Card className="relative overflow-hidden p-5 flex gap-4 h-full">
      <svg className="absolute bottom-0 right-0 w-2/3 h-16 opacity-60" viewBox="0 0 200 60" preserveAspectRatio="none" aria-hidden>
        <path d="M0 60 C 60 10, 120 70, 200 0 L200 60 Z" fill={wave} />
      </svg>
      <IconTile className={tile}>{icon}</IconTile>
      <div className="relative min-w-0 flex-1">
        <div className="text-[17px] text-[#1E293B]">{label}</div>
        <div className="text-base sm:text-lg xl:text-xl tabular-nums break-words font-bold text-[#1E293B] leading-tight my-0.5">{value}</div>
        <div className="text-[15px]">{sub}</div>
      </div>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

async function OverviewTab({ storeId }: { storeId: string }) {
  const weekAgo = new Date(startOfVnDay().getTime() - 7 * 86_400_000);
  const [materials, moves7, recToday, recY, issToday, issY, series] = await Promise.all([
    prisma.material.findMany({ where: { storeId, deletedAt: null } }),
    prisma.stockMovement.findMany({ where: { storeId, createdAt: { gte: weekAgo }, materialId: { not: null } }, select: { materialId: true, quantityChange: true } }),
    prisma.stockReceipt.count({ where: { storeId, receiptDate: dayRange(0), status: { not: "CANCELLED" } } }),
    prisma.stockReceipt.count({ where: { storeId, receiptDate: dayRange(1), status: { not: "CANCELLED" } } }),
    prisma.stockIssue.count({ where: { storeId, issueDate: dayRange(0), status: { not: "CANCELLED" } } }),
    prisma.stockIssue.count({ where: { storeId, issueDate: dayRange(1), status: { not: "CANCELLED" } } }),
    inOutSeries(storeId),
  ]);
  const cost = new Map(materials.map((m) => [m.id, Number(m.costPrice)]));
  const value = materials.reduce((s, m) => s + m.totalQty * Number(m.costPrice), 0);
  const valueWeekAgo = value - moves7.reduce((s, mv) => s + mv.quantityChange * (cost.get(mv.materialId!) ?? 0), 0);
  const below = materials.filter((m) => m.totalQty < m.minStock);
  const alerts = below
    .filter((m) => m.type === "RAW_MATERIAL")
    .map((m) => ({ m, ratio: m.totalQty / m.minStock }))
    .sort((a, b) => a.ratio - b.ratio)
    .slice(0, 5);

  return (
    <>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
        <WaveCard icon={<Database className="w-9 h-9" />} tile="bg-blue-50 text-[#1565F5]" wave="#DBEAFE" label="Tổng giá trị tồn kho" value={`${value.toLocaleString("vi-VN")} ₫`} sub={<Change value={pctChange(value, valueWeekAgo)} suffix="so với tuần trước" />} />
        <WaveCard icon={<AlertTriangle className="w-9 h-9 text-white" fill="#E5252A" />} tile="bg-rose-50" wave="#FFE4E6" label="Số mã hàng dưới định mức" value={<span className="text-[#E5252A]">{below.length}</span>} sub={<span className="text-[#E5252A] font-medium">Cần đặt mua gấp</span>} href="/warehouse/items?status=low" />
        <WaveCard icon={<PackageCheck className="w-9 h-9" />} tile="bg-emerald-50 text-emerald-600" wave="#DCFCE7" label="Phiếu Nhập kho trong ngày" value={recToday} sub={<Change value={pctChange(recToday, recY)} suffix="so với hôm qua" />} href="/warehouse/receipts" />
        <WaveCard icon={<Upload className="w-9 h-9" />} tile="bg-purple-50 text-purple-600" wave="#F3E8FF" label="Phiếu Xuất kho trong ngày" value={issToday} sub={<Change value={pctChange(issToday, issY)} suffix="so với hôm qua" />} href="/warehouse/issues" />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_580px] gap-5">
        <Card className="p-6">
          <CardTitle icon={<BarChart3 className="w-8 h-8 text-[#1565F5]" />}>Nhập – Xuất 7 ngày gần nhất</CardTitle>
          <InOutBarChart data={series} />
        </Card>
        <Card className="p-6">
          <CardTitle
            icon={<AlertTriangle className="w-8 h-8 text-white" fill="#E5252A" />}
            right={
              <Link href="/warehouse/items?status=low" className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-50 text-[#1565F5] text-sm font-semibold">
                Xem tất cả <ArrowRight className="w-4 h-4" />
              </Link>
            }
          >
            Cảnh báo tồn kho
          </CardTitle>
          <table className="w-full">
            <thead className="bg-[#F1F5FD]">
              <tr>
                <th className={TH + " rounded-l-xl"}>Nguyên vật liệu</th>
                <th className={TH + " text-center"}>Tồn kho hiện tại</th>
                <th className={TH + " text-center"}>Mức tối thiểu</th>
                <th className={TH + " text-center rounded-r-xl"}>Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[17px] text-[#1E293B]">
              {alerts.map(({ m, ratio }) => (
                <tr key={m.id}>
                  <td className={TD + " py-3 min-w-[190px]"}>
                    <span className="flex items-center gap-3">
                      <Thumb src={m.imageUrl ?? guessEmoji(m.name)} alt={m.name} size={52} />
                      {m.name}
                    </span>
                  </td>
                  <td className={TD + " text-center"}>{m.totalQty} {m.unit}</td>
                  <td className={TD + " text-center"}>{m.minStock} {m.unit}</td>
                  <td className={TD + " text-center"}>
                    <span className={cn("px-3 py-1.5 rounded-lg text-[15px] font-semibold whitespace-nowrap", ratio < 0.5 ? "bg-rose-50 text-[#E5252A]" : "bg-amber-50 text-amber-600")}>
                      {ratio < 0.5 ? "Sắp hết" : "Cần lưu ý"}
                    </span>
                  </td>
                </tr>
              ))}
              {alerts.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400">Không có nguyên vật liệu dưới định mức</td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}

/** Ảnh minh họa theo tên (dùng cho thông báo kho / vật tư chưa có ảnh) */
function guessEmoji(name: string) {
  const n = name.toLowerCase();
  if (n.includes("thép") || n.includes("ống thép")) return "emoji:🔩";
  if (n.includes("bao") || n.includes("xi măng") || n.includes("bột")) return "emoji:🛍️";
  if (n.includes("tôn") || n.includes("tấm")) return "emoji:🪨";
  if (n.includes("nhựa") || n.includes("pvc")) return "emoji:🧪";
  if (n.includes("gỗ")) return "emoji:🪵";
  if (n.includes("vải") || n.includes("sợi") || n.includes("chỉ")) return "emoji:🧵";
  if (n.includes("quần")) return "emoji:👖";
  if (n.includes("áo")) return "emoji:👕";
  return "emoji:📦";
}

async function ActivityTab({ storeId }: { storeId: string }) {
  const [materials, receiptsMonth, series, notes] = await Promise.all([
    prisma.material.findMany({ where: { storeId, deletedAt: null }, select: { totalQty: true, minStock: true, type: true, locationBin: true } }),
    prisma.stockReceipt.count({ where: { storeId, receiptDate: { gte: daysAgoDate(30) }, status: { not: "CANCELLED" } } }),
    inOutSeries(storeId),
    prisma.notification.findMany({ where: { storeId }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);
  const stock = materials.reduce((s, m) => s + m.totalQty, 0);
  const low = materials.filter((m) => m.totalQty <= m.minStock).length;
  const NOTE_COLORS = ["text-[#E5252A] bg-rose-50", "text-orange-500 bg-orange-50", "text-[#1565F5] bg-blue-50", "text-emerald-600 bg-emerald-50", "text-slate-600 bg-slate-100"];
  const MSG_COLORS = ["text-[#E5252A]", "text-orange-500", "text-[#1565F5]", "text-emerald-600", "text-slate-600"];
  return (
    <>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
        <SimpleStat icon={<Box className="w-9 h-9" />} tile="bg-blue-50 text-[#1565F5]" value={materials.length} label="Danh mục hàng hóa" />
        <SimpleStat icon={<Package className="w-9 h-9" />} tile="bg-emerald-50 text-emerald-600" value={stock.toLocaleString("vi-VN")} label="Tồn kho hiện tại" />
        <SimpleStat icon={<AlertTriangle className="w-9 h-9 text-white" fill="#F59E0B" />} tile="bg-amber-50" value={low} label="Sắp hết hàng" />
        <SimpleStat icon={<RefreshCw className="w-9 h-9" />} tile="bg-purple-50 text-purple-600" value={receiptsMonth} label="Phiếu nhập trong tháng" />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_470px] gap-5">
        <Card className="p-6">
          <CardTitle>Tình hình nhập - xuất kho 7 ngày gần nhất</CardTitle>
          <InOutAreaChart data={series} />
        </Card>
        <Card className="p-6">
          <CardTitle>Thông báo kho</CardTitle>
          <ol className="space-y-4">
            {notes.map((n, i) => (
              <li key={n.id} className="flex items-center gap-5">
                <span className={cn("w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold", NOTE_COLORS[i % 5])}>{i + 1}</span>
                <Thumb src={guessEmoji(n.title)} alt={n.title} size={60} />
                <div>
                  <div className="text-[20px] font-medium text-[#1E293B]">{n.title}</div>
                  <div className={cn("text-[17px]", MSG_COLORS[i % 5])}>{n.message}</div>
                </div>
              </li>
            ))}
            {notes.length === 0 && <li className="text-slate-400">Không có thông báo</li>}
          </ol>
        </Card>
      </div>
    </>
  );
}

function SimpleStat({ icon, tile, value, label }: { icon: React.ReactNode; tile: string; value: React.ReactNode; label: string }) {
  return (
    <Card className="p-5 flex items-center gap-5">
      <IconTile className={tile}>{icon}</IconTile>
      <div>
        <div className="text-[32px] font-bold text-[#1E293B] leading-tight">{value}</div>
        <div className="text-[17px] text-slate-600">{label}</div>
      </div>
    </Card>
  );
}
