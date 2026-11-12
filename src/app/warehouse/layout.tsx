import { ModuleShell } from "@/components/shell/ModuleShell";

export default function WarehouseLayout({ children }: { children: React.ReactNode }) {
  return <ModuleShell module="warehouse">{children}</ModuleShell>;
}
