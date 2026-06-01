"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, LayoutGrid } from "lucide-react";
import {
  Code2, Braces, Regex, Palette, GitCompare, Binary, Files,
  GitCommitHorizontal, Sparkles, Wand2,
} from "lucide-react";
import { ALL_TOOLS, Tool } from "@/data/tools";
import { cn } from "@/lib/cn";

const ICON_MAP: Record<string, React.ElementType> = {
  Code2, Braces, Regex, Palette, GitCompare, Binary, Files,
  GitCommitHorizontal, Sparkles, Wand2,
};

interface PaletteItem {
  id: string;
  icon: React.ElementType;
  label: string;
  kind: string;
  action: () => void;
  disabled?: boolean;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const items: PaletteItem[] = [
    {
      id: "home",
      icon: LayoutGrid,
      label: "Go to hub",
      kind: "Nav",
      action: () => router.push("/"),
    },
    ...ALL_TOOLS.map((t: Tool) => ({
      id: t.id,
      icon: ICON_MAP[t.icon] ?? Code2,
      label: t.name,
      kind: t.status === "active" ? "Tool" : t.status === "ai" ? "AI" : "Soon",
      action: () => {
        if (t.status === "active" && t.href) router.push(t.href);
      },
      disabled: t.status !== "active",
    })),
  ];

  const filtered = items.filter((i) =>
    i.label.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => { setSelected(0); }, [query]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => Math.min(s + 1, filtered.length - 1)); }
      if (e.key === "ArrowUp")   { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
      if (e.key === "Enter") {
        e.preventDefault();
        const item = filtered[selected];
        if (item && !item.disabled) { item.action(); onClose(); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, filtered, selected, onClose]);

  if (!open) return null;

  return (
    <div
      className="palette-overlay"
      onClick={onClose}
      style={{ animation: `scrimIn ${180}ms var(--ease-out)` }}
    >
      <div
        className="palette-box"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: `slideDown ${180}ms var(--ease-out)` }}
      >
        {/* Input row */}
        <div className="palette-input-row">
          <Search size={18} className="text-[var(--fg-3)] flex-shrink-0" />
          <input
            ref={inputRef}
            className="palette-input"
            placeholder="Search tools or jump to…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="kbd">esc</span>
        </div>

        {/* Results */}
        <div className="palette-list">
          {filtered.length === 0 ? (
            <div className="palette-empty">No matches for &ldquo;{query}&rdquo;</div>
          ) : (
            filtered.map((item, i) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={cn("palette-item", i === selected && "selected")}
                  onMouseEnter={() => setSelected(i)}
                  onClick={() => { if (!item.disabled) { item.action(); onClose(); } }}
                >
                  <Icon size={16} className="flex-shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                  <span className="palette-kind">{item.kind}</span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
