"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, ExternalLink, Phone, Globe } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { Restaurant } from "@/app/types";

type Props = {
  open: boolean;
  stadtteil: string | null;
  restaurants: Restaurant[];
  onClose: () => void;
  onRestaurantClick: (r: Restaurant) => void;
};

type SortKey = "name" | "score" | "kategorie";

const KATEGORIE_LABEL: Record<string, string> = {
  restaurant: "Restaurant",
  cafe: "Café",
  bar: "Bar",
  fast_food: "Fast Food",
  pub: "Pub",
  biergarten: "Biergarten",
  lieferando_only: "Lieferando-only",
  lieferando_non_gastro: "Convenience",
};

const CUISINE_LABEL: Record<string, string> = {
  italian: "Italienisch", german: "Deutsch", asian: "Asiatisch",
  chinese: "Chinesisch", japanese: "Japanisch", thai: "Thailändisch",
  vietnamese: "Vietnamesisch", indian: "Indisch", french: "Französisch",
  greek: "Griechisch", turkish: "Türkisch", doener: "Döner",
  pizza: "Pizza", burger: "Burger", sushi: "Sushi",
  spanish: "Spanisch", mexican: "Mexikanisch", vegan: "Vegan",
  vegetarian: "Vegetarisch", cafe: "Café", coffee_shop: "Coffee Shop",
  ice_cream: "Eis", regional: "Regional", steak_house: "Steakhouse",
  sandwich: "Sandwich",
};

export function StadtteilRestaurantsModal({
  open,
  stadtteil,
  restaurants,
  onClose,
  onRestaurantClick,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortAsc, setSortAsc] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = restaurants;
    if (q) {
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.cuisine ?? "").toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => {
      const dir = sortAsc ? 1 : -1;
      if (sortKey === "score") return (a.lead_score - b.lead_score) * dir;
      if (sortKey === "kategorie")
        return a.kategorie.localeCompare(b.kategorie, "de") * dir;
      return a.name.localeCompare(b.name, "de") * dir;
    });
  }, [restaurants, sortKey, sortAsc, search]);

  const stats = useMemo(() => {
    const total = restaurants.length;
    const hot = restaurants.filter((r) => r.lead_score === 3).length;
    const onLieferando = restaurants.filter((r) => r.auf_lieferando).length;
    const akquise = restaurants.filter(
      (r) => !r.auf_lieferando && r.lead_score >= 2,
    ).length;
    return { total, hot, onLieferando, akquise };
  }, [restaurants]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(key === "name");
    }
  };

  if (!stadtteil) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="p-0">
        <div className="shrink-0 bg-gradient-to-br from-blue-50 via-white to-white px-6 pb-4 pt-6">
          <DialogHeader>
            <div className="flex flex-wrap items-center gap-2">
              <DialogTitle>Stadtteil: {stadtteil}</DialogTitle>
              <Badge variant="info">{stats.total} Restaurants</Badge>
            </div>
            <DialogDescription>
              Klick auf einen Eintrag öffnet das Restaurant-Detail-Modal mit
              Stammdaten und Speisekarte.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Gesamt" value={stats.total} accent="text-neutral-900" />
            <Stat label="Hot Leads" value={stats.hot} accent="text-emerald-700" />
            <Stat label="Auf Lieferando" value={stats.onLieferando} accent="text-blue-700" />
            <Stat label="Akquise-Targets" value={stats.akquise} accent="text-lieferando-dark" />
          </div>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suche nach Name oder Cuisine ..."
            className="mt-3 w-full rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm focus:border-lieferando focus:outline-none"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-neutral-500">
              Keine Treffer.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-600 shadow-sm">
                <tr>
                  <Th onClick={() => toggleSort("name")} active={sortKey === "name"} asc={sortAsc}>
                    Restaurant
                  </Th>
                  <Th onClick={() => toggleSort("kategorie")} active={sortKey === "kategorie"} asc={sortAsc}>
                    Kategorie / Cuisine
                  </Th>
                  <th className="px-3 py-2">Kontakt</th>
                  <Th onClick={() => toggleSort("score")} active={sortKey === "score"} asc={sortAsc} align="right">
                    Score
                  </Th>
                  <th className="px-3 py-2 text-right">Lieferando</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map((r, i) => {
                  const scoreVariant =
                    r.lead_score === 3
                      ? "success"
                      : r.lead_score === 2
                        ? "warning"
                        : "danger";
                  const scoreLabel =
                    r.lead_score === 3 ? "Hot" : r.lead_score === 2 ? "Warm" : "Cold";
                  const cuisine = r.cuisine
                    ? CUISINE_LABEL[r.cuisine.toLowerCase()] ?? r.cuisine
                    : null;
                  const kategorie = KATEGORIE_LABEL[r.kategorie] ?? r.kategorie;
                  return (
                    <tr
                      key={`${r.name}-${i}`}
                      className="cursor-pointer transition hover:bg-lieferando-50/40"
                      onClick={() => onRestaurantClick(r)}
                    >
                      <td className="px-3 py-2">
                        <div className="inline-flex items-center gap-1 font-medium text-neutral-900 hover:text-lieferando hover:underline">
                          {r.name}
                          <ExternalLink className="h-3 w-3 opacity-50" />
                        </div>
                        {r.adresse && (
                          <div className="mt-0.5 text-xs text-neutral-500">
                            {r.adresse}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <div className="text-neutral-700">{kategorie}</div>
                        {cuisine && (
                          <div className="text-neutral-500">{cuisine}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <div className="flex flex-col gap-0.5">
                          {r.telefon && (
                            <span className="inline-flex items-center gap-1 font-mono text-neutral-700">
                              <Phone className="h-3 w-3 text-neutral-400" />
                              {r.telefon}
                            </span>
                          )}
                          {r.website && (
                            <span className="inline-flex items-center gap-1 text-blue-600">
                              <Globe className="h-3 w-3 text-neutral-400" />
                              {shortUrl(r.website)}
                            </span>
                          )}
                          {!r.telefon && !r.website && (
                            <span className="text-neutral-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Badge variant={scoreVariant}>
                          <span className="tabular-nums">{r.lead_score}</span>{" "}
                          {scoreLabel}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {r.auf_lieferando ? (
                          <Badge variant="info">Partner</Badge>
                        ) : (
                          <span className="text-xs text-neutral-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="rounded border border-neutral-200 bg-white px-2 py-1.5 shadow-sm">
      <div className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className={`mt-0.5 text-lg font-bold tabular-nums ${accent}`}>
        {value}
      </div>
    </div>
  );
}

function Th({
  children,
  onClick,
  active,
  asc,
  align,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  asc: boolean;
  align?: "right";
}) {
  return (
    <th
      onClick={onClick}
      className={`cursor-pointer select-none px-3 py-2 hover:text-neutral-900 ${
        align === "right" ? "text-right" : ""
      }`}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {active ? (
          <span className="text-lieferando">{asc ? "▲" : "▼"}</span>
        ) : (
          <ArrowUpDown className="h-3 w-3 text-neutral-300" />
        )}
      </span>
    </th>
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
