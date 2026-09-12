"use client";

import type { ReactNode } from "react";
import { RootProvider } from "fumadocs-ui/provider/next";
import { ToastProvider } from "@/components/ui/Toast";
import { CustomCursor } from "@/components/layout/CustomCursor";
import { ThemeSync } from "@/components/layout/ThemeSync";
import { i18n } from "@/lib/i18n";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <RootProvider
      i18n={i18n}
      theme={{
        defaultTheme: "dark",
        attribute: "class",
        enableSystem: true,
        disableTransitionOnChange: true,
      }}
    >
      <ToastProvider>
        <ThemeSync />
        <CustomCursor />
        {children}
      </ToastProvider>
    </RootProvider>
  );
}
