"use client";

import { Sidebar } from "./sidebar";
import { CommandPalette } from "@/components/command-palette";
import { PaletteProvider, usePalette } from "@/lib/palette-context";
import { Toaster } from "sonner";

function ShellInner({ children }: { children: React.ReactNode }) {
  const { open, openPalette, closePalette } = usePalette();

  return (
    <div className="app-shell">
      <Sidebar onOpenPalette={openPalette} />
      <div className="app-main">{children}</div>
      <CommandPalette open={open} onClose={closePalette} />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "var(--surface-1)",
            border: "1px solid var(--border-strong)",
            color: "var(--fg-1)",
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            boxShadow: "var(--shadow-lg)",
          },
        }}
      />
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <PaletteProvider>
      <ShellInner>{children}</ShellInner>
    </PaletteProvider>
  );
}
