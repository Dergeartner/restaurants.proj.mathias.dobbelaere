"use client";

import { useMemo, useState } from "react";
import { Building2, Users, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { ImpressumRestaurant, Restaurant } from "@/app/types";

type Props = {
  restaurants: Restaurant[];
  impressum: ImpressumRestaurant[] | null;
  onRestaurantClick: (r: Restaurant) => void;
};

type Group = {
  key: string;
  identifier: string;          // z.B. "USt DE 166948048" oder "GF René Dost"
  identifier_type: "ust_id" | "geschaeftsfuehrer";
  inhaber_name: string | null; // typischer Inhaber-Name aus den Impressen
  geschaeftsform: string | null;
  member_names: string[];      // Restaurant-Namen
  total: number;
  on_lieferando: number;
  hot_leads: number;
  with_speisekarte: number;
};

// Heuristik: Name "Sonstige" als Geschäftsform ist wertlos
function cleanForm(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim();
  if (!t || t.toLowerCase() === "sonstige") return null;
  return t;
}

export function RestaurantGruppen({
  restaurants,
  impressum,
  onRestaurantClick,
}: Props) {
  const [openGroup, setOpenGroup] = useState<Group | null>(null);

  const restaurantLookup = useMemo(
    () => new Map(restaurants.map((r) => [r.name, r])),
    [restaurants],
  );

  const groups = useMemo<Group[]>(() => {
    if (!impressum) return [];

    const ustGroups = new Map<string, ImpressumRestaurant[]>();
    const gfGroups = new Map<string, ImpressumRestaurant[]>();

    for (const imp of impressum) {
      if (imp.ust_id) {
        const key = imp.ust_id.replace(/\s+/g, "").toLowerCase();
        if (!ustGroups.has(key)) ustGroups.set(key, []);
        ustGroups.get(key)!.push(imp);
      }
      if (imp.geschaeftsfuehrer && !imp.ust_id) {
        // Nur als GF-Gruppe wenn keine USt-ID — sonst doppelte Zuordnung
        const key = imp.geschaeftsfuehrer.trim().toLowerCase();
        if (!gfGroups.has(key)) gfGroups.set(key, []);
        gfGroups.get(key)!.push(imp);
      }
    }

    const result: Group[] = [];

    for (const [ust, members] of ustGroups.entries()) {
      if (members.length < 2) continue;
      const memberNames = Array.from(new Set(members.map((m) => m.name)));
      if (memberNames.length < 2) continue;
      result.push(buildGroup(ust, "ust_id", members, memberNames, restaurantLookup));
    }
    for (const [gf, members] of gfGroups.entries()) {
      if (members.length < 2) continue;
      const memberNames = Array.from(new Set(members.map((m) => m.name)));
      if (memberNames.length < 2) continue;
      result.push(buildGroup(gf, "geschaeftsfuehrer", members, memberNames, restaurantLookup));
    }

    return result.sort((a, b) => b.total - a.total);
  }, [impressum, restaurantLookup]);

  if (groups.length === 0) return null;

  const totalRestaurantsInGroups = groups.reduce((s, g) => s + g.total, 0);

  return (
    <section className="rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 via-white to-purple-50/40 p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-purple-200/60 pb-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-purple-700" />
          <h3 className="text-lg font-semibold text-purple-950">
            Restaurant-Gruppen — Cluster-Akquise-Potenzial
          </h3>
        </div>
        <Badge variant="info" className="bg-purple-100 text-purple-800 ring-purple-200">
          {groups.length} Gruppen · {totalRestaurantsInGroups} Restaurants
        </Badge>
      </div>

      <p className="mb-4 text-sm text-purple-900">
        Identifiziert über identische USt-IdNr oder Geschäftsführer aus dem
        Impressum. Ein Strategic-Account-Call öffnet mehrere Locations
        gleichzeitig — höhere ROI pro Sales-Stunde.
      </p>

      {/* Status-Buckets als KPIs */}
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <StatusKpi
          color="emerald"
          label="Trojaner-Akquise"
          sublabel="Eine Location bereits Partner — Tür ist offen"
          count={groups.filter((g) => g.on_lieferando > 0 && g.on_lieferando < g.total).length}
          locations={groups
            .filter((g) => g.on_lieferando > 0 && g.on_lieferando < g.total)
            .reduce((s, g) => s + (g.total - g.on_lieferando), 0)}
        />
        <StatusKpi
          color="orange"
          label="Greenfield-Cluster"
          sublabel="Keine Location auf Lieferando"
          count={groups.filter((g) => g.on_lieferando === 0).length}
          locations={groups
            .filter((g) => g.on_lieferando === 0)
            .reduce((s, g) => s + g.total, 0)}
        />
        <StatusKpi
          color="blue"
          label="Voll abgedeckt"
          sublabel="Alle Locations bereits Partner"
          count={groups.filter((g) => g.on_lieferando === g.total).length}
          locations={groups
            .filter((g) => g.on_lieferando === g.total)
            .reduce((s, g) => s + g.total, 0)}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => {
          const cleanedForm = cleanForm(g.geschaeftsform);
          const isFullyPartner = g.on_lieferando === g.total;
          const isTrojan = g.on_lieferando > 0 && g.on_lieferando < g.total;
          const cardClasses = isFullyPartner
            ? "border-blue-300 bg-blue-50/50 hover:border-blue-400"
            : isTrojan
              ? "border-emerald-300 bg-emerald-50/40 hover:border-emerald-500"
              : "border-purple-100 bg-white hover:border-purple-300";
          const statusBadge = isFullyPartner ? (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-800 ring-1 ring-inset ring-blue-300">
              ✓ Voll Partner
            </span>
          ) : isTrojan ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800 ring-1 ring-inset ring-emerald-300">
              🎯 Trojaner
            </span>
          ) : (
            <span className="rounded-full bg-lieferando-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-lieferando-dark ring-1 ring-inset ring-lieferando/40">
              🌱 Greenfield
            </span>
          );
          return (
            <button
              key={g.key}
              type="button"
              onClick={() => setOpenGroup(g)}
              className={`group flex flex-col rounded-lg border p-4 text-left shadow-sm transition hover:shadow-md ${cardClasses}`}
            >
              <div className="mb-2">{statusBadge}</div>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-1.5">
                    <Building2 className="h-3.5 w-3.5 shrink-0 text-purple-600" />
                    <span className="truncate font-semibold text-neutral-900 group-hover:text-purple-700">
                      {g.inhaber_name || "(unbekannter Inhaber)"}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-purple-700">
                    {cleanedForm && (
                      <span className="rounded bg-purple-100 px-1.5 py-0.5 font-medium uppercase tracking-wide">
                        {cleanedForm}
                      </span>
                    )}
                    <span className="font-mono">
                      {g.identifier_type === "ust_id" ? "USt: " : "GF: "}
                      {g.identifier}
                    </span>
                  </div>
                </div>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-neutral-300 transition group-hover:text-purple-500" />
              </div>

              <div className="mt-3 flex items-baseline justify-between gap-2 text-xs">
                <span className="text-neutral-700">
                  <span className="text-2xl font-bold text-purple-700">{g.total}</span>{" "}
                  Locations
                </span>
                <div className="flex flex-col items-end gap-0.5 text-[10px]">
                  <span className="text-emerald-700">
                    🔥 {g.hot_leads} Hot · 📋 {g.with_speisekarte} Karten
                  </span>
                  <span className="text-blue-700">
                    {g.on_lieferando}/{g.total} bei Lieferando
                  </span>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1">
                {g.member_names.slice(0, 4).map((name) => (
                  <span
                    key={name}
                    className="truncate rounded bg-purple-50 px-2 py-0.5 text-[10px] text-purple-800"
                    title={name}
                  >
                    {name}
                  </span>
                ))}
                {g.member_names.length > 4 && (
                  <span className="rounded bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-900">
                    +{g.member_names.length - 4}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <details className="mt-3 group rounded-md border border-purple-200/60 bg-white/40 px-3 py-2 text-[11px] text-purple-800/90">
        <summary className="cursor-pointer select-none font-medium text-purple-900 marker:text-purple-400">
          Methodik &amp; Tech-Stack
        </summary>
        <div className="mt-2 space-y-1.5 text-purple-800/85">
          <p>
            <strong>Pipeline:</strong> Pro Restaurant mit Website wird die
            Impressum-Sub-Page automatisch identifiziert
            (Keyword-Heuristik + Pfad-Pattern), HTML via{" "}
            <code className="text-[10px]">requests + BeautifulSoup</code>{" "}
            geparst, dann an{" "}
            <code className="text-[10px]">OpenAI GPT-4o-mini</code> mit
            strukturiertem JSON-Schema-Prompt geschickt
            (<code className="text-[10px]">response_format: json_object</code>,{" "}
            temperature 0.0 für Determinismus).
          </p>
          <p>
            <strong>Extraktion:</strong> Inhaber, Geschäftsform, Geschäftsführer,
            Adresse, Telefon, E-Mail, Handelsregister-Nummer, USt-IdNr.,
            inhaltlich Verantwortlicher (§55 RStV/MStV).
            Anti-Halluzinations-Strategie: explizite{" "}
            <code className="text-[10px]">null</code>-Anweisung im Prompt für
            fehlende Felder, plus Format-Validation (E-Mail-Pattern, Telefon-Whitelist).
          </p>
          <p>
            <strong>Cluster-Detection:</strong> Aggregation der Impressum-Daten
            über USt-IdNr (primärer Schlüssel) und Geschäftsführer-Name
            (Fallback). Min. 2 Restaurants pro Gruppe. Identifiziert{" "}
            Multi-Location-Eigentümer für Cluster-Akquise — Sales-relevante
            Hochwertinformation, die manuell tagelang Recherche bräuchte.
          </p>
          <p>
            <strong>Coverage:</strong> 70 % der Restaurant-Webseiten liefern
            verwertbare Impressum-Daten (276 / 392). Restliche 30 %: keine
            Webseite, JS-rendered Pages, oder Impressum-Plattform-Embeds —
            lösbar mit Browser-Rendering (Pydoll/Playwright) als nächste Stufe.
          </p>
          <p>
            <strong>Quelle:</strong> Impressum-Pflicht-Veröffentlichungen
            nach §5 TMG — öffentliche, rechtssicher publizierte Daten.
          </p>
        </div>
      </details>

      {/* Detail-Modal pro Gruppe */}
      <Dialog open={openGroup !== null} onOpenChange={(o) => !o && setOpenGroup(null)}>
        <DialogContent className="p-0">
          {openGroup && (
            <>
              <div className="shrink-0 bg-gradient-to-br from-purple-50 via-white to-white px-6 pb-4 pt-6">
                <DialogHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <Building2 className="h-5 w-5 text-purple-700" />
                    <DialogTitle>
                      {openGroup.inhaber_name || "Unbekannte Gruppe"}
                    </DialogTitle>
                    {cleanForm(openGroup.geschaeftsform) && (
                      <Badge
                        variant="info"
                        className="bg-purple-100 text-purple-800 ring-purple-200"
                      >
                        {cleanForm(openGroup.geschaeftsform)}
                      </Badge>
                    )}
                  </div>
                  <DialogDescription>
                    {openGroup.total} Restaurants · {openGroup.on_lieferando} bei Lieferando ·{" "}
                    {openGroup.hot_leads} Hot Leads · Identifier: {openGroup.identifier}
                  </DialogDescription>
                </DialogHeader>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <div className="space-y-2">
                  {openGroup.member_names.map((name) => {
                    const r = restaurantLookup.get(name);
                    if (!r) return null;
                    const scoreVariant =
                      r.lead_score === 3
                        ? "success"
                        : r.lead_score === 2
                          ? "warning"
                          : "danger";
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => {
                          setOpenGroup(null);
                          setTimeout(() => onRestaurantClick(r), 100);
                        }}
                        className="flex w-full items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3 text-left transition hover:border-purple-300 hover:bg-purple-50/30"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-neutral-900">{name}</div>
                          {r.adresse && (
                            <div className="mt-0.5 text-xs text-neutral-500">
                              {r.adresse}
                            </div>
                          )}
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                            {r.cuisine && (
                              <span className="text-neutral-500">{r.cuisine}</span>
                            )}
                            {r.telefon && (
                              <span className="font-mono text-neutral-700">
                                📞 {r.telefon}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <Badge variant={scoreVariant}>
                            <span className="tabular-nums">{r.lead_score}</span>
                          </Badge>
                          {r.auf_lieferando && <Badge variant="info">Partner</Badge>}
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-neutral-300" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function StatusKpi({
  color,
  label,
  sublabel,
  count,
  locations,
}: {
  color: "emerald" | "orange" | "blue";
  label: string;
  sublabel: string;
  count: number;
  locations: number;
}) {
  const styles = {
    emerald: "border-emerald-300 bg-emerald-50/60 text-emerald-900",
    orange: "border-lieferando/40 bg-lieferando-50 text-lieferando-dark",
    blue: "border-blue-300 bg-blue-50/60 text-blue-900",
  }[color];
  const valueColor = {
    emerald: "text-emerald-700",
    orange: "text-lieferando-dark",
    blue: "text-blue-700",
  }[color];
  return (
    <div className={`rounded-lg border p-3 ${styles}`}>
      <div className="text-[11px] font-bold uppercase tracking-wide">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className={`text-2xl font-bold tabular-nums ${valueColor}`}>{count}</span>
        <span className="text-xs">Gruppen · {locations} Locations</span>
      </div>
      <div className="mt-0.5 text-[10px] opacity-80">{sublabel}</div>
    </div>
  );
}

function buildGroup(
  identifier: string,
  type: "ust_id" | "geschaeftsfuehrer",
  members: ImpressumRestaurant[],
  memberNames: string[],
  restaurantLookup: Map<string, Restaurant>,
): Group {
  // Häufigster Inhaber-Name + Geschäftsform aus den Members
  const inhaberCounts = new Map<string, number>();
  const formCounts = new Map<string, number>();
  for (const m of members) {
    if (m.inhaber_name) {
      inhaberCounts.set(m.inhaber_name, (inhaberCounts.get(m.inhaber_name) || 0) + 1);
    }
    if (m.geschaeftsform) {
      formCounts.set(m.geschaeftsform, (formCounts.get(m.geschaeftsform) || 0) + 1);
    }
  }
  const topInhaber = [...inhaberCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const topForm = [...formCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  let onLieferando = 0;
  let hot = 0;
  for (const name of memberNames) {
    const r = restaurantLookup.get(name);
    if (!r) continue;
    if (r.auf_lieferando) onLieferando++;
    if (r.lead_score === 3) hot++;
  }

  return {
    key: `${type}:${identifier}`,
    identifier,
    identifier_type: type,
    inhaber_name: topInhaber,
    geschaeftsform: topForm,
    member_names: memberNames,
    total: memberNames.length,
    on_lieferando: onLieferando,
    hot_leads: hot,
    with_speisekarte: 0,
  };
}
