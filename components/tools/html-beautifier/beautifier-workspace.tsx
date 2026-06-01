"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Sparkles, Copy, Download, FileCode, Eraser, Wand2, FileText } from "lucide-react";
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

  const doExportPDF = useCallback(() => {
    const content = output || beautifyHTML(input, indent);
    const name = filename || "formatted";

    // Wrap the snippet in a full, valid HTML document so the browser
    // renders it as a real page (not source code).
    const fullDoc = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
  @page { margin: 1.5cm; size: A4; }
</style>
</head>
<body>
${content}
</body>
</html>`;

    const blob = new Blob([fullDoc], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");

    if (!win) {
      URL.revokeObjectURL(url);
      toast.error("Popup blocked", { description: "Allow popups for this site and try again." });
      return;
    }

    win.addEventListener("load", () => {
      win.print();
      URL.revokeObjectURL(url);
    });

    setExportDialog(false);
    toast.success("Preview opened", { description: "Choose 'Save as PDF' in the print dialog." });
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
                  Opens a live render of your HTML in a new tab, then triggers the print dialog. Choose <strong>Save as PDF</strong> to capture the full visual output.
                </p>
              )}
            </div>
            <div className="dlg-foot">
              <button className="btn btn-ghost" onClick={() => setExportDialog(false)} type="button">Cancel</button>
              <button className="btn btn-primary" onClick={doExport} type="button">
                <Download size={15} />
                {exportFormat === "pdf" ? "Open print preview" : "Download"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
