"use client";

import { useMemo, useState } from "react";
import { Sparkles, TrendingUp, MapPin, ChefHat } from "lucide-react";
import type {
  Gericht,
  Restaurant,
  SpeisekartenPayload,
  SpeisekartenRestaurant,
} from "@/app/types";
import { Badge } from "@/components/ui/badge";
import { CuisineDonut } from "@/components/cuisine-donut";
import { DrilldownModal, type DrilldownEntry } from "@/components/drilldown-modal";

type Props = {
  speisekarten: SpeisekartenPayload | null;
  restaurants: Restaurant[];
  onRestaurantClick?: (r: Restaurant) => void;
};

type DrilldownState = {
  open: boolean;
  title: string;
  description: string;
  entries: DrilldownEntry[];
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
};

function labelCuisine(c: string): string {
  if (!c) return "(keine Angabe)";
  return CUISINE_LABEL[c.toLowerCase()] ?? c;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

const SPEISE_KATEGORIEN = new Set([
  "vorspeise",
  "suppe",
  "salat",
  "pizza",
  "pasta",
  "burger",
  "hauptgericht",
  "spezialität",
  "spezialitaet",
  "beilage",
  "snack",
  "frühstück",
  "fruehstueck",
  "kindergericht",
  "dessert",
  "sonstiges",
]);

function isSpeise(g: Gericht): boolean {
  const k = (g.kategorie ?? "").toLowerCase().trim();
  if (!k) return true;
  return SPEISE_KATEGORIEN.has(k);
}

const PREIS_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: "< 5 €", min: 0, max: 5 },
  { label: "5–10 €", min: 5, max: 10 },
  { label: "10–15 €", min: 10, max: 15 },
  { label: "15–20 €", min: 15, max: 20 },
  { label: "20–25 €", min: 20, max: 25 },
  { label: "25–30 €", min: 25, max: 30 },
  { label: "30+ €", min: 30, max: Infinity },
];

