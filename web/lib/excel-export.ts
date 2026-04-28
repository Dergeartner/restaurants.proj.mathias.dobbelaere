"use client";

import type { ImpressumRestaurant, Restaurant } from "@/app/types";

// Lazy-Import von xlsx, damit es nicht im Initial-Bundle landet
async function getXLSX() {
  const mod = await import("xlsx");
  return mod;
}

const KATEGORIE_LABEL: Record<string, string> = {
  restaurant: "Restaurant",
  cafe: "Café",
  bar: "Bar",
  fast_food: "Fast Food",
  pub: "Pub",
  biergarten: "Biergarten",
  lieferando_only: "Lieferando-only",
  lieferando_non_gastro: "Lieferando-Convenience",
};

const SCORE_LABEL = { 3: "Hot", 2: "Warm", 1: "Cold" } as const;

function rowFor(
  r: Restaurant,
  imp?: ImpressumRestaurant | null,
) {
  return {
    Name: r.name,
    Kategorie: KATEGORIE_LABEL[r.kategorie] ?? r.kategorie,
    Adresse: r.adresse,
    Stadtteil: r.stadtteil,
    Cuisine: r.cuisine,
    Website: r.website,
    Telefon: r.telefon,
    Hat_Website: r.hat_website ? "Ja" : "Nein",
    Lead_Score: r.lead_score,
    Lead_Label: SCORE_LABEL[r.lead_score],
    Auf_Lieferando: r.auf_lieferando ? "Ja" : "Nein",
    // Decision-Maker-Spalten aus Impressum
    Inhaber: imp?.inhaber_name ?? "",
    Geschaeftsform: imp?.geschaeftsform ?? "",
    Geschaeftsfuehrer: imp?.geschaeftsfuehrer ?? "",
    Inhaber_Telefon: imp?.telefon ?? "",
    Inhaber_Email: imp?.email ?? "",
    Handelsregister: imp?.handelsregister ?? "",
    USt_IdNr: imp?.ust_id ?? "",
    Latitude: r.lat,
    Longitude: r.lon,
    Notizen: "",
  };
}

const HEADERS = [
  "Name", "Kategorie", "Adresse", "Stadtteil", "Cuisine",
  "Website", "Telefon", "Hat_Website", "Lead_Score", "Lead_Label",
  "Auf_Lieferando",
  "Inhaber", "Geschaeftsform", "Geschaeftsfuehrer", "Inhaber_Telefon",
  "Inhaber_Email", "Handelsregister", "USt_IdNr",
  "Latitude", "Longitude", "Notizen",
];

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function timestamp() {
  const d = new Date();
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}_${pad2(d.getHours())}${pad2(d.getMinutes())}`;
}

export async function exportToExcel(
  restaurants: Restaurant[],
  filename: string,
  filterDescription?: string,
  impressumLookup?: Map<string, ImpressumRestaurant>,
) {
  if (restaurants.length === 0) {
    alert("Keine Daten zum Exportieren — bitte Filter anpassen.");
    return;
  }

  const XLSX = await getXLSX();
  const rows = restaurants.map((r) =>
    rowFor(r, impressumLookup?.get(r.name) ?? null),
  );
  const wb = XLSX.utils.book_new();

  // Sheet 1: Liste
  const ws = XLSX.utils.json_to_sheet(rows, { header: HEADERS });
  ws["!cols"] = [
    { wch: 30 }, { wch: 14 }, { wch: 36 }, { wch: 22 }, { wch: 18 },
    { wch: 30 }, { wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 8 },
    { wch: 14 },
    { wch: 32 }, { wch: 14 }, { wch: 24 }, { wch: 18 },
    { wch: 28 }, { wch: 28 }, { wch: 16 },
    { wch: 10 }, { wch: 10 }, { wch: 30 },
  ];
  ws["!autofilter"] = { ref: ws["!ref"]! };
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };
  XLSX.utils.book_append_sheet(wb, ws, "Liste");

  // Sheet 2: Zusammenfassung
  const total = restaurants.length;
  const withWeb = restaurants.filter((r) => r.hat_website).length;
  const hot = restaurants.filter((r) => r.lead_score === 3).length;
  const onLieferando = restaurants.filter((r) => r.auf_lieferando).length;
  const akquise = restaurants.filter(
    (r) => !r.auf_lieferando && r.lead_score >= 2,
  ).length;

  const summary: (string | number)[][] = [
    ["Restaurant Market Discovery — Potsdam"],
    [""],
    ["Export erstellt am", new Date().toLocaleString("de-DE")],
  ];
  if (filterDescription) summary.push(["Filter", filterDescription]);
  summary.push(
    [""],
    ["Gesamtanzahl Restaurants", total],
    ["Mit Website", withWeb],
    ["Hot Leads (Score 3)", hot],
    ["Auf Lieferando", onLieferando],
    ["Akquise-Kandidaten (Score >= 2, nicht auf Lieferando)", akquise],
  );

  const wsSum = XLSX.utils.aoa_to_sheet(summary);
  wsSum["!cols"] = [{ wch: 50 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, wsSum, "Zusammenfassung");

  XLSX.writeFile(wb, filename);
}

export async function exportFiltered(
  restaurants: Restaurant[],
  filterDescription: string,
  impressumLookup?: Map<string, ImpressumRestaurant>,
) {
  await exportToExcel(
    restaurants,
    `partnerliste_potsdam_filtered_${timestamp()}.xlsx`,
    filterDescription,
    impressumLookup,
  );
}

export async function exportAll(
  restaurants: Restaurant[],
  impressumLookup?: Map<string, ImpressumRestaurant>,
) {
  await exportToExcel(
    restaurants,
    `partnerliste_potsdam_komplett_${timestamp()}.xlsx`,
    "Alle Restaurants (kein Filter)",
    impressumLookup,
  );
}
