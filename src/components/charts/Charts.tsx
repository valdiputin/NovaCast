"use client";

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, LabelList, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

const AX = { fontSize: 14, fill: "#1E293B" };
const vnd = (n: number) => n.toLocaleString("vi-VN") + "đ";
const kFmt = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}K` : n === 0 ? "0đ" : String(n));
const trFmt = (n: number) => (n === 0 ? "0đ" : `${Math.round(n / 1_000_000)}tr`);
const kQty = (n: number) => (n >= 1000 ? `${(n / 1000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}k` : String(n));

/** Đồ ăn: Doanh thu 7 ngày (đường + vùng tô) */
export function FoodRevenueChart({ data }: { data: { label: string; revenue: number; orders: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={330}>
      <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="foodFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1565F5" stopOpacity={0.2} />
            <stop offset="100%" stopColor="#1565F5" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#E2E8F0" />
        <XAxis dataKey="label" tick={AX} tickLine={false} axisLine={{ stroke: "#CBD5E1" }} />
        <YAxis tick={AX} tickFormatter={kFmt} tickLine={false} axisLine={{ stroke: "#CBD5E1" }} width={56} />
        <Tooltip formatter={(v, n) => (n === "revenue" ? [vnd(Number(v)), "Doanh thu"] : [v, "Đơn"])} labelStyle={{ fontWeight: 700 }} />
        <Area isAnimationActive={false} type="linear" dataKey="revenue" stroke="#1565F5" strokeWidth={2.5} fill="url(#foodFill)" dot={{ r: 6, fill: "#1565F5", stroke: "white", strokeWidth: 2 }} activeDot={{ r: 8 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Bán lẻ: cột Doanh thu + đường Đơn hàng (2 trục) */
export function RetailComboChart({ data }: { data: { label: string; revenue: number; orders: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={330}>
      <ComposedChart data={data} margin={{ top: 24, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#EEF2F7" vertical={false} />
        <XAxis dataKey="label" tick={AX} tickLine={false} axisLine={{ stroke: "#CBD5E1" }} />
        <YAxis yAxisId="l" tick={AX} tickFormatter={trFmt} tickLine={false} axisLine={{ stroke: "#CBD5E1" }} width={52} />
        <YAxis yAxisId="r" orientation="right" tick={{ ...AX, fill: "#F59E0B" }} tickLine={false} axisLine={false} domain={[0, 400]} width={40} />
        <Tooltip formatter={(v, n) => (n === "Doanh thu" ? [vnd(Number(v)), n] : [v, n])} />
        <Legend verticalAlign="top" height={30} iconType="circle" wrapperStyle={{ fontSize: 15 }} />
        <Bar isAnimationActive={false} yAxisId="l" dataKey="revenue" name="Doanh thu" fill="#1D7BF2" radius={[6, 6, 0, 0]} barSize={34}>
          <LabelList dataKey="revenue" position="top" formatter={(v) => `${(Number(v) / 1_000_000).toFixed(1)}tr`} style={{ fill: "#1E3A8A", fontSize: 14, fontWeight: 600 }} />
        </Bar>
        <Line isAnimationActive={false} yAxisId="r" dataKey="orders" name="Đơn hàng" stroke="#F59E0B" strokeWidth={2.5} dot={{ r: 6, fill: "#F59E0B", stroke: "white", strokeWidth: 2 }} type="monotone" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Top 5 bán chạy (cột + tên dưới cột) */
export function TopProductsChart({ data }: { data: { name: string; qty: number; img: string }[] }) {
  return (
    <ResponsiveContainer width="100%" height={330}>
      <BarChart data={data} margin={{ top: 24, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#EEF2F7" vertical={false} />
        <XAxis
          dataKey="name"
          tickLine={false}
          axisLine={{ stroke: "#CBD5E1" }}
          height={80}
          interval={0}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tick={(props: any) => {
            const d = data[props.payload.index];
            return (
              <g transform={`translate(${props.x},${props.y})`}>
                <text y={26} textAnchor="middle" fontSize={26}>{d?.img?.startsWith("emoji:") ? d.img.slice(6) : "📦"}</text>
                <text y={56} textAnchor="middle" fontSize={14} fill="#1E293B">{props.payload.value}</text>
              </g>
            );
          }}
        />
        <YAxis tick={AX} tickLine={false} axisLine={{ stroke: "#CBD5E1" }} width={52} tickFormatter={(v) => Number(v).toLocaleString("vi-VN")} />
        <Tooltip formatter={(v) => [Number(v).toLocaleString("vi-VN"), "Đã bán"]} />
        <Bar isAnimationActive={false} dataKey="qty" fill="#1D7BF2" radius={[6, 6, 0, 0]} barSize={70}>
          <LabelList dataKey="qty" position="top" formatter={(v) => Number(v).toLocaleString("vi-VN")} style={{ fill: "#1E293B", fontSize: 16, fontWeight: 700 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Kho: Nhập – Xuất (cột nhóm) */
export function InOutBarChart({ data }: { data: { label: string; inQty: number; outQty: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={360}>
      <BarChart data={data} margin={{ top: 24, right: 10, left: 0, bottom: 0 }} barGap={8}>
        <CartesianGrid stroke="#EEF2F7" />
        <XAxis dataKey="label" tick={AX} tickLine={false} axisLine={{ stroke: "#CBD5E1" }} />
        <YAxis tick={AX} tickLine={false} axisLine={{ stroke: "#CBD5E1" }} width={48} tickFormatter={kQty} />
        <Tooltip formatter={(v, n) => [Number(v).toLocaleString("vi-VN"), n]} />
        <Legend verticalAlign="top" height={30} iconType="circle" wrapperStyle={{ fontSize: 15 }} />
        <Bar isAnimationActive={false} dataKey="inQty" name="Nhập kho" fill="#1D7BF2" radius={[5, 5, 0, 0]} barSize={34}>
          <LabelList dataKey="inQty" position="top" formatter={(v) => kQty(Number(v))} style={{ fill: "#1E293B", fontSize: 13, fontWeight: 600 }} />
        </Bar>
        <Bar isAnimationActive={false} dataKey="outQty" name="Xuất kho" fill="#F7931E" radius={[5, 5, 0, 0]} barSize={34}>
          <LabelList dataKey="outQty" position="top" formatter={(v) => kQty(Number(v))} style={{ fill: "#1E293B", fontSize: 13, fontWeight: 600 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Kho: Tình hình nhập - xuất (đường vùng tô) */
export function InOutAreaChart({ data }: { data: { label: string; inQty: number; outQty: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="inFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1565F5" stopOpacity={0.18} />
            <stop offset="100%" stopColor="#1565F5" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="outFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F7931E" stopOpacity={0.18} />
            <stop offset="100%" stopColor="#F7931E" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#E2E8F0" />
        <XAxis dataKey="label" tick={AX} tickLine={false} axisLine={{ stroke: "#CBD5E1" }} />
        <YAxis tick={AX} tickLine={false} axisLine={{ stroke: "#CBD5E1" }} width={48} tickFormatter={kQty} />
        <Tooltip formatter={(v, n) => [Number(v).toLocaleString("vi-VN"), n]} />
        <Legend verticalAlign="top" height={30} iconType="circle" wrapperStyle={{ fontSize: 15 }} />
        <Area isAnimationActive={false} type="monotone" dataKey="inQty" name="Nhập kho" stroke="#1565F5" strokeWidth={2.5} fill="url(#inFill)" dot={{ r: 6, fill: "#1565F5", stroke: "white", strokeWidth: 2 }} />
        <Area isAnimationActive={false} type="monotone" dataKey="outQty" name="Xuất kho" stroke="#F7931E" strokeWidth={2.5} fill="url(#outFill)" dot={{ r: 6, fill: "#F7931E", stroke: "white", strokeWidth: 2 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