export function MarktInsights({
  speisekarten,
  restaurants,
  onRestaurantClick,
}: Props) {
  const [drilldown, setDrilldown] = useState<DrilldownState>({
    open: false,
    title: "",
    description: "",
    entries: [],
  });

  const restaurantLookup = useMemo(
    () => new Map(restaurants.map((r) => [r.name, r])),
    [restaurants],
  );

  // Alle Speisen flat mit Restaurant-Kontext
  const allEntries = useMemo<DrilldownEntry[]>(() => {
    if (!speisekarten) return [];
    const list: DrilldownEntry[] = [];
    for (const sr of speisekarten.restaurants) {
      const r = restaurantLookup.get(sr.name);
      if (!r) continue;
      for (const g of sr.gerichte) {
        if (!isSpeise(g)) continue;
        if (g.preis < 4 || g.preis > 60) continue;
        list.push({
          gericht: g.gericht,
          preis: g.preis,
          kategorie: g.kategorie,
          restaurant: sr.name,
          cuisine: r.cuisine,
          stadtteil: r.stadtteil,
        });
      }
    }
    return list;
  }, [speisekarten, restaurantLookup]);

  const openBucketDrilldown = (label: string, min: number, max: number) => {
    const entries = allEntries.filter((e) => e.preis >= min && e.preis < max);
    setDrilldown({
      open: true,
      title: `Speisen in ${label}`,
      description: `${entries.length} Einträge in der Preisspanne ${label}`,
      entries,
    });
  };

  const openCuisineDrilldown = (cuisineKey: string, label: string) => {
    const entries = allEntries.filter(
      (e) => e.cuisine.toLowerCase() === cuisineKey.toLowerCase(),
    );
    setDrilldown({
      open: true,
      title: `Speisen — Cuisine: ${label}`,
      description: `Alle Gerichte aus Restaurants der Kategorie ${label} (mit verfügbarer Speisekarte)`,
      entries,
    });
  };

  const openStadtteilDrilldown = (stadtteil: string) => {
    const entries = allEntries.filter((e) => e.stadtteil === stadtteil);
    setDrilldown({
      open: true,
      title: `Speisen — Stadtteil: ${stadtteil}`,
      description: `Alle Gerichte aus Restaurants im Stadtteil ${stadtteil}`,
      entries,
    });
  };

  const insights = useMemo(() => {
    if (!speisekarten || speisekarten.restaurants.length === 0) return null;

    const successful = speisekarten.restaurants.filter(
      (r) => r.anzahl_gerichte > 0,
    );
    if (successful.length === 0) return null;

    const allGerichte = successful.flatMap((r) => r.gerichte);
    const speisen = allGerichte.filter(isSpeise);
    const speisenPreise = speisen
      .map((g) => g.preis)
      .filter((p) => p >= 4 && p <= 60);

    const restaurantLookup = new Map(restaurants.map((r) => [r.name, r]));

    // Pro Restaurant Median seiner Speisen
    const cuisinePrices = new Map<string, number[]>();
    const stadtteilPrices = new Map<string, number[]>();
    const cuisineCounts = new Map<string, number>();

    for (const sr of successful) {
      const r = restaurantLookup.get(sr.name);
      if (!r) continue;
      const prices = sr.gerichte
        .filter(isSpeise)
        .map((g) => g.preis)
        .filter((p) => p >= 4 && p <= 60);
      if (prices.length === 0) continue;
      const restMedian = median(prices);

      const c = (r.cuisine || "").toLowerCase();
      if (c) {
        if (!cuisinePrices.has(c)) cuisinePrices.set(c, []);
        cuisinePrices.get(c)!.push(restMedian);
        cuisineCounts.set(c, (cuisineCounts.get(c) || 0) + 1);
      }
      if (r.stadtteil && r.stadtteil !== "Unbekannt") {
        if (!stadtteilPrices.has(r.stadtteil)) stadtteilPrices.set(r.stadtteil, []);
        stadtteilPrices.get(r.stadtteil)!.push(restMedian);
      }
    }

    const minCount = successful.length < 50 ? 1 : successful.length < 150 ? 2 : 3;

    const cuisineRanking = Array.from(cuisinePrices.entries())
      .filter(([, vals]) => vals.length >= minCount)
      .map(([c, vals]) => ({
        key: c,
        label: labelCuisine(c),
        median: median(vals),
        count: vals.length,
      }))
      .sort((a, b) => b.median - a.median)
      .slice(0, 8);

    const stadtteilRanking = Array.from(stadtteilPrices.entries())
      .filter(([, vals]) => vals.length >= minCount)
      .map(([s, vals]) => ({
        key: s,
        label: s,
        median: median(vals),
        count: vals.length,
      }))
      .sort((a, b) => b.median - a.median)
      .slice(0, 8);

    // Histogram der Speisen-Preise
    const histogram = PREIS_BUCKETS.map((b) => ({
      label: b.label,
      count: speisenPreise.filter((p) => p >= b.min && p < b.max).length,
    }));
    const histogramMax = Math.max(...histogram.map((h) => h.count), 1);

    return {
      processedRestaurants: speisekarten.restaurants.length,
      successCount: successful.length,
      successRate: speisekarten.restaurants.length > 0
        ? (100 * successful.length) / speisekarten.restaurants.length
        : 0,
      totalGerichte: allGerichte.length,
      speisenCount: speisen.length,
      speisenAvg: avg(speisenPreise),
      speisenMedian: median(speisenPreise),
      speisenMin: speisenPreise.length ? Math.min(...speisenPreise) : 0,
      speisenMax: speisenPreise.length ? Math.max(...speisenPreise) : 0,
      cuisineRanking,
      stadtteilRanking,
      histogram,
      histogramMax,
      minCount,
    };
  }, [speisekarten, restaurants]);

  if (!insights) return null;

  return (
    <section className="space-y-4 rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-blue-50/40 p-6 shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-200/60 pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-blue-700" />
          <h3 className="text-lg font-semibold text-blue-950">
            Speisekarten-Marktanalyse Potsdam
          </h3>
        </div>
        <Badge variant="info" className="font-medium">
          {insights.successCount} / {insights.processedRestaurants} Webseiten ·{" "}
          {insights.successRate.toFixed(0)} % erfolgreich · {insights.totalGerichte} Einträge
        </Badge>
      </div>

      {/* KPI-Karten */}
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Ø Speisen-Preis"
          value={`${insights.speisenAvg.toFixed(2)} €`}
          sub={`Median ${insights.speisenMedian.toFixed(2)} €`}
        />
        <KpiCard
          label="Preis-Spanne"
          value={`${insights.speisenMin.toFixed(0)}–${insights.speisenMax.toFixed(0)} €`}
          sub={`über ${insights.speisenCount} Einträge`}
        />
        <KpiCard
          label="Daten-Coverage"
          value={`${insights.successRate.toFixed(0)} %`}
          sub={`von ${insights.processedRestaurants} Webseiten`}
        />
      </div>

      {/* Histogram */}
      <div className="rounded-lg border border-blue-100 bg-white p-5">
        <div className="mb-4 flex items-baseline justify-between gap-2">
          <h4 className="text-sm font-semibold text-blue-950">
            Preisverteilung Speisen
          </h4>
          <span className="text-xs text-blue-700">
            Anzahl Einträge pro Preisspanne
          </span>
        </div>
        {/* CSS-grid mit fixer Höhe für die Balken-Reihe */}
        <div className="grid grid-cols-7 gap-2.5">
          {insights.histogram.map((b) => {
            const heightPx = Math.max(
              b.count > 0 ? 8 : 0,
              Math.round((b.count / insights.histogramMax) * 200),
            );
            const isMax = b.count === insights.histogramMax && b.count > 0;
            const bucket = PREIS_BUCKETS.find((p) => p.label === b.label)!;
            const clickable = b.count > 0;
            return (
              <button
                type="button"
                key={b.label}
                disabled={!clickable}
                onClick={() =>
                  clickable && openBucketDrilldown(b.label, bucket.min, bucket.max)
                }
                className={`group flex flex-col items-stretch text-left ${
                  clickable ? "cursor-pointer" : "cursor-default opacity-60"
                }`}
                title={
                  clickable
                    ? `${b.label}: ${b.count} Einträge — klicken für Detail-Liste`
                    : `${b.label}: 0 Einträge`
                }
              >
                {/* Bar-Track mit fixer Höhe */}
                <div className="relative flex h-[220px] items-end">
                  <div
                    className={`w-full overflow-hidden rounded-t-md transition-[height,filter] duration-700 ease-out ${
                      isMax
                        ? "bg-gradient-to-t from-lieferando-dark via-lieferando to-lieferando/80 shadow-[0_-2px_12px_rgba(255,128,0,0.35)]"
                        : "bg-gradient-to-t from-lieferando via-lieferando/85 to-lieferando/55"
                    } group-hover:brightness-110 group-hover:shadow-[0_-2px_16px_rgba(255,128,0,0.5)]`}
                    style={{ height: `${heightPx}px` }}
                  >
                    {/* subtle highlight oben */}
                    <div className="h-full w-full bg-gradient-to-b from-white/30 to-transparent" />
                  </div>
                </div>
                {/* Wert direkt unter dem Balken */}
                <div className="mt-2 text-center text-base font-bold tabular-nums text-neutral-900">
                  {b.count}
                </div>
                <div className="text-center text-[11px] font-medium text-neutral-500">
                  {b.label}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Cuisine-Donut */}
      <CuisineDonut restaurants={restaurants} onSelectCuisine={openCuisineDrilldown} />

      {/* Bar-Charts */}
      <div className="grid gap-3 lg:grid-cols-2">
        <BarRanking
          icon={<ChefHat className="h-4 w-4" />}
          title="Teuerste Cuisines (Median)"
          subtitle={
            insights.cuisineRanking.length === 0
              ? "Zu wenig Daten je Cuisine"
              : `Min. ${insights.minCount} Restaurant${insights.minCount > 1 ? "s" : ""} pro Cuisine`
          }
          items={insights.cuisineRanking}
          onSelect={(item) => openCuisineDrilldown(item.key, item.label)}
        />
        <BarRanking
          icon={<MapPin className="h-4 w-4" />}
          title="Teuerste Stadtteile (Median)"
          subtitle={
            insights.stadtteilRanking.length === 0
              ? "Zu wenig Daten je Stadtteil"
              : `Min. ${insights.minCount} Restaurant${insights.minCount > 1 ? "s" : ""} pro Stadtteil`
          }
          items={insights.stadtteilRanking}
          onSelect={(item) => openStadtteilDrilldown(item.label)}
        />
      </div>

      <DrilldownModal
        open={drilldown.open}
        title={drilldown.title}
        description={drilldown.description}
        entries={drilldown.entries}
        restaurantLookup={restaurantLookup}
        onClose={() => setDrilldown({ ...drilldown, open: false })}
        onRestaurantClick={onRestaurantClick}
      />

      <details className="group rounded-md border border-blue-200/60 bg-white/40 px-3 py-2 text-[11px] leading-relaxed text-blue-800/90">
        <summary className="cursor-pointer select-none font-medium text-blue-900 marker:text-blue-400">
          Methodik &amp; Datenquellen
        </summary>
        <div className="mt-2 space-y-1.5 text-blue-800/85">
          <p>
            <strong>Restaurant-Universe:</strong> 555 Betriebe in Potsdam aus
            OpenStreetMap (Overpass API, ODbL), Stadtteil-Zuordnung via
            Nearest-Neighbor gegen <code className="text-[10px]">place=suburb</code>-Centroide.
          </p>
          <p>
            <strong>Telefon/Website-Anreicherung:</strong> Lokaler
            Google-Maps-Discovery-Scraper (gosom/google-maps-scraper) mit 21
            Stadt+Stadtteil+Cuisine-Queries; Fuzzy-Match auf OSM-Liste
            (Geo-Distanz &lt; 120 m, Name-Token-Set ≥ 70 %).
          </p>
          <p>
            <strong>Speisekarten-Extraktion:</strong> Pro Restaurant Homepage
            + bis zu 12 Sub-Pages (Pizza/Pasta/Burger/Getränke etc.) via
            <code className="text-[10px]"> requests + BeautifulSoup</code>;
            aggregierter Text (max. 45.000 Zeichen) an
            <code className="text-[10px]"> OpenAI GPT-4o-mini</code> mit
            strukturiertem Extraction-Prompt; Output-Schema:
            <code className="text-[10px]"> {`{gericht, preis, kategorie}`}</code>.
          </p>
          <p>
            <strong>Aggregat-Berechnung:</strong> Pro Restaurant wird der
            Median seiner Speisen-Preise (4–60 €, Getränke ausgeschlossen)
            berechnet; daraus wird der Median pro Cuisine bzw. Stadtteil
            ermittelt. Anzeige adaptiv: bei wenig Daten ab 1 Restaurant pro
            Gruppe, bei viel Daten ab 3.
          </p>
          <p>
            <strong>Quelle:</strong> Webseiten der Restaurants selbst
            (öffentlich publiziert). Kein Scraping von Lieferando, Google
            Maps oder Drittanbietern für Speisekarten.
          </p>
        </div>
      </details>
    </section>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-blue-600">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-blue-950">
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-blue-700">{sub}</div>}
    </div>
  );
}

type BarItem = { key: string; label: string; median: number; count: number };

function BarRanking({
  icon,
  title,
  subtitle,
  items,
  onSelect,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  items: BarItem[];
  onSelect?: (item: BarItem) => void;
}) {
  const maxValue = Math.max(...items.map((i) => i.median), 1);

  return (
    <div className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {icon}
          <h4 className="text-sm font-semibold text-blue-950">{title}</h4>
        </div>
        <span className="text-[10px] uppercase tracking-wide text-blue-600">
          {subtitle}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="rounded border border-dashed border-blue-200 bg-blue-50/40 p-4 text-center text-xs text-blue-700">
          Sammelt noch Daten – wird angezeigt sobald genug Restaurants ausgewertet sind.
        </div>
      ) : (
        <ul className="space-y-2.5">
          {items.map((item, idx) => {
            const widthPct = (item.median / maxValue) * 100;
            const isTop = idx === 0;
            return (
              <li
                key={item.key}
                className={`group rounded -mx-1 px-1 py-0.5 transition ${
                  onSelect ? "cursor-pointer hover:bg-blue-50" : ""
                }`}
                onClick={() => onSelect?.(item)}
                title={onSelect ? `${item.label}: Klicken für Detail-Liste` : undefined}
              >
                <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-blue-950">
                    <span
                      className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold tabular-nums ${
                        isTop
                          ? "bg-lieferando text-white"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    {item.label}
                  </span>
                  <span className="flex items-center gap-2 text-blue-900">
                    <span className="tabular-nums font-semibold">
                      {item.median.toFixed(2)} €
                    </span>
                    <span className="rounded bg-blue-100 px-1.5 text-[10px] font-medium tabular-nums text-blue-700">
                      n={item.count}
                    </span>
                  </span>
                </div>
                <div className="relative h-3 w-full overflow-hidden rounded-full bg-blue-50/80 ring-1 ring-inset ring-blue-100">
                  <div
                    className={`relative h-full rounded-full transition-[width,filter] duration-700 ease-out ${
                      isTop
                        ? "bg-gradient-to-r from-lieferando-dark via-lieferando to-lieferando/85 shadow-[0_0_12px_rgba(255,128,0,0.4)]"
                        : "bg-gradient-to-r from-lieferando/85 to-lieferando"
                    } group-hover:brightness-110`}
                    style={{ width: `${widthPct}%` }}
                  >
                    {/* glossy highlight */}
                    <div className="absolute inset-x-0 top-0 h-1/2 rounded-t-full bg-gradient-to-b from-white/35 to-transparent" />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
