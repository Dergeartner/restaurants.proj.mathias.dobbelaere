# Lieferando Partner Discovery – Potsdam

> Mini-Bewerbungsprojekt für die Stelle **Werkstudent Strategic Accounts (m/w/d)**
> bei Just Eat Takeaway / Lieferando, Berlin.

Eine automatisierte Marktübersicht aller gastronomischen Betriebe in Potsdam –
aufgebaut aus offenen OpenStreetMap-Daten, optional angereichert über einen
lokalen Google-Maps-Scraper, und abgeglichen mit der Lieferando-Marktanzahl.
Output: eine sales-taugliche Excel-Liste plus eine kleine Web-Demo, die in
Sekunden refreshbar ist statt in Stunden.

## Live-Demo

→ **https://restaurants-proj-mathias-dobbelaere.vercel.app**

_Klick auf eine Tabellenzeile öffnet das Detail-Modal mit Stammdaten und kompletter Speisekarte._
_Klick auf einen Balken oder das Donut-Diagramm öffnet einen Drilldown mit allen zugehörigen Speisen + Restaurants._

## Worum geht's?

Werkstudent-Aufgaben im Sales-Umfeld bestehen zu großen Teilen aus dem Pflegen
und Aktualisieren von Partnerlisten – manuell, zeitaufwändig, schnell veraltet.
Dieses Projekt bildet exakt diese Aufgabe für **eine Stadt (Potsdam)** ab und
zeigt, wie sie sich automatisieren lässt:

| Aufgabe | Manuell | Mit diesem Projekt |
|---------|---------|--------------------|
| Vollständige Gastro-Liste für Potsdam | ~3 h Recherche + Excel | ~10 s Skript-Run |
| Partner-Status checken | Stadt-für-Stadt durchklicken | 1 Spalte in der Excel |
| Akquise-Kandidaten priorisieren | Subjektiv, Bauchgefühl | Lead-Score nach Daten-Quality |
| Aktualisierung in 6 Monaten | Komplett neu | Skript erneut ausführen |

## Was die Daten hergeben (Stand 2026-04-27)

- **555** gastronomische Betriebe in Potsdam laut OpenStreetMap
- **327** mit Website (~58,9 %)
- **240** Hot Leads (Website **und** Telefonnummer vorhanden)
- **132** Lieferando-Partner laut öffentlicher Marktübersicht (Stichtag 27.04.2026)
- → **Marktdurchdringung Lieferando: ~23,8 %** – über 400 Akquise-Kandidaten in
  einer einzigen Stadt sichtbar gemacht

## Architektur

```
 OSM (Overpass)        GMaps (lokaler           Restaurant-Eigenseiten
 ODbL                  Discovery-Scraper)       (öffentliche URLs aus OSM)
        │                       │                          │
        ▼                       ▼                          ▼
  scrape_potsdam.py        enrich_gmaps.py        enrich_speisekarten.py
  • Overpass-Query         • Multi-Query           • Multi-Subpage Crawl
  • Stadtteil via NN       • Dedup                 • GPT-4o-mini extract
  • Lead-Score             • Telefon/Website-      • Strukturierte JSON
  • Lieferando-Match         Anreicherung            mit Kategorisierung
        │                       │                          │
        └───────────┬───────────┘                          │
                    ▼                                      ▼
        partnerliste_potsdam.xlsx                speisekarten.json
        4 Sheets · Lead-Ampel                    Kategorisiert nach
        Akquise-Pipeline-Sheet                   Pizza · Pasta · Bier · ...
                    │                                      │
                    └──────────────┬───────────────────────┘
                                   ▼
                           Next.js-Frontend
                           Tabelle · Karte · Detail-Modal
                           Markt-Insights (Ø-Preis pro Stadtteil/Cuisine)
```

### Drei orthogonale Pipelines

1. **OSM-Discovery** (`scrape_potsdam.py`) — Overpass API liefert das Universe der gastronomischen Betriebe (555 in Potsdam). Stadtteil-Auffüllung via Nearest-Neighbor gegen `place=suburb`-Centroide.

2. **GMaps-Enrichment** (`enrich_gmaps.py`) — Wrapper um den lokalen `gosom/google-maps-scraper`-Binary. 21 Stadt+Stadtteil+Cuisine-Queries → 470+ unique Treffer → Fuzzy-Match auf OSM-Liste über Geo-Distanz < 120m. Füllt fehlende Telefon/Website-Felder. Erhöht Hot-Lead-Anteil um ~38%.

3. **Speisekarten-Extraktion** (`enrich_speisekarten.py`) — Crawlt pro Restaurant Homepage + bis zu 12 Sub-Pages (Pizza/Pasta/Burger/Getränke), schickt aggregierten Text an GPT-4o-mini, bekommt strukturierte JSON-Speisekarte zurück. ~0,90 € für alle 407 Webseiten (vs. 100€+ mit GPT-4 oder 0€ mit lokalem Llama bei höherer Halluzinations-Rate).

## Tech-Stack

- **Pipeline:** Python 3.13 (`requests`, `beautifulsoup4`, `openpyxl`, `rapidfuzz`)
- **Discovery-Quelle:** OpenStreetMap via Overpass API (kostenlos, ODbL-lizenziert)
- **Telefon/Website-Anreicherung:** lokaler Google-Maps-Scraper (gosom/google-maps-scraper)
- **Speisekarten-LLM:** OpenAI GPT-4o-mini (Fallback: Llama 3.1:8b lokal via Ollama)
- **Frontend:** Next.js 16 (App Router) + TypeScript + Tailwind CSS + shadcn/ui (Radix-Dialog)
- **Karte:** Leaflet mit OSM-Tiles
- **Datenhaltung:** statisches JSON in `web/public/` – keine Datenbank, kein Backend
- **Hosting:** Vercel (statisch)

