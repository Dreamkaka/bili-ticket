"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "@/lib/theme";
import { CustomCursor } from "@/components/layout/CustomCursor";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <CustomCursor />
      {children}
    </ThemeProvider>
  );
}
