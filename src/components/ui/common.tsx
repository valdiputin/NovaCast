import React from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ----------------------------------------------------
// 1. KPI CARD
// ----------------------------------------------------
interface KpiCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  iconBgColor?: string; // class hoặc mã hex
  changePercent?: number; // % so với kỳ trước
  changeLabel?: string; // "so với hôm qua", "so với tuần trước"
  onClick?: () => void;
  className?: string;
}

export function KpiCard({
  title,
  value,
  icon,
  iconBgColor = "bg-blue-50 text-blue-600",
  changePercent,
  changeLabel = "so với hôm qua",
  onClick,
  className,
}: KpiCardProps) {
  const isPositive = (changePercent ?? 0) >= 0;

  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col justify-between transition-all",
        onClick && "cursor-pointer hover:shadow-md hover:border-blue-200",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <h3 className="text-2xl font-bold text-slate-800 mt-2 tracking-tight">
            {value}
          </h3>
        </div>
        <div
          className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
            iconBgColor
          )}
        >
          {icon}
        </div>
      </div>

      {changePercent !== undefined && (
        <div className="flex items-center text-xs mt-4">
          <span
            className={cn(
              "font-semibold flex items-center mr-1.5",
              isPositive ? "text-emerald-600" : "text-rose-600"
            )}
          >
            {isPositive ? (
              <ArrowUpRight className="w-3.5 h-3.5 mr-0.5 inline" />
            ) : (
              <ArrowDownRight className="w-3.5 h-3.5 mr-0.5 inline" />
            )}
            {Math.abs(changePercent)}%
          </span>
          <span className="text-slate-400">{changeLabel}</span>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------
// 2. STATUS PILL
// ----------------------------------------------------
type PillColor = "green" | "amber" | "red" | "gray" | "blue";

interface StatusPillProps {
  label: string;
  variant?: PillColor;
  className?: string;
}

export function StatusPill({
  label,
  variant = "green",
  className,
}: StatusPillProps) {
  const styles: Record<PillColor, string> = {
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-rose-50 text-rose-700 border-rose-200",
    gray: "bg-slate-100 text-slate-600 border-slate-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
        styles[variant],
        className
      )}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full mr-1.5 shrink-0",
          variant === "green" && "bg-emerald-500",
          variant === "amber" && "bg-amber-500",
          variant === "red" && "bg-rose-500",
          variant === "gray" && "bg-slate-400",
          variant === "blue" && "bg-blue-500"
        )}
      />
      {label}
    </span>
  );
}

