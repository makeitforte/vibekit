"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Code2, Braces, Regex, Palette, GitCompare, Binary,
  GitCommitHorizontal, Sparkles, Wand2, Settings2, Search,
} from "lucide-react";
import { TOOLS, ASSIST } from "@/data/tools";
import { cn } from "@/lib/cn";

const ICON_MAP: Record<string, React.ElementType> = {
  Code2, Braces, Regex, Palette, GitCompare, Binary,
  GitCommitHorizontal, Sparkles, Wand2,
};

export interface SidebarProps {
  onOpenPalette: () => void;
}

export function Sidebar({ onOpenPalette }: SidebarProps) {
  const pathname = usePathname();
  const activeCount = TOOLS.filter((t) => t.status === "active").length;

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sidebar-top">
        <div className="logo-mark">
          <svg viewBox="0 0 20 20" width="16" height="16" fill="none">
            <path d="M3 7l4-4 3 3 3-3 4 4M3 13l4 4 3-3 3 3 4-4"
              stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span className="brand-name">VibeKit</span>
        <span className="brand-badge">beta</span>
      </div>

      {/* Search trigger */}
      <button className="search-trigger" onClick={onOpenPalette} type="button">
        <Search size={15} className="text-[var(--fg-4)]" />
        <span className="flex-1 text-left text-[var(--fg-4)]">Search tools…</span>
        <span className="kbd">Ctrl K</span>
      </button>

      {/* Nav scroll area */}
      <div className="sidebar-scroll">
        {/* Tools section */}
        <div className="nav-section-label">
          <span>Tools</span>
          <span className="ml-auto">{activeCount} active</span>
        </div>
        <nav className="nav">
          {TOOLS.map((tool) => {
            const Icon = ICON_MAP[tool.icon];
            const isActive = tool.status === "active";
            const isCurrent = pathname === tool.href;
            return (
              <NavItem
                key={tool.id}
                label={tool.name}
                icon={Icon}
                active={isCurrent}
                disabled={!isActive}
                href={isActive ? tool.href : undefined}
                tag={!isActive ? "soon" : undefined}
              />
            );
          })}
        </nav>

        {/* Personal assistance section */}
        <div className="nav-section-label" style={{ marginTop: 8 }}>
          <span>Personal assistance</span>
        </div>
        <nav className="nav">
          {ASSIST.map((tool) => {
            const Icon = ICON_MAP[tool.icon];
            return (
              <NavItem
                key={tool.id}
                label={tool.name}
                icon={Icon}
                active={false}
                disabled={true}
                tag="AI"
                tagVariant="ai"
              />
            );
          })}
        </nav>
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="avatar">JK</div>
        <div className="min-w-0">
          <div className="footer-name">Jordan Kessler</div>
          <div className="footer-plan">Free plan</div>
        </div>
        <button className="settings-btn" title="Settings" type="button">
          <Settings2 size={16} />
        </button>
      </div>
    </aside>
  );
}

interface NavItemProps {
  label: string;
  icon?: React.ElementType;
  active: boolean;
  disabled: boolean;
  href?: string;
  tag?: string;
  tagVariant?: "default" | "ai";
}

function NavItem({ label, icon: Icon, active, disabled, href, tag, tagVariant = "default" }: NavItemProps) {
  const className = cn(
    "nav-item",
    active && "active",
    disabled && "soon"
  );

  const inner = (
    <>
      {Icon && <Icon size={17} className="flex-shrink-0" />}
      <span className="flex-1 truncate">{label}</span>
      {tag && (
        <span className={cn("nav-tag", tagVariant === "ai" && "ai")}>{tag}</span>
      )}
    </>
  );

  if (href && !disabled) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" className={className} disabled={disabled} tabIndex={-1}>
      {inner}
    </button>
  );
}
