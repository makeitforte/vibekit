import { DownloaderTopbarClient } from "@/tools/html_downloader/topbar-client";
import { DownloaderWorkspace } from "@/tools/html_downloader/workspace";

export const metadata = {
  title: "HTML Downloader — VibeKit",
};

export default function HtmlDownloaderPage() {
  return (
    <>
      <DownloaderTopbarClient />
      <DownloaderWorkspace />
    </>
  );
}
