import { BulkDownloaderTopbarClient } from "@/tools/html_bulk_downloader/topbar-client";
import { BulkDownloaderWorkspace } from "@/tools/html_bulk_downloader/workspace";

export const metadata = {
  title: "HTML Bulk Downloader — VibeKit",
};

export default function HtmlBulkDownloaderPage() {
  return (
    <>
      <BulkDownloaderTopbarClient />
      <BulkDownloaderWorkspace />
    </>
  );
}
