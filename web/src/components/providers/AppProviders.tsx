"use client";

import type { ReactNode } from "react";
import { Toast } from "@heroui/react";
import { ThemeProvider } from "@/lib/theme";
import { CustomCursor } from "@/components/layout/CustomCursor";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <Toast.Provider
        placement="top end"
        maxVisibleToasts={3}
        className="z-[10050]"
      />
      <CustomCursor />
      {children}
    </ThemeProvider>
  );
}
