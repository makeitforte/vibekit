"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Plus, FolderPlus, ListPlus } from "lucide-react";
import { Project } from "./types";

interface Props {
  projects: Project[];
  onAddProject: (name: string) => void;
  onAddTask: (name: string, projectId: string) => void;
}

type Mode = "menu" | "new-project" | "new-task";

export function AddDropdown({ projects, onAddProject, onAddTask }: Props) {
  const [open, setOpen]       = useState(false);
  const [mode, setMode]       = useState<Mode>("menu");
  const [value, setValue]     = useState("");
  const [projId, setProjId]   = useState(projects[0]?.id ?? "");
  const btnRef                = useRef<HTMLButtonElement>(null);
  const [pos, setPos]         = useState({ top: 0, left: 0 });

  // Sync projId when projects load after mount (async Supabase fetch)
  useEffect(() => {
    if (!projId && projects.length > 0) setProjId(projects[0].id);
  }, [projects, projId]);

  useEffect(() => {
    if (open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, left: r.right - 240 });
    }
  }, [open]);

  useEffect(() => {
    if (!open) { setMode("menu"); setValue(""); }
  }, [open]);

  const close = () => setOpen(false);

  const handleSubmit = () => {
    const name = value.trim();
    if (!name) return;
    if (mode === "new-project") {
      onAddProject(name);
    } else if (mode === "new-task") {
      const pid = projId || projects[0]?.id;
      if (!pid) { alert("Create a project first before adding tasks."); return; }
      onAddTask(name, pid);
    }
    close();
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="btn btn-primary"
        style={{ fontSize: "12.5px", padding: "6px 14px" }}
        onClick={() => setOpen(v => !v)}
      >
        <Plus size={13} /> Add
      </button>

      {open && createPortal(
        <>
          {/* Backdrop */}
          <div style={{ position: "fixed", inset: 0, zIndex: 799 }} onClick={close} />

          {/* Dropdown */}
          <div style={{
            position: "fixed", top: pos.top, left: pos.left, zIndex: 800,
            background: "var(--surface-1)", border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lg)",
            width: 240, padding: 8,
          }}>
            {mode === "menu" && (
              <>
                <div style={{ padding: "4px 8px 6px", fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--fg-4)", borderBottom: "1px solid var(--border-subtle)", marginBottom: 4 }}>
                  What do you want to add?
                </div>
                <MenuItem icon={<FolderPlus size={14} />} label="New Project" sub="A top-level project" onClick={() => setMode("new-project")} />
                <MenuItem icon={<ListPlus size={14} />} label="New Task" sub="A task inside a project" onClick={() => setMode("new-task")} />
              </>
            )}

            {(mode === "new-project" || mode === "new-task") && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 4px 8px", borderBottom: "1px solid var(--border-subtle)", marginBottom: 8 }}>
                  <button
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--fg-4)", fontSize: 16, lineHeight: 1 }}
                    onClick={() => setMode("menu")}>←</button>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, color: "var(--fg-2)" }}>
                    {mode === "new-project" ? "New Project" : "New Task"}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <input
                    autoFocus
                    type="text"
                    placeholder={mode === "new-project" ? "Project name…" : "Task name…"}
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleSubmit(); if (e.key === "Escape") close(); }}
                    style={{
                      padding: "7px 10px", borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-strong)", background: "var(--surface-3)",
                      fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--fg-1)",
                      outline: "none", width: "100%",
                    }}
                  />

                  {mode === "new-task" && (
                    <select
                      value={projId}
                      onChange={e => setProjId(e.target.value)}
                      style={{
                        padding: "7px 10px", borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-strong)", background: "var(--surface-3)",
                        fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--fg-2)",
                        outline: "none", width: "100%", cursor: "pointer",
                      }}
                    >
                      {projects.length === 0
                        ? <option value="">No projects — create one first</option>
                        : projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)
                      }
                    </select>
                  )}

                  <button
                    onClick={handleSubmit}
                    disabled={!value.trim() || (mode === "new-task" && !projId)}
                    style={{
                      padding: "8px", borderRadius: "var(--radius-md)",
                      background: "var(--accent)", color: "#fff", border: "none",
                      fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600,
                      cursor: "pointer", opacity: value.trim() ? 1 : 0.45,
                    }}
                  >
                    Create
                  </button>
                </div>
              </>
            )}
          </div>
        </>,
        document.body,
      )}
    </>
  );
}

function MenuItem({ icon, label, sub, onClick }: { icon: React.ReactNode; label: string; sub: string; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
        borderRadius: "var(--radius-md)", cursor: "pointer",
        transition: "background 80ms",
      }}
      onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-3)")}
      onMouseLeave={e => (e.currentTarget.style.background = "")}
    >
      <span style={{ color: "var(--accent)", flexShrink: 0 }}>{icon}</span>
      <div>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600, color: "var(--fg-1)" }}>{label}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-4)" }}>{sub}</div>
      </div>
    </div>
  );
}
