import { ModuleShell } from "@/components/shell/ModuleShell";

export default function FoodLayout({ children }: { children: React.ReactNode }) {
  return <ModuleShell module="food">{children}</ModuleShell>;
}
