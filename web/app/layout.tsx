import type { Metadata } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";

export const metadata: Metadata = {
  title: "Lieferando Partner Discovery – Potsdam",
  description:
    "Automatisiert erstellte Marktübersicht aller gastronomischen Betriebe in Potsdam aus OpenStreetMap-Daten – inkl. Akquise-Pipeline für Lieferando-Sales.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
