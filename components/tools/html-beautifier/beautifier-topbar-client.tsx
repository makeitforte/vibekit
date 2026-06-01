"use client";

import { Topbar } from "@/components/layout/topbar";
import { usePalette } from "@/lib/palette-context";

export function BeautifierTopbarClient() {
  const { openPalette } = usePalette();
  return (
    <Topbar
      crumbs={[
        { label: "VibeKit", href: "/" },
        { label: "Tools", href: "/" },
        { label: "HTML beautifier" },
      ]}
      onOpenPalette={openPalette}
    />
  );
}