## Quickstart

### 1. Daten ziehen

```bash
cd data-pipeline
python -m venv .venv && source .venv/bin/activate   # bzw. .venv\Scripts\activate auf Windows
pip install -r requirements.txt
python scrape_potsdam.py
```

Output: `data-pipeline/output/restaurants.json` und
`data-pipeline/output/partnerliste_potsdam.xlsx`.

### 2. (Optional) Telefonnummern via Google Maps anreichern

```bash
# Voraussetzung: kompilierter google-maps-scraper.exe (Pfad in enrich_gmaps.py konfigurierbar)
python enrich_gmaps.py
python scrape_potsdam.py --merge-gmaps   # mergt Telefonnummern in OSM-Liste
```

Hebt die Telefonnummern-Coverage erfahrungsgemäß von ~43 % (OSM only) auf
~85-95 %, dadurch auch deutlich mehr Hot Leads (Score 3).

### 3. (Optional) Speisekarten via GPT-4o-mini extrahieren

```bash
# OpenAI-Key in credentials.json (gitignored):
#   {"openai_key": "sk-..."}
python enrich_speisekarten.py --resume   # ~30-60 Min, ~0,90 € für 407 Restaurants
```

Crawlt für jedes Restaurant mit Website Homepage + bis zu 12 Sub-Pages (Pizza,
Pasta, Burger, Getränke) und extrahiert eine strukturierte Speisekarte als JSON.
Output in `output/speisekarten.json`. Bei Wunsch lokal mit Llama 3.1:8b via
`--force-ollama` (kostenlos, aber ~20-30 % Halluzinationsrate).

### 3. (Optional) Lieferando-Partner einpflegen

`data-pipeline/lieferando_partners_potsdam.txt` mit einem Partnernamen pro
Zeile befüllen (manuell aus der öffentlichen Marktübersicht erfasst), dann:

```bash
python scrape_potsdam.py --merge-gmaps
```

Spalte `Auf_Lieferando` wird per Fuzzy-Match (Schwellwert 88) gegen die
OSM-Liste abgeglichen – Sheet "Akquise-Pipeline" zeigt sofort die
Nicht-Partner mit hoher Daten-Quality.

### 4. Frontend lokal starten

```bash
cp data-pipeline/output/restaurants.json web/public/
cp data-pipeline/output/partnerliste_potsdam.xlsx web/public/
cp data-pipeline/output/speisekarten.json web/public/
cd web
npm install
npm run dev
# → http://localhost:3000
```

Frontend-Features:

- **Stats-Bar** mit Gesamt / Mit-Website / Hot-Leads / Lieferando-Marktdurchdringung
- **Markt-Insights** mit Ø-Preis Hauptgericht in Potsdam, teuerste Cuisines, teuerste Stadtteile
- **Tabelle** mit Live-Filter (Suche, Kategorie, Stadtteil, Hot-Leads, Akquise-Kandidaten), Sortierung pro Spalte
- **Karte** (Leaflet) mit Pins farbig nach Lead-Score
- **Detail-Modal** pro Restaurant mit Stammdaten + vollständig kategorisierter Speisekarte (shadcn/ui Dialog)
- **Excel-Download-Button** liefert die Sales-taugliche `partnerliste_potsdam.xlsx`

## Was die Liste hergibt – konkrete Insights

1. **Hohe Datenqualität in OSM für Potsdam:** Anders als oft befürchtet sind
   ~59 % der Betriebe mit Website hinterlegt – OSM ist als Discovery-Quelle
   für eine deutsche Mittelstadt durchaus tauglich.
2. **Fragmentierte Marktdurchdringung:** Lieferando hat ~24 % der OSM-
   Gesamtgastro als Partner. Das ist gleichzeitig viel Reichweite und viel
   Potenzial.
3. **Lead-Score-Verteilung:** ca. 43 % der Betriebe sind Hot Leads (Score 3) –
   d. h. mit Website **und** Telefonnummer aus OSM erreichbar. Das ist die
   priorisierungswürdige Akquise-Pipeline.
4. **Stadtteil-Konzentration:** Innenstadt + Babelsberg + Bornstedt machen den
   Großteil aus – aber Außenbezirke wie Drewitz, Schlaatz, Eiche bleiben
   White Spaces, in denen ein Account-Manager mit lokaler Kenntnis Wert
   schaffen könnte.

## Was als Nächstes käme

- **Skalierung auf mehrere Städte:** Berlin, Brandenburg, Frankfurt/Oder mit
  einer Konfigurationszeile pro Stadt
- **Telefon-Coverage via lizenzierter API:** Google Places API ist die saubere
  Production-Variante (~$17/1000 Calls), während OSM die kostenlose Baseline
  liefert
- **Delta-Detection:** alte vs. neue OSM-Liste vergleichen → "Was ist neu
  eröffnet seit dem letzten Run?"
- **Anreicherung mit Lieferando-internen Daten:** Innerhalb des Konzerns wäre
  der Match natürlich nicht über manuelle Marktanzahl, sondern direkt gegen
  die interne Partnerliste – damit würde der Akquise-Sheet vollständig
  aktualisierbar.

## Lizenz / Datenquellen

- **OSM-Daten:** OpenStreetMap-Mitwirkende, lizenziert unter
  [ODbL](https://www.openstreetmap.org/copyright)
- **Code:** MIT
- **Lieferando-Marktanzahl:** manuell aus der öffentlichen Marktübersicht auf
  lieferando.de erfasst (Stichtag 27.04.2026, Anzahl: 132 Partner). Es wurde
  kein Lieferando-Inhalt automatisiert abgerufen.

---

_Bewerbungs-Mini-Projekt von Mathias Dobbelaere._
