import { Sidebar } from "@/components/layout/Sidebar";

export default function FoodLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#F5F7FB]">
      <Sidebar moduleType="food" />
      <div className="flex-1 flex flex-col min-w-0">{children}</div>
    </div>
  );
}

