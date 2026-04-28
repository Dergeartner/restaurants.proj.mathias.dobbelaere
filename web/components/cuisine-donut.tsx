"use client";

import { useMemo, useState } from "react";
import { PieChart } from "lucide-react";
import type { Restaurant } from "@/app/types";

type Props = {
  restaurants: Restaurant[];
  onSelectCuisine?: (cuisineKey: string, label: string) => void;
};

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
  kebab: "Kebab",
  persian: "Persisch",
  mediterranean: "Mediterran",
  seafood: "Meeresfrüchte",
  international: "International",
  korean: "Koreanisch",
  american: "Amerikanisch",
};

function labelCuisine(c: string): string {
  if (!c) return "Sonstige";
  return CUISINE_LABEL[c.toLowerCase()] ?? c;
}

// Lieferando-/Sales-typische Farbpalette
const PALETTE = [
  "#FF8000", // Lieferando-Orange
  "#FFA94D",
  "#FFD580",
  "#1F6FEB",
  "#3B82F6",
  "#60A5FA",
  "#10B981",
  "#34D399",
  "#A855F7",
  "#EC4899",
  "#F59E0B",
  "#6B7280",
];

const TOP_N = 10;

export function CuisineDonut({ restaurants, onSelectCuisine }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);

  const handleClick = (key: string, label: string) => {
    if (key === "_rest" || key === "_unknown") return;
    onSelectCuisine?.(key, label);
  };

  const data = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of restaurants) {
      const k = (r.cuisine || "").toLowerCase().trim() || "_unknown";
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    const sorted = Array.from(counts.entries())
      .map(([key, count]) => ({ key, label: labelCuisine(key === "_unknown" ? "" : key), count }))
      .sort((a, b) => b.count - a.count);

    const top = sorted.slice(0, TOP_N);
    const restCount = sorted.slice(TOP_N).reduce((s, x) => s + x.count, 0);
    if (restCount > 0) {
      top.push({ key: "_rest", label: "Andere", count: restCount });
    }
    const total = top.reduce((s, x) => s + x.count, 0);
    return top.map((d, i) => ({
      ...d,
      percent: total > 0 ? (d.count / total) * 100 : 0,
      color: d.key === "_rest" ? "#9CA3AF" : PALETTE[i % PALETTE.length],
    }));
  }, [restaurants]);

  const total = data.reduce((s, x) => s + x.count, 0);

  // SVG-Donut: Berechnung der Stroke-Dasharray-Segmente
  const radius = 70;
  const strokeWidth = 22;
  const circumference = 2 * Math.PI * radius;

  let cumulativePercent = 0;
  const segments = data.map((d) => {
    const length = (d.percent / 100) * circumference;
    const offset = -((cumulativePercent / 100) * circumference);
    const segment = {
      ...d,
      length,
      gap: circumference - length,
      offset,
    };
    cumulativePercent += d.percent;
    return segment;
  });

  const focused =
    hovered !== null ? data.find((d) => d.key === hovered) ?? null : null;

  return (
    <div className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <PieChart className="h-4 w-4 text-blue-700" />
          <h4 className="text-sm font-semibold text-blue-950">
            Cuisine-Verteilung Potsdam
          </h4>
        </div>
        <span className="text-[10px] uppercase tracking-wide text-blue-600">
          Top {TOP_N} · {total} Restaurants
        </span>
      </div>

      <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[200px_1fr]">
        {/* Donut */}
        <div className="relative mx-auto h-[200px] w-[200px]">
          <svg
            viewBox="0 0 200 200"
            className="-rotate-90 transform"
            aria-label="Cuisine-Verteilung Donut"
          >
            {/* Hintergrund-Ring */}
            <circle
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke="#F3F4F6"
              strokeWidth={strokeWidth}
            />
            {/* Segmente */}
            {segments.map((seg) => {
              const isFocused = hovered === seg.key;
              const isDimmed = hovered !== null && hovered !== seg.key;
              return (
                <circle
                  key={seg.key}
                  cx="100"
                  cy="100"
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={isFocused ? strokeWidth + 4 : strokeWidth}
                  strokeDasharray={`${seg.length} ${seg.gap}`}
                  strokeDashoffset={seg.offset}
                  strokeLinecap="butt"
                  opacity={isDimmed ? 0.35 : 1}
                  className="cursor-pointer transition-all duration-300 ease-out"
                  onMouseEnter={() => setHovered(seg.key)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => handleClick(seg.key, seg.label)}
                />
              );
            })}
          </svg>
          {/* Center-Label */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            {focused ? (
              <>
                <div className="text-2xl font-bold tabular-nums text-neutral-900">
                  {focused.percent.toFixed(1)}%
                </div>
                <div className="max-w-[120px] truncate text-center text-xs font-medium text-neutral-600">
                  {focused.label}
                </div>
                <div className="text-[10px] tabular-nums text-neutral-400">
                  {focused.count} Restaurants
                </div>
              </>
            ) : (
              <>
                <div className="text-3xl font-bold tabular-nums text-neutral-900">
                  {total}
                </div>
                <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                  Restaurants
                </div>
              </>
            )}
          </div>
        </div>

        {/* Legende */}
        <ul className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
          {data.map((d) => {
            const isFocused = hovered === d.key;
            const isDimmed = hovered !== null && hovered !== d.key;
            return (
              <li
                key={d.key}
                className={`flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 transition ${
                  isFocused ? "bg-neutral-50" : ""
                } ${isDimmed ? "opacity-40" : "opacity-100"}`}
                onMouseEnter={() => setHovered(d.key)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => handleClick(d.key, d.label)}
              >
                <span
                  className="inline-block h-3 w-3 shrink-0 rounded-sm"
                  style={{ backgroundColor: d.color }}
                />
                <span className="flex-1 truncate font-medium text-neutral-800">
                  {d.label}
                </span>
                <span className="shrink-0 tabular-nums text-neutral-500">
                  {d.count}
                </span>
                <span className="w-12 shrink-0 text-right tabular-nums text-neutral-400">
                  {d.percent.toFixed(1)}%
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
