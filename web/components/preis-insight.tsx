"use client";

import { useState } from "react";
import type { PreisVergleichPayload } from "@/app/types";

type Props = {
  data: PreisVergleichPayload | null;
};

export function PreisInsight({ data }: Props) {
  const [open, setOpen] = useState(false);

  if (!data || data.vergleiche.length === 0) return null;

  const diffs = data.vergleiche.map(
    (v) => ((v.preis_lieferando - v.preis_eigenseite) / v.preis_eigenseite) * 100,
  );
  const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const max = Math.max(...diffs);
  const above10 = diffs.filter((d) => d >= 10).length;
  const restaurantCount = new Set(data.vergleiche.map((v) => v.restaurant)).size;

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-5 shadow-sm">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded bg-amber-200 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-900">
              Markt-Insight
            </span>
            <span className="text-xs text-amber-800">
              Stichprobe {restaurantCount} Restaurants · {data.vergleiche.length} Gerichte · {data.stichtag}
            </span>
          </div>
          <h3 className="mt-2 text-lg font-semibold text-amber-950">
            Preis-Premium Lieferando vs. Restaurant-Eigenseite
          </h3>
          <p className="mt-1 text-sm text-amber-900">
            Bei der untersuchten Stichprobe sind identische Gerichte auf Lieferando im
            Schnitt <strong className="tabular-nums">+{avg.toFixed(1)} %</strong> teurer
            als auf der Restaurant-eigenen Bestellseite (max. +{max.toFixed(0)} %).
            {" "}
            <strong className="tabular-nums">{above10}</strong> der untersuchten
            Restaurants liegen über +10 % – Channel-Conflict-Risiko.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="rounded border border-amber-700 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
        >
          {open ? "Details ausblenden" : "Stichprobe anzeigen"}
        </button>
      </div>

      {open && (
        <div className="mt-4 overflow-x-auto rounded border border-amber-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-amber-100 text-left text-xs uppercase tracking-wide text-amber-900">
              <tr>
                <th className="px-3 py-2">Restaurant</th>
                <th className="px-3 py-2">Gericht</th>
                <th className="px-3 py-2 text-right">Eigenseite</th>
                <th className="px-3 py-2 text-right">Lieferando</th>
                <th className="px-3 py-2 text-right">Differenz</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-100">
              {data.vergleiche.map((v, i) => {
                const diff = v.preis_lieferando - v.preis_eigenseite;
                const diffPct = (diff / v.preis_eigenseite) * 100;
                return (
                  <tr key={i}>
                    <td className="px-3 py-2 font-medium text-neutral-900">
                      {v.restaurant}
                    </td>
                    <td className="px-3 py-2 text-neutral-700">{v.gericht}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-neutral-700">
                      {v.preis_eigenseite.toFixed(2)} €
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-neutral-700">
                      {v.preis_lieferando.toFixed(2)} €
                    </td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums font-medium ${
                        diffPct >= 10
                          ? "text-red-700"
                          : diffPct >= 5
                            ? "text-amber-700"
                            : "text-neutral-600"
                      }`}
                    >
                      +{diff.toFixed(2)} € ({diffPct >= 0 ? "+" : ""}
                      {diffPct.toFixed(1)} %)
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="border-t border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Methodik: Manuelle Stichprobe – identische Gerichte (Name, Größe, Beilagen)
            wurden zeitgleich am angegebenen Stichtag auf der Restaurant-Eigenseite und
            auf lieferando.de erfasst. Ergebnisse repräsentieren keine vollständige
            Marktbefragung. Quellen: öffentlich zugängliche Speisekarten der jeweiligen
            Restaurants.
          </p>
        </div>
      )}
    </div>
  );
}
