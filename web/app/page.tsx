"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type {
  DataPayload,
  PreisVergleichPayload,
  Restaurant,
  SpeisekartenPayload,
  SpeisekartenRestaurant,
} from "./types";
import { StatsBar } from "@/components/stats-bar";
import { FilterBar, type Filters } from "@/components/filter-bar";
import { RestaurantTable } from "@/components/restaurant-table";
import { PreisInsight } from "@/components/preis-insight";
import { MarktInsights } from "@/components/markt-insights";
import { RestaurantModal } from "@/components/restaurant-modal";

const RestaurantMap = dynamic(() => import("@/components/restaurant-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[480px] items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-500 shadow-sm">
      Karte wird geladen ...
    </div>
  ),
});

const DEFAULT_FILTERS: Filters = {
  search: "",
  kategorie: "",
  stadtteil: "",
  hotOnly: false,
  akquiseOnly: false,
  lieferandoOnly: false,
};

type View = "table" | "map";

export default function Page() {
  const [data, setData] = useState<DataPayload | null>(null);
  const [preise, setPreise] = useState<PreisVergleichPayload | null>(null);
  const [speisekarten, setSpeisekarten] = useState<SpeisekartenPayload | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [view, setView] = useState<View>("table");
  const [selected, setSelected] = useState<Restaurant | null>(null);

  const speisekartenLookup = useMemo(() => {
    const map = new Map<string, SpeisekartenRestaurant>();
    if (speisekarten) {
      for (const r of speisekarten.restaurants) map.set(r.name, r);
    }
    return map;
  }, [speisekarten]);

  useEffect(() => {
    fetch("/restaurants.json")
      .then((r) => r.json())
      .then((d: DataPayload) => setData(d))
      .catch((e) => console.error("Failed to load data", e));
    fetch("/preisvergleich.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: PreisVergleichPayload | null) => setPreise(d))
      .catch(() => setPreise(null));
    fetch("/speisekarten.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: SpeisekartenPayload | null) => setSpeisekarten(d))
      .catch(() => setSpeisekarten(null));
  }, []);

  const filtered = useMemo<Restaurant[]>(() => {
    if (!data) return [];
    const search = filters.search.trim().toLowerCase();
    return data.restaurants.filter((r) => {
      if (filters.kategorie && r.kategorie !== filters.kategorie) return false;
      if (filters.stadtteil && r.stadtteil !== filters.stadtteil) return false;
      if (filters.hotOnly && r.lead_score !== 3) return false;
      if (filters.akquiseOnly && (r.auf_lieferando || r.lead_score < 2)) return false;
      if (filters.lieferandoOnly && !r.auf_lieferando) return false;
      if (search) {
        const haystack = `${r.name} ${r.cuisine} ${r.adresse}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }, [data, filters]);

  if (!data) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-12">
        <div className="text-neutral-500">Lade Marktdaten ...</div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 lg:py-10">
      <Header
        generatedAt={data.generated_at}
        snapshotDate={data.lieferando_snapshot_date}
      />

      <StatsBar
        restaurants={data.restaurants}
        lieferandoPartners={data.lieferando_partners_total}
      />

      <MarktInsights
        speisekarten={speisekarten}
        restaurants={data.restaurants}
        onRestaurantClick={setSelected}
      />

      <PreisInsight data={preise} />

      <FilterBar
        restaurants={data.restaurants}
        filteredRestaurants={filtered}
        filters={filters}
        onChange={setFilters}
        totalShown={filtered.length}
      />

      <div className="flex items-center gap-2">
        <div className="inline-flex rounded-lg border border-neutral-300 bg-white p-1 shadow-sm">
          <ViewTab active={view === "table"} onClick={() => setView("table")} icon="table">
            Tabelle
          </ViewTab>
          <ViewTab active={view === "map"} onClick={() => setView("map")} icon="map">
            Karte
          </ViewTab>
        </div>
        <span className="ml-2 text-xs text-neutral-500">
          {view === "table" ? "Sortier-/Klickbare Restaurantliste" : "Geografische Verteilung mit farbigen Pins"}
        </span>
      </div>

      {view === "table" ? (
        <RestaurantTable restaurants={filtered} onSelect={setSelected} />
      ) : (
        <RestaurantMap restaurants={filtered} />
      )}

      <RestaurantModal
        restaurant={selected}
        speisekarte={selected ? speisekartenLookup.get(selected.name) ?? null : null}
        onClose={() => setSelected(null)}
      />

      <Footer />
    </main>
  );
}

function Header({
  generatedAt,
  snapshotDate,
}: {
  generatedAt: string;
  snapshotDate: string;
}) {
  return (
    <header className="border-b border-neutral-200 pb-6">
      <div className="flex items-baseline gap-3">
        <span className="inline-block h-3 w-3 rounded-full bg-lieferando" />
        <h1 className="text-2xl font-semibold text-neutral-900 lg:text-3xl">
          Lieferando Partner Discovery – Potsdam
        </h1>
      </div>
      <p className="mt-2 max-w-3xl text-sm text-neutral-600 lg:text-base">
        Automatisiert erstellte Marktübersicht aller gastronomischen Betriebe in
        Potsdam – aus OpenStreetMap (ODbL). Kombiniert mit der manuell erfassten
        Lieferando-Partneranzahl ({snapshotDate}) wird die offene
        Akquise-Pipeline sichtbar.
      </p>
      <p className="mt-1 text-xs text-neutral-500">
        Datenstand: {new Date(generatedAt).toLocaleString("de-DE")}
      </p>
    </header>
  );
}

function ViewTab({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: "table" | "map";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition ${
        active
          ? "bg-lieferando text-white shadow-md"
          : "bg-transparent text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
      }`}
    >
      <TabIcon name={icon} active={active} />
      {children}
    </button>
  );
}

function TabIcon({ name, active }: { name: "table" | "map"; active: boolean }) {
  const stroke = active ? "currentColor" : "currentColor";
  if (name === "table") {
    return (
      <svg
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 5h18M3 12h18M3 19h18" />
      </svg>
    );
  }
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 4 4 6v14l5-2 6 2 5-2V4l-5 2-6-2z" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  );
}

function Footer() {
  return (
    <footer className="border-t border-neutral-200 pt-6 text-xs text-neutral-500">
      <p>
        Daten: <a href="https://www.openstreetmap.org/copyright" className="underline">OpenStreetMap (ODbL)</a>.
        Lieferando-Marktanzahl manuell aus der öffentlichen Marktübersicht erfasst (kein Scraping).
      </p>
      <p className="mt-1">
        Bewerbungs-Mini-Projekt für die Stelle <em>Werkstudent Strategic Accounts</em> bei Just Eat Takeaway / Lieferando.
        Source:{" "}
        <a
          href="https://github.com/"
          target="_blank"
          rel="noreferrer noopener"
          className="underline"
        >
          GitHub
        </a>
        .
      </p>
    </footer>
  );
}
