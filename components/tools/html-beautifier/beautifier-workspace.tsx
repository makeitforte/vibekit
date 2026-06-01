"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Sparkles, Copy, Download, FileCode, Eraser, Wand2, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { beautifyHTML } from "@/lib/beautify";
import { highlightHTML } from "@/lib/highlight";
import { ResizableSplit } from "./resizable-split";

const SAMPLE =
  '<section class="hero" data-active="true"><h1>Ship faster</h1><p>Your dev environment, with a mind of its own.</p><button onclick="run()">Brief an agent</button><!-- cta --><ul><li>One</li><li>Two</li></ul></section>';

type IndentUnit = "  " | "    " | "\t";
type ExportFormat = "html" | "pdf";

export function BeautifierWorkspace() {
  const [input, setInput] = useState(SAMPLE);
  const [output, setOutput] = useState("");
  const [indent, setIndent] = useState<IndentUnit>("  ");
  const [exportDialog, setExportDialog] = useState(false);
  const [filename, setFilename] = useState("formatted");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("html");
  const [pdfLoading, setPdfLoading] = useState(false);
  const gutterRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const lineCount = Math.max(input.split("\n").length, 1);
  const outLines = output ? output.split("\n").length : 0;

  const run = useCallback(() => {
    if (!input.trim()) {
      toast.warning("Nothing to beautify", { description: "Paste some HTML first." });
      return;
    }
    const result = beautifyHTML(input, indent);
    setOutput(result);
    toast.success("Beautified", {
      description: `${result.split("\n").length} lines formatted.`,
    });
  }, [input, indent]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        run();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [run]);

  const copy = useCallback(() => {
    if (!output) {
      toast.info("No output yet", { description: "Hit Beautify first." });
      return;
    }
    navigator.clipboard?.writeText(output);
    toast.success("Copied", { description: `${output.length} characters copied.` });
  }, [output]);

  const doExportHTML = useCallback(() => {
    const content = output || beautifyHTML(input, indent);
    const blob = new Blob([content], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename || "formatted"}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setExportDialog(false);
    toast.success("Exported", { description: `${a.download} downloaded.` });
  }, [output, input, indent, filename]);

  const doExportPDF = useCallback(async () => {
    const content = output || beautifyHTML(input, indent);
    const name = filename || "formatted";

    setPdfLoading(true);
    setExportDialog(false);
    toast.info("Generating PDF…", { description: "Rendering your HTML, please wait." });

    // Wrap snippet in a full document with background-preserve CSS
    const fullDoc = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name}</title>
<style>
  *, *::before, *::after {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
</style>
</head>
<body>${content}</body>
</html>`;

    // Render in a same-origin (blob:) hidden iframe
    const blob = new Blob([fullDoc], { type: "text/html" });
    const blobUrl = URL.createObjectURL(blob);
    const iframe = document.createElement("iframe");
    iframe.src = blobUrl;
    // Off-screen but sized to A4 width at 96 dpi
    iframe.style.cssText =
      "position:fixed;left:-9999px;top:0;width:794px;height:1123px;border:none;visibility:hidden;";
    document.body.appendChild(iframe);

    try {
      // Wait for iframe load + a short settle for fonts/images
      await new Promise<void>((resolve) => { iframe.onload = () => resolve(); });
      await new Promise((r) => setTimeout(r, 800));

      const iframeDoc = iframe.contentDocument;
      if (!iframeDoc) throw new Error("Cannot access iframe document");

      // Dynamic imports — keep initial bundle lean
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      // Capture full page height
      const body = iframeDoc.body;
      const scrollH = body.scrollHeight;
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

      // Build PDF — slice canvas into A4 pages
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
        pdf.addImage(
          canvas.toDataURL("image/png", 1.0),
          "PNG",
          0,
          -yOffset,
          imgW,
          imgH,
        );
        yOffset += pageH;
        remaining -= pageH;
      }

      pdf.save(`${name}.pdf`);
      toast.success("PDF downloaded", { description: `${name}.pdf saved.` });
    } catch (err) {
      console.error(err);
      toast.error("PDF generation failed", { description: "Try again or use the print method." });
    } finally {
      document.body.removeChild(iframe);
      URL.revokeObjectURL(blobUrl);
      setPdfLoading(false);
    }
  }, [output, input, indent, filename]);

  const doExport = useCallback(() => {
    if (exportFormat === "pdf") doExportPDF();
    else doExportHTML();
  }, [exportFormat, doExportPDF, doExportHTML]);

  const syncGutter = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (gutterRef.current) {
      gutterRef.current.scrollTop = (e.target as HTMLTextAreaElement).scrollTop;
    }
  };

  // ── Panes ──

  const inputPane = (
    <div className="bf-pane-inner">
      <div className="bf-colhead">
        <span className="bf-dot" />
        <span className="bf-col-label">Input · HTML</span>
        <span className="bf-col-meta">{input.length} chars</span>
        <button className="pane-btn" title="Load sample" onClick={() => { setInput(SAMPLE); setOutput(""); }} type="button">
          <FileCode size={14} />
        </button>
        <button className="pane-btn" title="Clear" onClick={() => { setInput(""); setOutput(""); }} type="button">
          <Eraser size={14} />
        </button>
      </div>
      <div className="bf-editor-area">
        <div className="bf-gutter" ref={gutterRef}>
          {Array.from({ length: lineCount }, (_, n) => (
            <div key={n}>{n + 1}</div>
          ))}
        </div>
        <textarea
          ref={textareaRef}
          className="bf-textarea"
          value={input}
          spellCheck={false}
          placeholder="<div>paste your markup here…</div>"
          onChange={(e) => setInput(e.target.value)}
          onScroll={syncGutter}
        />
      </div>
    </div>
  );

  const outputPane = (
    <div className="bf-pane-inner">
      <div className="bf-colhead">
        <span className={`bf-dot${output ? " green" : ""}`} />
        <span className="bf-col-label">Output · Formatted</span>
        <span className="bf-col-meta">{outLines ? `${outLines} lines` : "—"}</span>
        <button className="pane-btn" title="Copy output" onClick={copy} type="button">
          <Copy size={14} />
        </button>
      </div>
      <div className="bf-editor-area">
        {output ? (
          <pre className="bf-output-pre">
            <code dangerouslySetInnerHTML={{ __html: highlightHTML(output) }} />
          </pre>
        ) : (
          <div className="bf-empty">
            <div className="bf-empty-icon">
              <Wand2 size={20} />
            </div>
            <p>No output yet. Hit <b>Beautify</b> to format your markup.</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="bf-workspace">
      {/* Tool header */}
      <div className="bf-header">
        <div className="bf-icon">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
        </div>
        <div>
          <h1 className="bf-title">HTML beautifier</h1>
          <p className="bf-subtitle">Paste raw markup, get clean indented HTML.</p>
        </div>
        <div className="bf-opts">
          <span className="seg-label">Indent</span>
          <div className="seg-control">
            {(["  ", "    ", "\t"] as IndentUnit[]).map((u) => (
              <button
                key={u}
                type="button"
                className={`seg-btn${indent === u ? " active" : ""}`}
                onClick={() => setIndent(u)}
              >
                {u === "  " ? "2 sp" : u === "    " ? "4 sp" : "tab"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Split pane */}
      <div className="bf-split-wrap">
        <ResizableSplit left={inputPane} right={outputPane} />
      </div>

      {/* Action bar */}
      <div className="bf-actions">
        <button className="btn btn-primary" onClick={run} type="button">
          <Sparkles size={15} /> Beautify
        </button>
        <button className="btn btn-ghost" onClick={copy} type="button">
          <Copy size={15} /> Copy code
        </button>
        <button className="btn btn-ghost" onClick={() => setExportDialog(true)} type="button">
          <Download size={15} /> Export file
        </button>
        <div className="bf-hint">
          <kbd className="key">Ctrl</kbd>
          <kbd className="key">↵</kbd>
          to beautify
        </div>
      </div>

      {/* Export dialog */}
      {exportDialog && (
        <div className="dlg-scrim" onClick={() => setExportDialog(false)}>
          <div className="dlg" onClick={(e) => e.stopPropagation()}>
            <div className="dlg-body">
              <h3>Export file</h3>
              <p className="dlg-desc">Download the formatted markup as a file.</p>

              {/* Format selector */}
              <label>Format</label>
              <div className="dlg-format-row">
                <button
                  type="button"
                  className={`dlg-format-btn${exportFormat === "html" ? " active" : ""}`}
                  onClick={() => setExportFormat("html")}
                >
                  <FileCode size={16} />
                  <span>.html</span>
                  <span className="dlg-format-desc">Source file</span>
                </button>
                <button
                  type="button"
                  className={`dlg-format-btn${exportFormat === "pdf" ? " active" : ""}`}
                  onClick={() => setExportFormat("pdf")}
                >
                  <FileText size={16} />
                  <span>.pdf</span>
                  <span className="dlg-format-desc">Print / share</span>
                </button>
              </div>

              {/* File name (HTML only) */}
              {exportFormat === "html" && (
                <>
                  <label htmlFor="dlg-fn" style={{ marginTop: 14 }}>File name</label>
                  <div className="dlg-field">
                    <input
                      id="dlg-fn"
                      autoFocus
                      value={filename}
                      onChange={(e) => setFilename(e.target.value.replace(/[^a-zA-Z0-9-_]/g, ""))}
                      onKeyDown={(e) => e.key === "Enter" && doExport()}
                    />
                    <span className="dlg-ext">.html</span>
                  </div>
                </>
              )}

              {exportFormat === "pdf" && (
                <p className="dlg-pdf-note">
                  Renders your HTML in the background and downloads a <strong>.pdf</strong> file directly — no new tab or print dialog needed.
                </p>
              )}
            </div>
            <div className="dlg-foot">
              <button className="btn btn-ghost" onClick={() => setExportDialog(false)} type="button">Cancel</button>
              <button className="btn btn-primary" onClick={doExport} type="button" disabled={pdfLoading}>
                {pdfLoading
                  ? <><Loader2 size={15} className="animate-spin" /> Generating…</>
                  : <><Download size={15} />{exportFormat === "pdf" ? "Download PDF" : "Download"}</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
