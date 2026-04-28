"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import type { Restaurant } from "@/app/types";

const POTSDAM_CENTER: [number, number] = [52.4009, 13.0591];

const SCORE_COLORS = {
  3: "#10b981", // emerald
  2: "#f59e0b", // amber
  1: "#ef4444", // red
} as const;

type Props = {
  restaurants: Restaurant[];
};

export default function RestaurantMap({ restaurants }: Props) {
  const counts = {
    hot: restaurants.filter((r) => r.lead_score === 3).length,
    warm: restaurants.filter((r) => r.lead_score === 2).length,
    cold: restaurants.filter((r) => r.lead_score === 1).length,
    partner: restaurants.filter((r) => r.auf_lieferando).length,
  };
  return (
    <div className="space-y-2">
      <MapLegend counts={counts} />
      <div className="h-[480px] overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
      <MapContainer center={POTSDAM_CENTER} zoom={12} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitToData restaurants={restaurants} />
        {restaurants.map((r, i) => (
          <CircleMarker
            key={`${r.name}-${i}`}
            center={[r.lat, r.lon]}
            radius={r.lead_score === 3 ? 7 : r.lead_score === 2 ? 5 : 4}
            pathOptions={{
              color: r.auf_lieferando ? "#1e40af" : SCORE_COLORS[r.lead_score],
              weight: r.auf_lieferando ? 2 : 1,
              fillColor: SCORE_COLORS[r.lead_score],
              fillOpacity: 0.75,
            }}
          >
            <Popup>
              <div className="space-y-1 text-sm">
                <div className="font-semibold text-neutral-900">{r.name}</div>
                <div className="text-xs text-neutral-600">
                  {labelKategorie(r.kategorie)}
                  {r.cuisine && ` · ${r.cuisine}`}
                </div>
                {r.adresse && <div className="text-xs">{r.adresse}</div>}
                {r.telefon && (
                  <div className="text-xs">
                    📞{" "}
                    <a
                      href={`tel:${r.telefon}`}
                      className="text-blue-600 hover:underline"
                    >
                      {r.telefon}
                    </a>
                  </div>
                )}
                {r.website && (
                  <div className="text-xs">
                    🌐{" "}
                    <a
                      href={r.website}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-blue-600 hover:underline"
                    >
                      Website
                    </a>
                  </div>
                )}
                <div className="mt-2 flex items-center gap-2 border-t border-neutral-200 pt-2 text-xs">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: SCORE_COLORS[r.lead_score] }}
                  />
                  Lead-Score: <strong>{r.lead_score}</strong>
                  {r.auf_lieferando && (
                    <span className="ml-auto rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-700">
                      Lieferando-Partner
                    </span>
                  )}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      </div>
    </div>
  );
}

function MapLegend({
  counts,
}: {
  counts: { hot: number; warm: number; cold: number; partner: number };
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          Legende
        </span>

        {/* Lead-Score */}
        <LegendItem
          color={SCORE_COLORS[3]}
          size={7}
          label="Hot Lead"
          sub={`Score 3 · ${counts.hot}`}
        />
        <LegendItem
          color={SCORE_COLORS[2]}
          size={5}
          label="Warm"
          sub={`Score 2 · ${counts.warm}`}
        />
        <LegendItem
          color={SCORE_COLORS[1]}
          size={4}
          label="Cold"
          sub={`Score 1 · ${counts.cold}`}
        />

        {/* Trenner */}
        <div className="hidden h-6 w-px bg-neutral-200 sm:block" />

        {/* Lieferando-Partner */}
        <div className="flex items-center gap-2">
          <span className="relative flex h-4 w-4 items-center justify-center">
            <span
              className="absolute h-3 w-3 rounded-full"
              style={{ backgroundColor: SCORE_COLORS[3] }}
            />
            <span
              className="absolute h-3 w-3 rounded-full ring-2"
              style={{ borderColor: "#1e40af", boxShadow: "0 0 0 1.5px #1e40af" }}
            />
          </span>
          <div>
            <div className="font-medium text-neutral-800">
              Lieferando-Partner
            </div>
            <div className="text-[10px] text-neutral-500">
              blauer Rand · {counts.partner}
            </div>
          </div>
        </div>

        <span className="ml-auto text-[10px] text-neutral-400">
          Pin-Größe steigt mit Lead-Score
        </span>
      </div>
    </div>
  );
}

function LegendItem({
  color,
  size,
  label,
  sub,
}: {
  color: string;
  size: number;
  label: string;
  sub: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-4 w-4 items-center justify-center">
        <span
          className="rounded-full"
          style={{
            backgroundColor: color,
            width: `${size * 1.6}px`,
            height: `${size * 1.6}px`,
          }}
        />
      </span>
      <div>
        <div className="font-medium text-neutral-800">{label}</div>
        <div className="text-[10px] text-neutral-500">{sub}</div>
      </div>
    </div>
  );
}

function FitToData({ restaurants }: { restaurants: Restaurant[] }) {
  const map = useMap();
  useEffect(() => {
    if (restaurants.length === 0) return;
    const lats = restaurants.map((r) => r.lat);
    const lons = restaurants.map((r) => r.lon);
    const south = Math.min(...lats);
    const north = Math.max(...lats);
    const west = Math.min(...lons);
    const east = Math.max(...lons);
    map.fitBounds(
      [
        [south, west],
        [north, east],
      ],
      { padding: [40, 40] },
    );
  }, [restaurants, map]);
  return null;
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
