"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import type { Restaurant } from "@/app/types";

const BEZIRKS_MAPPING: Record<string, string[]> = {
  "11": ["Historische Innenstadt", "Nikolaigärten"],
  "12": ["Brandenburger Vorstadt", "Westliche Vorstadt"],
  "13": ["Berliner Vorstadt"],
  "14": ["Jägervorstadt", "Nauener Vorstadt"],
  "15": ["Nauener Vorstadt"],
  "16": ["Templiner Vorstadt"],
  "17": ["Teltower Vorstadt", "Auf dem Kiewitt"],
  "21": ["Babelsberg Nord"],
  "22": ["Babelsberg Süd"],
  "23": ["Klein Glienicke"],
  "31": ["Bornim", "Nedlitz"],
  "32": ["Bornstedt", "Bornstedter Feld"],
  "41": ["Eiche"],
  "43": ["Golm"],
  "44": ["Wildpark"],
  "51": ["Potsdam West"],
  "52": ["Stern"],
  "53": ["Drewitz"],
  "61": ["Schlaatz"],
  "62": ["Schlaatz"],
  "63": ["Waldstadt I"],
  "64": ["Waldstadt II"],
  "65": ["Industriegelände"],
  "71": ["Kirchsteigfeld"],
  "72": ["Drewitz"],
  "73": ["Stern"],
  "81": ["Marquardt"],
  "82": ["Satzkorn"],
  "83": ["Uetz-Paaren"],
  "84": ["Fahrland"],
  "85": ["Neu Fahrland"],
  "86": ["Groß Glienicke"],
};

const BEZIRKS_POSITIONS: Record<string, { x: number; y: number }> = {
  "81": { x: 157.3, y: 268.89 },
  "82": { x: 331.29, y: 352.89 },
  "83": { x: 352.29, y: 250.89 },
  "84": { x: 469.28, y: 259.89 },
  "85": { x: 583.27, y: 433.88 },
  "86": { x: 805.26, y: 250.89 },
  "11": { x: 436.28, y: 538.88 },
  "12": { x: 595.27, y: 511.88 },
  "13": { x: 553.28, y: 616.87 },
  "14": { x: 727.27, y: 484.88 },
  "15": { x: 400.28, y: 687.87 },
  "16": { x: 298.29, y: 490.88 },
  "17": { x: 307.29, y: 652.87 },
  "31": { x: 505.28, y: 712.87 },
  "21": { x: 654.27, y: 652.87 },
  "22": { x: 585.27, y: 666.87 },
  "23": { x: 718.27, y: 643.87 },
  "32": { x: 432.7532, y: 848.6322 },
  "64": { x: 817.26, y: 913.66 },
  "65": { x: 760.27, y: 936.86 },
  "73": { x: 918.26, y: 934.86 },
  "63": { x: 767.27, y: 841.86 },
  "61": { x: 575.94, y: 918.13 },
  "62": { x: 697.27, y: 814.86 },
  "53": { x: 823.26, y: 811.86 },
  "51": { x: 823.26, y: 618.87 },
  "52": { x: 802.26, y: 715.87 },
  "71": { x: 928.26, y: 808.86 },
  "72": { x: 865.26, y: 907.86 },
  "41": { x: 655.27, y: 688.87 },
  "44": { x: 664.27, y: 775.71 },
  "43": { x: 711.09, y: 739.57 },
};

type StadtteilStats = {
  name: string;
  count: number;
  median_price: number | null;
  hot_leads: number;
  on_lieferando: number;
};

