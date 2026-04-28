import type { Metadata } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";

export const metadata: Metadata = {
  title: "Restaurant Market Discovery — Potsdam",
  description:
    "Sales-Discovery-Tool für den Gastromarkt Potsdam: priorisierte Akquise-Targets, Decision-Maker-Daten und Cluster-Analyse aus öffentlichen Datenquellen.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
