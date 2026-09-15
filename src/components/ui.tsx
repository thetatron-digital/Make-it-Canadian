"use client";

import Link from "next/link";
import type { ReactNode } from "react";

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
    <div className="space-y-1.5">
      <div className="field-label">
        <span>{label}</span>
        {value !== undefined && <span className="tabular-nums text-slate-300">{value}</span>}
      </div>
      {children}
      {hint && <p className="hint">{hint}</p>}
    </div>
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
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="grid grid-flow-col gap-1 rounded-lg border border-edge bg-ink p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={`rounded-md px-2 py-1.5 text-xs font-semibold transition ${
            value === option.value ? "bg-maple text-white" : "text-slate-300 hover:bg-edge/60"
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
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-maple" : "bg-edge"}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-snow transition-all ${checked ? "left-[22px]" : "left-0.5"}`}
      />
    </button>
  );
}

export function SiteHeader() {
  return (
    <header className="border-b border-edge">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-black tracking-tight">
          <span aria-hidden className="text-maple">🍁</span>
          Make It Canadian
        </Link>
        <nav className="flex items-center gap-4 text-sm font-medium text-slate-300">
          <Link href="/how" className="hover:text-snow">
            Setup help
          </Link>
          <Link href="/edit" className="btn-secondary !py-2">
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
      className="btn-secondary shrink-0 !py-2"
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
