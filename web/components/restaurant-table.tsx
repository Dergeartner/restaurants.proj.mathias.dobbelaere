"use client";

import { useMemo, useState } from "react";
import type { Restaurant } from "@/app/types";

type Props = {
  restaurants: Restaurant[];
  onSelect?: (restaurant: Restaurant) => void;
};

type SortKey = "name" | "kategorie" | "stadtteil" | "lead_score" | "auf_lieferando";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 50;

export function RestaurantTable({ restaurants, onSelect }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("lead_score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...restaurants].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") {
        return (av - bv) * dir;
      }
      if (typeof av === "boolean" && typeof bv === "boolean") {
        return (Number(av) - Number(bv)) * dir;
      }
      return String(av).localeCompare(String(bv), "de") * dir;
    });
  }, [restaurants, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const slice = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "lead_score" ? "desc" : "asc");
    }
    setPage(1);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-600">
            <tr>
              <Th onClick={() => toggleSort("name")} active={sortKey === "name"} dir={sortDir}>
                Name
              </Th>
              <Th
                onClick={() => toggleSort("kategorie")}
                active={sortKey === "kategorie"}
                dir={sortDir}
              >
                Kategorie
              </Th>
              <Th
                onClick={() => toggleSort("stadtteil")}
                active={sortKey === "stadtteil"}
                dir={sortDir}
              >
                Stadtteil
              </Th>
              <th className="px-3 py-2">Cuisine</th>
              <th className="px-3 py-2">Website</th>
              <th className="px-3 py-2">Telefon</th>
              <Th
                onClick={() => toggleSort("lead_score")}
                active={sortKey === "lead_score"}
                dir={sortDir}
              >
                Score
              </Th>
              <Th
                onClick={() => toggleSort("auf_lieferando")}
                active={sortKey === "auf_lieferando"}
                dir={sortDir}
              >
                Lieferando
              </Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {slice.map((r, i) => (
              <tr
                key={`${r.name}-${i}`}
                className={`hover:bg-lieferando-50/50 ${onSelect ? "cursor-pointer" : ""}`}
                onClick={() => onSelect?.(r)}
              >
                <td className="px-3 py-2 font-medium text-neutral-900">
                  <span className="hover:underline">{r.name}</span>
                </td>
                <td className="px-3 py-2 text-neutral-700">{labelKategorie(r.kategorie)}</td>
                <td className="px-3 py-2 text-neutral-700">{r.stadtteil}</td>
                <td className="px-3 py-2 text-neutral-600">{r.cuisine || "—"}</td>
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  {r.website ? (
                    <a
                      href={r.website}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-blue-600 hover:underline"
                    >
                      {shortUrl(r.website)}
                    </a>
                  ) : (
                    <span className="text-neutral-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-neutral-700 tabular-nums">
                  {r.telefon || <span className="text-neutral-400">—</span>}
                </td>
                <td className="px-3 py-2">
                  <ScoreBadge score={r.lead_score} />
                </td>
                <td className="px-3 py-2">
                  {r.auf_lieferando ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      Partner
                    </span>
                  ) : (
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                      offen
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {slice.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-12 text-center text-neutral-500">
                  Keine Treffer mit den aktuellen Filtern.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {sorted.length > PAGE_SIZE && (
        <div className="flex items-center justify-between border-t border-neutral-200 px-4 py-3 text-sm text-neutral-600">
          <span>
            Seite {safePage} von {totalPages} – {sorted.length} Einträge
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage(safePage - 1)}
              className="rounded border border-neutral-300 px-3 py-1 text-sm disabled:opacity-40"
            >
              ‹ Zurück
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage(safePage + 1)}
              className="rounded border border-neutral-300 px-3 py-1 text-sm disabled:opacity-40"
            >
              Weiter ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Th({
  children,
  onClick,
  active,
  dir,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  dir: SortDir;
}) {
  return (
    <th
      onClick={onClick}
      className="cursor-pointer select-none px-3 py-2 hover:text-neutral-900"
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {active && <span className="text-lieferando">{dir === "asc" ? "▲" : "▼"}</span>}
      </span>
    </th>
  );
}

function ScoreBadge({ score }: { score: 1 | 2 | 3 }) {
  const styles = {
    3: "bg-emerald-100 text-emerald-800 ring-emerald-200",
    2: "bg-amber-100 text-amber-800 ring-amber-200",
    1: "bg-red-100 text-red-800 ring-red-200",
  } as const;
  const label = { 3: "Hot", 2: "Warm", 1: "Cold" }[score];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${styles[score]}`}
    >
      <span className="tabular-nums">{score}</span> {label}
    </span>
  );
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  }
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
