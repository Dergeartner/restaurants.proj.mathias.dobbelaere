"use client";

import type { Restaurant } from "@/app/types";

export type Filters = {
  search: string;
  kategorie: string;
  stadtteil: string;
  hotOnly: boolean;
  akquiseOnly: boolean;
  lieferandoOnly: boolean;
};

type Props = {
  restaurants: Restaurant[];
  filters: Filters;
  onChange: (next: Filters) => void;
  totalShown: number;
};

export function FilterBar({ restaurants, filters, onChange, totalShown }: Props) {
  const kategorien = uniqueSorted(restaurants.map((r) => r.kategorie));
  const stadtteile = uniqueSorted(restaurants.map((r) => r.stadtteil));

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Suche">
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder="Name oder Cuisine..."
            className="w-56 rounded border border-neutral-300 px-3 py-2 text-sm focus:border-lieferando focus:outline-none"
          />
        </Field>
        <Field label="Kategorie">
          <Select
            value={filters.kategorie}
            onChange={(v) => onChange({ ...filters, kategorie: v })}
          >
            <option value="">Alle</option>
            {kategorien.map((k) => (
              <option key={k} value={k}>
                {labelKategorie(k)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Stadtteil">
          <Select
            value={filters.stadtteil}
            onChange={(v) => onChange({ ...filters, stadtteil: v })}
          >
            <option value="">Alle</option>
            {stadtteile.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
        <Toggle
          label="Nur Hot Leads (3)"
          checked={filters.hotOnly}
          onChange={(v) => onChange({ ...filters, hotOnly: v })}
        />
        <Toggle
          label="Nur Akquise-Kandidaten"
          checked={filters.akquiseOnly}
          onChange={(v) => onChange({ ...filters, akquiseOnly: v })}
          accent
        />
        <Toggle
          label="Nur Lieferando-Partner"
          checked={filters.lieferandoOnly}
          onChange={(v) => onChange({ ...filters, lieferandoOnly: v })}
          variant="lieferando"
        />
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-neutral-600">
            <span className="font-semibold tabular-nums">{totalShown}</span>{" "}
            Treffer
          </span>
          <a
            href="/partnerliste_potsdam.xlsx"
            download
            className="rounded bg-lieferando px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-lieferando-dark"
          >
            Excel herunterladen
          </a>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-lieferando focus:outline-none"
    >
      {children}
    </select>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  accent,
  variant,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  accent?: boolean;
  variant?: "lieferando";
}) {
  const activeStyles =
    variant === "lieferando"
      ? "border-blue-500 bg-blue-50 text-blue-800"
      : accent
        ? "border-lieferando bg-lieferando-50 text-lieferando-dark"
        : "border-emerald-500 bg-emerald-50 text-emerald-700";
  const dotColor =
    variant === "lieferando"
      ? "bg-blue-500"
      : accent
        ? "bg-lieferando"
        : "bg-emerald-500";
  return (
    <label
      className={`flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-sm transition ${
        checked
          ? activeStyles
          : "border-neutral-300 bg-white text-neutral-600 hover:border-neutral-400"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span
        className={`inline-block h-3 w-3 rounded-full ${
          checked ? dotColor : "border border-neutral-400"
        }`}
      />
      {label}
    </label>
  );
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "de"),
  );
}

function labelKategorie(k: string): string {
  const map: Record<string, string> = {
    restaurant: "Restaurant",
    cafe: "Café",
    bar: "Bar",
    fast_food: "Fast Food",
    pub: "Pub",
    biergarten: "Biergarten",
  };
  return map[k] ?? k;
}
