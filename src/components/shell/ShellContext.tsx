"use client";

import { createContext, useContext } from "react";

export interface ShellNotification {
  id: string;
  title: string;
  message: string;
  at: string;
}

export interface ShellData {
  module: "food" | "retail" | "warehouse";
  storeName: string;
  userName: string;
  roleLabel: string;
  unread: number;
  notifications: ShellNotification[];
}

const Ctx = createContext<ShellData | null>(null);

export function ShellProvider({ value, children }: { value: ShellData; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useShell() {
  return useContext(Ctx);
}
