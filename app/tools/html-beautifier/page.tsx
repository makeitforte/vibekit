import { BeautifierTopbarClient } from "@/components/tools/html-beautifier/beautifier-topbar-client";
import { BeautifierWorkspace } from "@/components/tools/html-beautifier/beautifier-workspace";

export const metadata = {
  title: "HTML Beautifier — VibeKit",
};

export default function HtmlBeautifierPage() {
  return (
    <>
      <BeautifierTopbarClient />
      <BeautifierWorkspace />
    </>
  );
}
