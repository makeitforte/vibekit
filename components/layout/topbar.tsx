"use client";

import Link from "next/link";
import { ChevronRight, Search, BookOpen, Bell } from "lucide-react";

interface Crumb {
  label: string;
  href?: string;
}

interface TopbarProps {
  crumbs: Crumb[];
  onOpenPalette: () => void;
}

export function Topbar({ crumbs, onOpenPalette }: TopbarProps) {
  return (
    <div className="topbar">
      <div className="breadcrumb">
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <span key={i} className="flex items-center gap-2">
              {i > 0 && (
                <ChevronRight size={14} className="text-[var(--fg-4)]" />
              )}
              {isLast ? (
                <span className="bc-cur">{crumb.label}</span>
              ) : (
                <Link href={crumb.href ?? "/"} className="bc-link">
                  {crumb.label}
                </Link>
              )}
            </span>
          );
        })}
      </div>

      <div className="topbar-actions">
        <button
          className="icon-btn"
          title="Search (Ctrl+K)"
          onClick={onOpenPalette}
          type="button"
        >
          <Search size={17} />
        </button>
        <button className="icon-btn" title="Documentation" type="button">
          <BookOpen size={17} />
        </button>
        <button className="icon-btn" title="Notifications" type="button">
          <Bell size={17} />
        </button>
      </div>
    </div>
  );
}
