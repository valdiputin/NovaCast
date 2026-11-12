import { ModuleShell } from "@/components/shell/ModuleShell";

export default function RetailLayout({ children }: { children: React.ReactNode }) {
  return <ModuleShell module="retail">{children}</ModuleShell>;
}
