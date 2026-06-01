"use client";

import { Topbar } from "@/components/layout/topbar";
import { usePalette } from "@/lib/palette-context";

export function HubTopbarClient() {
  const { openPalette } = usePalette();
  return (
    <Topbar
      crumbs={[{ label: "VibeKit", href: "/" }, { label: "Hub" }]}
      onOpenPalette={openPalette}
    />
  );
}
