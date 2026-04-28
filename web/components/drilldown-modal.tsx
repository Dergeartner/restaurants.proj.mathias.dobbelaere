"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { Restaurant, SpeisekartenRestaurant } from "@/app/types";

export type DrilldownEntry = {
  gericht: string;
  preis: number;
  kategorie: string;
  restaurant: string;
  cuisine: string;
  stadtteil: string;
};

type Props = {
  open: boolean;
  title: string;
  description: string;
  entries: DrilldownEntry[];
  restaurantLookup: Map<string, Restaurant>;
  onClose: () => void;
  onRestaurantClick?: (r: Restaurant) => void;
};

type SortKey = "preis" | "restaurant" | "gericht";

const CUISINE_LABEL: Record<string, string> = {
  italian: "Italienisch",
  german: "Deutsch",
  asian: "Asiatisch",
  chinese: "Chinesisch",
  japanese: "Japanisch",
  thai: "Thailändisch",
  vietnamese: "Vietnamesisch",
  indian: "Indisch",
  french: "Französisch",
  greek: "Griechisch",
  turkish: "Türkisch",
  doener: "Döner",
  pizza: "Pizza",
  burger: "Burger",
  sushi: "Sushi",
  spanish: "Spanisch",
  mexican: "Mexikanisch",
  vegan: "Vegan",
  vegetarian: "Vegetarisch",
  cafe: "Café",
  coffee_shop: "Coffee Shop",
  ice_cream: "Eis",
  regional: "Regional",
  steak_house: "Steakhouse",
  sandwich: "Sandwich",
};

function labelCuisine(c: string): string {
  if (!c) return "—";
  return CUISINE_LABEL[c.toLowerCase()] ?? c;
}

export function DrilldownModal({
  open,
  title,
  description,
  entries,
  restaurantLookup,
  onClose,
  onRestaurantClick,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("preis");
  const [sortAsc, setSortAsc] = useState(true);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = entries;
    if (q) {
      list = list.filter(
        (e) =>
          e.gericht.toLowerCase().includes(q) ||
          e.restaurant.toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => {
      const dir = sortAsc ? 1 : -1;
      if (sortKey === "preis") return (a.preis - b.preis) * dir;
      if (sortKey === "restaurant")
        return a.restaurant.localeCompare(b.restaurant, "de") * dir;
      return a.gericht.localeCompare(b.gericht, "de") * dir;
    });
  }, [entries, sortKey, sortAsc, search]);

  const stats = useMemo(() => {
    if (entries.length === 0) return null;
    const prices = entries.map((e) => e.preis);
    const sorted = [...prices].sort((a, b) => a - b);
    const median =
      sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)];
    const restaurants = new Set(entries.map((e) => e.restaurant));
    return {
      count: prices.length,
      restaurants: restaurants.size,
      avg: prices.reduce((a, b) => a + b, 0) / prices.length,
      median,
      min: Math.min(...prices),
      max: Math.max(...prices),
    };
  }, [entries]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="p-0">
        <div className="shrink-0 bg-gradient-to-br from-lieferando-50 via-white to-white px-6 pb-4 pt-6">
          <DialogHeader>
            <div className="flex flex-wrap items-center gap-2">
              <DialogTitle>{title}</DialogTitle>
              {stats && (
                <Badge variant="lieferando">
                  {stats.count} Einträge · {stats.restaurants} Restaurants
                </Badge>
              )}
            </div>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          {stats && (
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <Stat label="Ø Preis" value={`${stats.avg.toFixed(2)} €`} />
              <Stat label="Median" value={`${stats.median.toFixed(2)} €`} />
              <Stat label="Spanne" value={`${stats.min.toFixed(0)}–${stats.max.toFixed(0)} €`} />
            </div>
          )}

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suche nach Gericht oder Restaurant ..."
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
                  <Th onClick={() => toggleSort("gericht")} active={sortKey === "gericht"} asc={sortAsc}>
                    Gericht
                  </Th>
                  <th className="px-3 py-2" title="Speisekarten-Kategorie aus dem Menue (von GPT extrahiert)">
                    Kategorie
                  </th>
                  <Th onClick={() => toggleSort("restaurant")} active={sortKey === "restaurant"} asc={sortAsc}>
                    Restaurant
                  </Th>
                  <th className="px-3 py-2" title="Restaurant-Cuisine aus OpenStreetMap-Tag">
                    Restaurant-Cuisine
                  </th>
                  <Th onClick={() => toggleSort("preis")} active={sortKey === "preis"} asc={sortAsc} align="right">
                    Preis
                  </Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map((e, i) => {
                  const r = restaurantLookup.get(e.restaurant);
                  return (
                    <tr key={`${e.restaurant}-${e.gericht}-${i}`} className="hover:bg-lieferando-50/40">
                      <td className="px-3 py-2 text-neutral-800">{e.gericht}</td>
                      <td className="px-3 py-2 text-xs">
                        {e.kategorie ? (
                          <span className="rounded bg-lieferando-50 px-2 py-0.5 font-medium text-lieferando-dark">
                            {e.kategorie}
                          </span>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {r && onRestaurantClick ? (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              setTimeout(() => onRestaurantClick(r), 100);
                            }}
                            className="inline-flex items-center gap-1 font-medium text-neutral-900 hover:text-lieferando hover:underline"
                          >
                            {e.restaurant}
                            <ExternalLink className="h-3 w-3 opacity-60" />
                          </button>
                        ) : (
                          <span className="font-medium text-neutral-900">{e.restaurant}</span>
                        )}
                        {e.stadtteil && e.stadtteil !== "Unbekannt" && (
                          <div className="text-xs text-neutral-500">{e.stadtteil}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-neutral-600">
                        {labelCuisine(e.cuisine)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold text-neutral-900">
                        {e.preis.toFixed(2)} €
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-lieferando/20 bg-white px-2 py-1.5 shadow-sm">
      <div className="text-[10px] font-medium uppercase tracking-wide text-lieferando-dark">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums text-neutral-900">
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
