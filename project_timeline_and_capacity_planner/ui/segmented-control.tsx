"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface Option {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: number;
}

interface Props {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
}

export function SegmentedControl({ options, value, onChange }: Props) {
  return (
    <div className="seg-control">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          className={cn("seg-btn", value === opt.id && "active")}
          onClick={() => onChange(opt.id)}
        >
          {opt.icon && <span style={{ display: "inline-flex", verticalAlign: "middle", marginRight: 4 }}>{opt.icon}</span>}
          {opt.label}
          {opt.badge !== undefined && opt.badge > 0 && (
            <span style={{
              marginLeft: 5,
              background: "var(--accent-muted)",
              color: "var(--accent-text)",
              border: "1px solid var(--accent-border)",
              borderRadius: "var(--radius-full)",
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              padding: "1px 5px",
            }}>
              {opt.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