type Props = {
  restaurants: Restaurant[];
  speisekartenRestaurants?: { name: string; gerichte: { preis: number; kategorie: string }[] }[];
  onSelectStadtteil?: (stadtteil: string) => void;
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

const SPEISE_KAT = new Set([
  "vorspeise", "suppe", "salat", "pizza", "pasta", "burger", "hauptgericht",
  "spezialität", "spezialitaet", "beilage", "snack", "frühstück", "fruehstueck",
  "kindergericht", "dessert", "sonstiges",
]);

// Lieferando-Orange-basierte Color-Scale: blassgelb → kräftig orange
function priceColor(price: number, min: number, max: number): string {
  if (max === min) return "#FFB870";
  const t = Math.max(0, Math.min(1, (price - min) / (max - min)));
  // Skala: #FFF4D6 (sehr hell) → #E07300 (Lieferando-dark, intensiv)
  const stops = [
    { t: 0.0, r: 255, g: 244, b: 214 },
    { t: 0.33, r: 255, g: 200, b: 130 },
    { t: 0.67, r: 255, g: 140, b: 50 },
    { t: 1.0, r: 224, g: 100, b: 0 },
  ];
  let lower = stops[0];
  let upper = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i].t && t <= stops[i + 1].t) {
      lower = stops[i];
      upper = stops[i + 1];
      break;
    }
  }
  const range = upper.t - lower.t;
  const localT = range === 0 ? 0 : (t - lower.t) / range;
  const r = Math.round(lower.r + (upper.r - lower.r) * localT);
  const g = Math.round(lower.g + (upper.g - lower.g) * localT);
  const b = Math.round(lower.b + (upper.b - lower.b) * localT);
  return `rgb(${r}, ${g}, ${b})`;
}

