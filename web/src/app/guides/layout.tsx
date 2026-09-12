import type { ReactNode } from "react";
import { guidesSource } from "@/lib/source";
import { FluxShell } from "@/components/guides/FluxShell";

export default function Layout({ children }: { children: ReactNode }) {
  return <FluxShell tree={guidesSource.pageTree}>{children}</FluxShell>;
}
