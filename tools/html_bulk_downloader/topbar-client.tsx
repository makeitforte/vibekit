"use client";

import { Topbar } from "@/components/layout/topbar";
import { usePalette } from "@/lib/palette-context";

export function BulkDownloaderTopbarClient() {
  const { openPalette } = usePalette();
  return (
    <Topbar
      crumbs={[
        { label: "VibeKit", href: "/" },
        { label: "Tools", href: "/" },
        { label: "HTML bulk downloader" },
      ]}
      onOpenPalette={openPalette}
    />
  );
}
