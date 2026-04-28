"use client";

import { useMemo } from "react";
import {
  Building2,
  ExternalLink,
  FileText,
  Globe,
  Mail,
  MapPin,
  Phone,
  User,
  UtensilsCrossed,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import type {
  Gericht,
  ImpressumRestaurant,
  Restaurant,
  SpeisekartenRestaurant,
} from "@/app/types";

type Props = {
  restaurant: Restaurant | null;
  speisekarte: SpeisekartenRestaurant | null;
  impressum?: ImpressumRestaurant | null;
  onClose: () => void;
};

const KATEGORIE_REIHENFOLGE = [
  "Vorspeise",
  "Suppe",
  "Salat",
  "Pizza",
  "Pasta",
  "Burger",
  "Hauptgericht",
  "Spezialität",
  "Beilage",
  "Snack",
  "Frühstück",
  "Kindergericht",
  "Dessert",
  "Heißgetränk",
  "Kaltgetränk",
  "Bier",
  "Wein",
  "Spirituose",
  "Cocktail",
  "Sonstiges",
];

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

const KATEGORIE_LABEL: Record<string, string> = {
  restaurant: "Restaurant",
  cafe: "Café",
  bar: "Bar",
  fast_food: "Fast Food",
  pub: "Pub",
  biergarten: "Biergarten",
};

export function RestaurantModal({ restaurant, speisekarte, impressum, onClose }: Props) {
  const grouped = useMemo(() => {
    if (!speisekarte || speisekarte.gerichte.length === 0) return [];
    const map = new Map<string, Gericht[]>();
    for (const g of speisekarte.gerichte) {
      const k = g.kategorie || "Sonstiges";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(g);
    }
    const orderIdx = (name: string) => {
      const i = KATEGORIE_REIHENFOLGE.indexOf(name);
      return i === -1 ? 999 : i;
    };
    return Array.from(map.entries())
      .map(([kat, items]) => ({
        kategorie: kat,
        items: [...items].sort((a, b) => a.preis - b.preis),
      }))
      .sort((a, b) => orderIdx(a.kategorie) - orderIdx(b.kategorie));
  }, [speisekarte]);

  const priceStats = useMemo(() => {
    if (!speisekarte || speisekarte.gerichte.length === 0) return null;
    const prices = speisekarte.gerichte.map((g) => g.preis);
    const sorted = [...prices].sort((a, b) => a - b);
    const median =
      sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)];
    return {
      count: prices.length,
      min: Math.min(...prices),
      max: Math.max(...prices),
      avg: prices.reduce((a, b) => a + b, 0) / prices.length,
      median,
    };
  }, [speisekarte]);

  if (!restaurant) return null;

  const isLieferandoOnly =
    restaurant.kategorie === "lieferando_only" ||
    restaurant.kategorie === "lieferando_non_gastro";

  const cuisineLabel = restaurant.cuisine
    ? CUISINE_LABEL[restaurant.cuisine.toLowerCase()] ?? restaurant.cuisine
    : null;
  const kategorieLabel = isLieferandoOnly
    ? restaurant.kategorie === "lieferando_non_gastro"
      ? "Convenience-Partner (kein klassisches Restaurant)"
      : "Nur über Lieferando bekannt"
    : KATEGORIE_LABEL[restaurant.kategorie] ?? restaurant.kategorie;
  const scoreVariant = (
    { 3: "success", 2: "warning", 1: "danger" } as const
  )[restaurant.lead_score];
  const scoreText = (
    { 3: "Hot Lead", 2: "Warm Lead", 1: "Cold Lead" } as const
  )[restaurant.lead_score];

  return (
    <Dialog open={restaurant !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="p-0">
        {/* Header mit Lieferando-Akzent */}
        <div className="relative shrink-0 bg-gradient-to-br from-lieferando-50 via-white to-white px-6 pb-4 pt-6">
          <DialogHeader>
            <div className="flex flex-wrap items-center gap-2">
              <DialogTitle>{restaurant.name}</DialogTitle>
              <Badge variant={scoreVariant}>
                <span className="tabular-nums">{restaurant.lead_score}</span>{" "}
                {scoreText}
              </Badge>
              {restaurant.auf_lieferando && (
                <Badge variant="info">Lieferando-Partner</Badge>
              )}
              {!restaurant.auf_lieferando && restaurant.lead_score >= 2 && (
                <Badge variant="lieferando">Akquise-Kandidat</Badge>
              )}
            </div>
            <DialogDescription className="mt-1.5 text-sm text-neutral-600">
              {kategorieLabel}
              {cuisineLabel && <span> · {cuisineLabel}</span>}
              {restaurant.stadtteil && restaurant.stadtteil !== "Unbekannt" && (
                <span> · {restaurant.stadtteil}</span>
              )}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Scrollbarer Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
          {isLieferandoOnly && (
            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="text-sm font-semibold text-blue-950">
                Daten nur aus Lieferando-Marktübersicht
              </div>
              <p className="mt-1 text-xs text-blue-800">
                Dieses Restaurant ist als Lieferando-Partner gelistet, hat aber
                keinen OSM-Eintrag — daher fehlen Stammdaten wie Adresse, Telefon
                und Website. In einer realen Sales-Pipeline würde Lieferando intern
                über die Partner-API alle Felder direkt liefern.
              </p>
            </div>
          )}

          {/* Inhaber & Decision-Maker (aus Impressum) */}
          {impressum && impressum.inhaber_name && (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
              <div className="mb-2 flex items-center gap-2">
                <User className="h-4 w-4 text-emerald-700" />
                <h3 className="text-sm font-semibold text-emerald-950">
                  Inhaber & Decision-Maker
                </h3>
                {impressum.geschaeftsform && (
                  <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                    {impressum.geschaeftsform}
                  </span>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <ImpressumField
                  icon={<Building2 className="h-3.5 w-3.5 text-emerald-700" />}
                  label="Inhaber"
                  value={impressum.inhaber_name}
                />
                {impressum.geschaeftsfuehrer && (
                  <ImpressumField
                    icon={<User className="h-3.5 w-3.5 text-emerald-700" />}
                    label="Geschäftsführer"
                    value={impressum.geschaeftsfuehrer}
                  />
                )}
                {impressum.telefon && (
                  <ImpressumField
                    icon={<Phone className="h-3.5 w-3.5 text-emerald-700" />}
                    label="Telefon (Inhaber)"
                    value={
                      <a
                        href={`tel:${impressum.telefon}`}
                        className="text-blue-600 hover:underline"
                      >
                        {impressum.telefon}
                      </a>
                    }
                  />
                )}
                {impressum.email && (
                  <ImpressumField
                    icon={<Mail className="h-3.5 w-3.5 text-emerald-700" />}
                    label="E-Mail"
                    value={
                      <a
                        href={`mailto:${impressum.email}`}
                        className="text-blue-600 hover:underline"
                      >
                        {impressum.email}
                      </a>
                    }
                  />
                )}
                {impressum.handelsregister && (
                  <ImpressumField
                    icon={<FileText className="h-3.5 w-3.5 text-emerald-700" />}
                    label="Handelsregister"
                    value={impressum.handelsregister}
                  />
                )}
                {impressum.ust_id && (
                  <ImpressumField
                    icon={<FileText className="h-3.5 w-3.5 text-emerald-700" />}
                    label="USt-IdNr."
                    value={
                      <span className="font-mono text-xs">{impressum.ust_id}</span>
                    }
                  />
                )}
              </div>
              {impressum.impressum_url && (
                <div className="mt-2 text-[11px] text-emerald-800/80">
                  Quelle:{" "}
                  <a
                    href={impressum.impressum_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-blue-600 hover:underline"
                  >
                    {impressum.impressum_url}
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Stammdaten als kompakte Zeilen */}
          <div className="space-y-2.5 rounded-lg border border-neutral-200 bg-neutral-50/60 p-4">
            <ContactLine
              icon={<MapPin className="h-4 w-4 text-neutral-500" />}
              label="Adresse"
              value={restaurant.adresse || "—"}
              action={
                <a
                  href={`https://www.openstreetmap.org/?mlat=${restaurant.lat}&mlon=${restaurant.lon}&zoom=18`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-xs text-lieferando hover:underline"
                >
                  Karte
                </a>
              }
            />
            <ContactLine
              icon={<Phone className="h-4 w-4 text-neutral-500" />}
              label="Telefon"
              value={
                restaurant.telefon ? (
                  <a
                    href={`tel:${restaurant.telefon}`}
                    className="text-blue-600 hover:underline"
                  >
                    {restaurant.telefon}
                  </a>
                ) : (
                  <span className="text-neutral-400">—</span>
                )
              }
            />
            <ContactLine
              icon={<Globe className="h-4 w-4 text-neutral-500" />}
              label="Website"
              value={
                restaurant.website ? (
                  <a
                    href={restaurant.website}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                  >
                    {shortUrl(restaurant.website)}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="text-neutral-400">—</span>
                )
              }
            />
          </div>

          {/* Speisekarten-Section */}
          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <UtensilsCrossed className="h-4 w-4 text-lieferando" />
                <h3 className="text-base font-semibold text-neutral-900">
                  Speisekarte
                </h3>
                {priceStats && (
                  <Badge variant="secondary" className="font-mono">
                    {priceStats.count}
                  </Badge>
                )}
              </div>
              {priceStats && (
                <span className="text-xs text-neutral-500">
                  Ø {priceStats.avg.toFixed(2)} € · Median{" "}
                  {priceStats.median.toFixed(2)} € · {priceStats.min.toFixed(2)}–
                  {priceStats.max.toFixed(2)} €
                </span>
              )}
            </div>

            {!speisekarte || speisekarte.gerichte.length === 0 ? (
              <SpeisekartenLeer state={speisekarte} />
            ) : (
              <div className="space-y-5">
                {grouped.map((group) => (
                  <div key={group.kategorie}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-2">
                      <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-lieferando-dark">
                        {group.kategorie}
                      </h4>
                      <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">
                        {group.items.length}{" "}
                        {group.items.length === 1 ? "Eintrag" : "Einträge"}
                      </span>
                    </div>
                    <Separator className="bg-lieferando/20" />
                    <ul className="divide-y divide-neutral-100">
                      {group.items.map((g, i) => (
                        <li
                          key={`${g.gericht}-${i}`}
                          className="flex items-baseline justify-between gap-3 py-2 text-sm"
                        >
                          <span className="flex-1 text-neutral-800">{g.gericht}</span>
                          <span className="shrink-0 tabular-nums font-medium text-neutral-900">
                            {g.preis.toFixed(2)} €
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}

                {speisekarte.quellen_urls && speisekarte.quellen_urls.length > 0 && (
                  <div className="mt-2 rounded-md border border-neutral-200 bg-neutral-50/80 px-3 py-2 text-xs text-neutral-500">
                    <span className="font-medium text-neutral-700">
                      {speisekarte.quellen_urls.length} Sub-Page
                      {speisekarte.quellen_urls.length > 1 ? "s" : ""} extrahiert
                    </span>{" "}
                    via GPT-4o-mini.{" "}
                    <Quellen urls={speisekarte.quellen_urls} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ImpressumField({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-medium uppercase tracking-wider text-emerald-700/80">
          {label}
        </div>
        <div className="mt-0.5 break-words text-xs text-neutral-900">{value}</div>
      </div>
    </div>
  );
}

function ContactLine({
  icon,
  label,
  value,
  action,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">
          {label}
        </div>
        <div className="mt-0.5 break-words text-sm text-neutral-900">{value}</div>
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}

function SpeisekartenLeer({ state }: { state: SpeisekartenRestaurant | null }) {
  if (!state) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/60 p-6 text-center">
        <UtensilsCrossed className="mx-auto h-6 w-6 text-neutral-300" />
        <p className="mt-2 text-sm text-neutral-600">
          Kein Speisekarten-Datensatz für dieses Restaurant.
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          Pipeline läuft noch oder Webseite ohne Online-Speisekarte.
        </p>
      </div>
    );
  }
  const fehlerLabels: Record<string, string> = {
    homepage_nicht_erreichbar: "Webseite war nicht erreichbar",
    kein_text_extrahierbar: "Kein lesbarer Text auf der Webseite",
    keine_gerichte_gefunden: "Keine Speisekarte mit Preisen erkennbar",
    llm_fehler: "Extraktion fehlgeschlagen",
  };
  return (
    <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/60 p-6 text-center">
      <UtensilsCrossed className="mx-auto h-6 w-6 text-neutral-300" />
      <p className="mt-2 text-sm text-neutral-700">Keine Speisekarte verfügbar</p>
      {state.fehler && (
        <p className="mt-1 text-xs text-neutral-500">
          Grund: {fehlerLabels[state.fehler] ?? state.fehler}
        </p>
      )}
    </div>
  );
}

function Quellen({ urls }: { urls: string[] }) {
  return (
    <details className="mt-1 inline-block">
      <summary className="cursor-pointer text-blue-600 hover:underline">
        Quellen
      </summary>
      <ul className="mt-1 space-y-0.5">
        {urls.map((u) => (
          <li key={u}>
            <a
              href={u}
              target="_blank"
              rel="noreferrer noopener"
              className="text-blue-600 hover:underline"
            >
              {u}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "") + (u.pathname !== "/" ? u.pathname : "");
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/^www\./, "");
  }
}
