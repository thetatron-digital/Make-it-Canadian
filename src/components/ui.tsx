"use client";

import Link from "next/link";
import type { ReactNode } from "react";

/** A Macintosh window: striped title bar, close box, hard drop shadow. */
export function Window({
  title,
  children,
  className,
  actions,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <section className={`window ${className ?? ""}`}>
      <div className="titlebar">
        <span aria-hidden className="titlebar-box" />
        <span className="titlebar-label">{title}</span>
        <span className="ml-auto flex items-center gap-2">{actions}</span>
      </div>
      {children}
    </section>
  );
}

/**
 * One numbered step. Collapsed steps show only their title, so the page is
 * a short list of four things to do rather than a wall of sliders - but any
 * step can be reopened at any time, because this is not a wizard.
 */
export function Step({
  number,
  title,
  guide,
  open,
  done,
  onToggle,
  children,
}: {
  number: number;
  title: string;
  guide: string;
  open: boolean;
  done: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="window">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="titlebar w-full text-left transition hover:brightness-[0.97]"
      >
        <span aria-hidden className="titlebar-box" />
        <span className="titlebar-label">
          {number}. {title}
        </span>
        <span className="ml-auto bg-paper px-1.5 py-0.5">
          {done ? (
            <span className="font-display text-[10px] uppercase text-mint">Done</span>
          ) : (
            <span aria-hidden className={`disclosure-arrow block text-[10px] ${open ? "rotate-90" : ""}`}>▶</span>
          )}
        </span>
      </button>
      {open && (
        <div>
          <p className="guide">{guide}</p>
          {children}
        </div>
      )}
    </section>
  );
}

/** A grouped-list row: label on the left, control on the right. */
export function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="row">
      <div className="min-w-0">
        <p className="row-label">{label}</p>
        {hint && <p className="hint mt-0.5">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/** A row whose control needs the full width, such as a slider. */
export function Field({
  label,
  value,
  hint,
  children,
}: {
  label: string;
  value?: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="row-stack">
      <div className="flex items-baseline justify-between gap-3">
        <span className="row-label">{label}</span>
        {value !== undefined && <span className="row-value">{value}</span>}
      </div>
      {children}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

/** Secondary controls, folded away until someone goes looking for them. */
export function FineTune({ children }: { children: ReactNode }) {
  return (
    <details className="border-b border-hair last:border-b-0">
      <summary className="flex items-center gap-2 px-4 py-3 text-[14px] font-semibold text-quiet hover:text-ink">
        <span aria-hidden className="disclosure-arrow inline-block text-[10px] transition-transform">▶</span>
        Fine-tune
      </summary>
      <div className="border-t border-hair">{children}</div>
    </details>
  );
}

export function Slider({
  min,
  max,
  step = 1,
  value,
  onChange,
  ariaLabel,
}: {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  ariaLabel: string;
}) {
  return (
    <input
      type="range"
      aria-label={ariaLabel}
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  full,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  full?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`grid grid-flow-col rounded-lg border-[1.5px] border-ink bg-paper p-0.5 ${full ? "w-full" : ""}`}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={`rounded-[5px] px-3 py-1.5 text-[13px] font-semibold transition ${
            value === option.value ? "bg-ink text-paper" : "text-ink hover:bg-desk"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-[30px] w-[50px] shrink-0 rounded-full border-[1.5px] border-ink transition ${
        checked ? "bg-maple" : "bg-desk"
      }`}
    >
      <span
        className={`absolute top-[2px] h-[22px] w-[22px] rounded-full border-[1.5px] border-ink bg-paper transition-all ${
          checked ? "left-[22px]" : "left-[2px]"
        }`}
      />
    </button>
  );
}

/** The menu bar, which is where a Macintosh keeps its navigation. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b-[1.5px] border-ink bg-paper">
      <div className="mx-auto flex max-w-6xl items-center gap-1 px-2">
        <Link href="/" className="flex items-center gap-2 px-2.5 py-1.5 text-[14px] font-bold hover:bg-ink hover:text-paper">
          <span aria-hidden className="text-maple">🍁</span>
          <span className="font-display text-[12px] uppercase">Make It Canadian</span>
        </Link>
        <nav className="ml-auto flex items-center gap-1">
          <Link href="/how" className="px-2.5 py-1.5 text-[14px] font-medium hover:bg-ink hover:text-paper">
            Setup help
          </Link>
          <Link href="/edit" className="px-2.5 py-1.5 text-[14px] font-medium hover:bg-ink hover:text-paper">
            Make one
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  return (
    <button
      type="button"
      className="btn-secondary shrink-0"
      onClick={async (event) => {
        const button = event.currentTarget;
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          // Clipboard permissions vary; the field next to this stays selectable.
          return;
        }
        const original = button.textContent;
        button.textContent = "Copied";
        window.setTimeout(() => {
          button.textContent = original;
        }, 1400);
      }}
    >
      {label}
    </button>
  );
}