export function StadtteilMap({
  restaurants,
  speisekartenRestaurants,
  onSelectStadtteil,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgLoaded, setSvgLoaded] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const stadtteilStats = useMemo<Map<string, StadtteilStats>>(() => {
    const result = new Map<string, StadtteilStats>();
    const speisekartenMap = new Map<string, number[]>();
    if (speisekartenRestaurants) {
      for (const sr of speisekartenRestaurants) {
        const r = restaurants.find((x) => x.name === sr.name);
        if (!r || !r.stadtteil || r.stadtteil === "Unbekannt") continue;
        const prices = sr.gerichte
          .filter((g) => SPEISE_KAT.has((g.kategorie ?? "").toLowerCase()) || !g.kategorie)
          .map((g) => g.preis)
          .filter((p) => p >= 4 && p <= 60);
        if (prices.length === 0) continue;
        const m = median(prices);
        if (m == null) continue;
        if (!speisekartenMap.has(r.stadtteil)) speisekartenMap.set(r.stadtteil, []);
        speisekartenMap.get(r.stadtteil)!.push(m);
      }
    }
    for (const r of restaurants) {
      if (!r.stadtteil || r.stadtteil === "Unbekannt") continue;
      const existing = result.get(r.stadtteil);
      if (existing) {
        existing.count++;
        if (r.lead_score === 3) existing.hot_leads++;
        if (r.auf_lieferando) existing.on_lieferando++;
      } else {
        result.set(r.stadtteil, {
          name: r.stadtteil,
          count: 1,
          median_price: null,
          hot_leads: r.lead_score === 3 ? 1 : 0,
          on_lieferando: r.auf_lieferando ? 1 : 0,
        });
      }
    }
    for (const [stadtteil, prices] of speisekartenMap.entries()) {
      const stats = result.get(stadtteil);
      if (stats) stats.median_price = median(prices);
    }
    return result;
  }, [restaurants, speisekartenRestaurants]);

  const priceRange = useMemo(() => {
    const prices = Array.from(stadtteilStats.values())
      .map((s) => s.median_price)
      .filter((p): p is number => p != null);
    if (prices.length === 0) return { min: 0, max: 0 };
    return { min: Math.min(...prices), max: Math.max(...prices) };
  }, [stadtteilStats]);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    fetch("/potsdam-stadtteile.svg")
      .then((r) => r.text())
      .then((svgText) => {
        container.innerHTML = svgText;
        const svg = container.querySelector("svg");
        if (!svg) return;
        svg.setAttribute("width", "100%");
        svg.setAttribute("height", "100%");
        svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
        svg.style.maxHeight = "560px";

        // Original-Farbklassen der Stadtteile entfernen — sie überschreiben sonst unser fill
        const stadtteilGroup = svg.querySelector("#Areas_Stadtteile");
        if (stadtteilGroup) {
          stadtteilGroup.querySelectorAll("polygon").forEach((p) => {
            // Klassen wie st1, st3, st4, st5 entfernen
            p.removeAttribute("class");
            (p as SVGPolygonElement).style.fill = "#F5F5F5";
            (p as SVGPolygonElement).style.stroke = "#FFFFFF";
            (p as SVGPolygonElement).style.strokeWidth = "0.5";
          });
        }
        // Auch die Bezirks-Areas entfernen damit sie nicht überlagern
        const bezirksGroup = svg.querySelector("#Areas_Bezirke");
        if (bezirksGroup) {
          bezirksGroup.querySelectorAll("polygon, path").forEach((el) => {
            (el as SVGElement).style.opacity = "0";
          });
        }
        setSvgLoaded(true);
      })
      .catch((e) => console.error("SVG load failed", e));
  }, []);

  useEffect(() => {
    if (!svgLoaded || !containerRef.current) return;
    const container = containerRef.current;
    const svg = container.querySelector("svg");
    if (!svg) return;
    const stadtteilGroup = svg.querySelector("#Areas_Stadtteile");
    if (!stadtteilGroup) return;
    const polygons = stadtteilGroup.querySelectorAll("polygon");

    const polyByBezirk: Record<string, SVGPolygonElement[]> = {};
    for (const code of Object.keys(BEZIRKS_POSITIONS)) {
      polyByBezirk[code] = [];
    }
    polygons.forEach((poly) => {
      try {
        const bbox = (poly as SVGPolygonElement).getBBox();
        for (const [code, pos] of Object.entries(BEZIRKS_POSITIONS)) {
          if (
            pos.x >= bbox.x &&
            pos.x <= bbox.x + bbox.width &&
            pos.y >= bbox.y &&
            pos.y <= bbox.y + bbox.height
          ) {
            polyByBezirk[code].push(poly as SVGPolygonElement);
          }
        }
      } catch {}
    });

    // Color + Events anwenden
    const cleanups: (() => void)[] = [];
    for (const [code, polys] of Object.entries(polyByBezirk)) {
      const stadtteilNames = BEZIRKS_MAPPING[code] || [];
      let stats: StadtteilStats | null = null;
      for (const sname of stadtteilNames) {
        const s = stadtteilStats.get(sname);
        if (s) {
          stats = s;
          break;
        }
      }
      const fillColor =
        stats && stats.median_price != null
          ? priceColor(stats.median_price, priceRange.min, priceRange.max)
          : stats
            ? "#FFF4D6" // hat Restaurants aber keine Preisdaten — sehr hell
            : "#E5E7EB"; // gar keine Daten — neutral grau

      polys.forEach((poly) => {
        poly.style.fill = fillColor;
        poly.style.stroke = "#FFFFFF";
        poly.style.strokeWidth = "1";
        poly.style.cursor = stats ? "pointer" : "default";
        poly.style.transition = "filter 0.15s, stroke-width 0.15s";

        const handleEnter = (e: Event) => {
          if (!stats) return;
          poly.style.filter = "brightness(1.1) drop-shadow(0 0 4px rgba(255, 128, 0, 0.5))";
          poly.style.strokeWidth = "2.5";
          poly.style.stroke = "#FF8000";
          setHovered(stats.name);
        };
        const handleMove = (e: MouseEvent) => {
          const rect = container.getBoundingClientRect();
          setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        };
        const handleLeave = () => {
          poly.style.filter = "";
          poly.style.strokeWidth = "1";
          poly.style.stroke = "#FFFFFF";
          setHovered(null);
          setTooltipPos(null);
        };
        const handleClick = () => {
          if (stats && onSelectStadtteil) onSelectStadtteil(stats.name);
        };

        poly.addEventListener("mouseenter", handleEnter as EventListener);
        poly.addEventListener("mousemove", handleMove as EventListener);
        poly.addEventListener("mouseleave", handleLeave);
        poly.addEventListener("click", handleClick);
        cleanups.push(() => {
          poly.removeEventListener("mouseenter", handleEnter as EventListener);
          poly.removeEventListener("mousemove", handleMove as EventListener);
          poly.removeEventListener("mouseleave", handleLeave);
          poly.removeEventListener("click", handleClick);
        });
      });
    }

    return () => {
      for (const c of cleanups) c();
    };
  }, [svgLoaded, stadtteilStats, priceRange, onSelectStadtteil]);

  const hoveredStats = hovered ? stadtteilStats.get(hovered) : null;

  return (
    <div className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <MapPin className="h-4 w-4 text-blue-700" />
          <h4 className="text-sm font-semibold text-blue-950">
            Stadtteil-Karte Potsdam
          </h4>
        </div>
        <span className="text-[10px] uppercase tracking-wide text-blue-600">
          Einfärbung nach Median-Speisepreis · Hover für Details · Klick öffnet Drilldown
        </span>
      </div>

      <div className="relative">
        <div
          ref={containerRef}
          className="relative min-h-[400px] overflow-hidden rounded-lg border border-neutral-200 bg-gradient-to-br from-blue-50/30 to-white"
        />

        {/* Floating-Tooltip beim Hover */}
        {hoveredStats && tooltipPos && (
          <div
            className="pointer-events-none absolute z-30 min-w-[220px] rounded-lg border border-neutral-200 bg-white p-3 shadow-xl"
            style={{
              left: Math.min(tooltipPos.x + 12, 800),
              top: tooltipPos.y + 12,
            }}
          >
            <div className="text-sm font-semibold text-neutral-900">
              {hoveredStats.name}
            </div>
            <div className="mt-2 space-y-1 text-xs text-neutral-700">
              <div className="flex justify-between gap-4">
                <span>Restaurants</span>
                <span className="tabular-nums font-semibold">
                  {hoveredStats.count}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-emerald-700">Hot Leads</span>
                <span className="tabular-nums font-semibold text-emerald-700">
                  {hoveredStats.hot_leads}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-blue-700">Auf Lieferando</span>
                <span className="tabular-nums font-semibold text-blue-700">
                  {hoveredStats.on_lieferando}
                </span>
              </div>
              {hoveredStats.median_price != null && (
                <div className="mt-1 flex justify-between gap-4 border-t border-neutral-200 pt-1.5">
                  <span className="font-medium">Median-Speisepreis</span>
                  <span className="tabular-nums font-bold text-lieferando-dark">
                    {hoveredStats.median_price.toFixed(2)} €
                  </span>
                </div>
              )}
            </div>
            <div className="mt-2 text-[10px] text-neutral-500">
              Klick öffnet die Speise-Liste
            </div>
          </div>
        )}

        {/* Color-Legende rechts oben */}
        {priceRange.max > priceRange.min && (
          <div className="absolute right-4 top-4 rounded-lg border border-neutral-200 bg-white/95 p-3 shadow-md backdrop-blur-sm">
            <div className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
              Median-Speisepreis
            </div>
            <div
              className="mt-2 h-3 w-32 rounded"
              style={{
                background: `linear-gradient(to right, ${priceColor(priceRange.min, priceRange.min, priceRange.max)}, ${priceColor((priceRange.min + priceRange.max) / 2, priceRange.min, priceRange.max)}, ${priceColor(priceRange.max, priceRange.min, priceRange.max)})`,
              }}
            />
            <div className="mt-1 flex justify-between text-[11px] text-neutral-600 tabular-nums">
              <span>{priceRange.min.toFixed(2)} €</span>
              <span>{priceRange.max.toFixed(2)} €</span>
            </div>
            <div className="mt-2 flex flex-col gap-1 text-[10px] text-neutral-600">
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block h-3 w-3 rounded-sm"
                  style={{ backgroundColor: "#FFF4D6" }}
                />
                Restaurants ohne Preisdaten
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block h-3 w-3 rounded-sm"
                  style={{ backgroundColor: "#E5E7EB" }}
                />
                Keine OSM-Daten
              </div>
            </div>
          </div>
        )}
      </div>

      <p className="mt-3 text-[11px] text-blue-800/70">
        Quelle: Wikimedia Commons (Potsdam_subdivisions.svg, gemeinfrei). Daten:
        OSM-Restaurants + GPT-4o-mini-Speisekarten-Extraktion.
      </p>
    </div>
  );
}
