// Core PDF + ZIP conversion logic — no React dependencies.
// Processes files sequentially to avoid memory overload and browser timeouts.

export interface ConvertResult {
  outputName: string;
  blob: Blob | null;
  error: string | null;
}

export interface FileEntry {
  id: string;
  file: File;
  objectUrl: string;
  outputName: string;
}

// ── Image proxy helper ────────────────────────────────────────────────────────
// Replaces all external <img> src with base64 data URLs fetched through the
// Next.js proxy route so html2canvas can read them without CORS errors.
async function inlineExternalImages(doc: Document): Promise<void> {
  const imgs = Array.from(doc.querySelectorAll<HTMLImageElement>("img[src]"));
  await Promise.allSettled(
    imgs.map(async (img) => {
      const src = img.getAttribute("src") ?? "";
      if (!src.startsWith("http://") && !src.startsWith("https://")) return;
      try {
        const res = await fetch(`/api/img-proxy?url=${encodeURIComponent(src)}`);
        if (!res.ok) return;
        const blob = await res.blob();
        img.src = await blobToDataUrl(blob);
        await img.decode().catch(() => {});
      } catch {
        // Leave as-is; html2canvas will skip unreadable images
      }
    })
  );
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Inject print-color-adjust into an existing full HTML document so background
// colors and images are preserved in the PDF output.
function injectPrintStyles(html: string): string {
  const style = `<style>*,*::before,*::after{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;box-sizing:border-box;}</style>`;
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${style}</head>`);
  }
  // No </head> found — prepend style at start of body or document
  return style + html;
}

// ── Single-file conversion ────────────────────────────────────────────────────
export async function htmlFileToPdfBlob(htmlContent: string): Promise<Blob> {
  // Detect whether it's a full document or a snippet
  const isFullDoc = /^\s*<!DOCTYPE|^\s*<html/i.test(htmlContent);
  const docToRender = isFullDoc
    ? injectPrintStyles(htmlContent)
    : `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
       <meta name="viewport" content="width=device-width,initial-scale=1">
       <style>*,*::before,*::after{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}
       body{margin:0;font-family:system-ui,-apple-system,sans-serif;}</style></head>
       <body>${htmlContent}</body></html>`;

  const blob = new Blob([docToRender], { type: "text/html" });
  const blobUrl = URL.createObjectURL(blob);

  const iframe = document.createElement("iframe");
  iframe.src = blobUrl;
  iframe.style.cssText =
    "position:fixed;left:-9999px;top:0;width:794px;height:1123px;border:none;visibility:hidden;";
  document.body.appendChild(iframe);

  try {
    await new Promise<void>((resolve) => { iframe.onload = () => resolve(); });
    // Let fonts and images settle
    await new Promise((r) => setTimeout(r, 700));

    const iframeDoc = iframe.contentDocument;
    if (!iframeDoc) throw new Error("Cannot access iframe document");

    await inlineExternalImages(iframeDoc);

    // Dynamic imports are module-cached — only fetched once across all files
    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);

    const body = iframeDoc.body;
    const scrollH = Math.max(body.scrollHeight, 1);
    iframe.style.height = `${scrollH}px`;

    const canvas = await html2canvas(body, {
      allowTaint: true,
      useCORS: true,
      scale: 2,
      backgroundColor: null,
      width: 794,
      height: scrollH,
      windowWidth: 794,
      windowHeight: scrollH,
    });

    const pdf = new jsPDF({ orientation: "p", unit: "px", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW;
    const imgH = (canvas.height * pageW) / canvas.width;

    let yOffset = 0;
    let remaining = imgH;
    let first = true;

    while (remaining > 0) {
      if (!first) pdf.addPage();
      first = false;
      pdf.addImage(canvas.toDataURL("image/png", 1.0), "PNG", 0, -yOffset, imgW, imgH);
      yOffset += pageH;
      remaining -= pageH;
    }

    return pdf.output("blob");
  } finally {
    document.body.removeChild(iframe);
    URL.revokeObjectURL(blobUrl);
  }
}

// ── Sequential batch processor ────────────────────────────────────────────────
export interface ProgressInfo {
  current: number;
  total: number;
  currentName: string;
  results: ConvertResult[];
}

export async function processFilesBatch(
  entries: FileEntry[],
  onProgress: (info: ProgressInfo) => void,
  cancelRef: React.MutableRefObject<boolean>
): Promise<ConvertResult[]> {
  const results: ConvertResult[] = [];

  for (let i = 0; i < entries.length; i++) {
    if (cancelRef.current) break;

    const { file, outputName } = entries[i];
    onProgress({ current: i + 1, total: entries.length, currentName: outputName, results });

    try {
      const htmlContent = await file.text();
      const blob = await htmlFileToPdfBlob(htmlContent);
      results.push({ outputName, blob, error: null });
    } catch (err) {
      results.push({ outputName, blob: null, error: String(err) });
    }

    // Yield to the event loop between files so the UI stays responsive
    await new Promise((r) => setTimeout(r, 150));
  }

  return results;
}

// ── ZIP builder ───────────────────────────────────────────────────────────────
export async function buildZip(results: ConvertResult[]): Promise<Blob> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();

  for (const r of results) {
    if (r.blob) {
      zip.file(`${r.outputName}.pdf`, r.blob);
    }
  }

  return zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
}
