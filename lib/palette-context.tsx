"use client";

import { createContext, useContext, useState, useEffect } from "react";

interface PaletteContextValue {
  open: boolean;
  openPalette: () => void;
  closePalette: () => void;
}

const PaletteContext = createContext<PaletteContextValue>({
  open: false,
  openPalette: () => {},
  closePalette: () => {},
});

export function PaletteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((p) => !p);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <PaletteContext.Provider
      value={{ open, openPalette: () => setOpen(true), closePalette: () => setOpen(false) }}
    >
      {children}
    </PaletteContext.Provider>
  );
}

export function usePalette() {
  return useContext(PaletteContext);
}
