# Restaurant Market Discovery — Potsdam

> **Data-driven sales discovery for the restaurant delivery market.**
> From open data to a prioritized acquisition pipeline in under 90 seconds.

**Live Demo:** https://restaurants-proj-mathias-dobbelaere.vercel.app
**Source:** https://github.com/Dergeartner/restaurants.proj.mathias.dobbelaere

---

## The Problem

Restaurant acquisition in delivery sales is bottlenecked by manual research:

- Account managers spend hours building partner lists by hand, scrolling through Google Maps, copying phone numbers and websites into Excel.
- Lead prioritization is gut-feel — it's hard to see which restaurants are worth a call today versus next quarter.
- Multi-location restaurant groups stay invisible: a winning conversation with one location should open the door to four more, but only if you know they belong together.
- Decision-maker research (owner, managing director, contact email) happens after the lead is qualified, eating sales time that should go into actual conversations.

The result: pipelines built slowly, refreshed rarely, and based on fragmented information.

## The Solution

A self-contained pipeline that turns the public web into a sales-ready acquisition list for one city — Potsdam — and refreshes in seconds instead of hours.

- **Automated discovery.** All gastronomy in the city pulled from OpenStreetMap, enriched with phone numbers and websites via Google Maps.
- **Lead prioritization.** Each restaurant gets a Hot / Warm / Cold score based on data quality and reachability. Filterable, sortable, exportable.
- **Decision-maker extraction.** Owner, managing director, contact email, commercial register pulled automatically from the legally required §5 TMG imprint on each website. No more researching after the fact.
- **Cluster detection.** Multi-location restaurant groups identified via VAT-ID matching across imprints — one won location opens the door to all sister locations of the group.
- **Lieferando match.** Existing partners marked, white spaces in the market made visible at a glance.

## Impact

Concrete numbers from the live Potsdam dataset (snapshot 2026-04-27):

| Metric | Number |
|---|---|
| Restaurants analyzed | **555** |
| Prioritized hot leads (Score 3) | **240** |
| Multi-location groups identified | **25** |
| Decision-makers extracted automatically | **300+** |
| Time from raw data to ranked acquisition list | **< 90 seconds** |
| Manual equivalent (Google Maps + Excel) | ~3 hours |

Replace ~3 hours of manual list-building per city with a 90-second script run.

## Why this matters (sales perspective)

For an account manager in Strategic Accounts:

- **Less Excel, more conversations.** The list is already prioritized when you sit down to call.
- **Bigger leverage per meeting.** Cluster detection turns a single location pitch into a multi-location conversation.
- **Cleaner outreach.** Every lead arrives with a real contact person and email, not a generic info@.
- **Visible market state.** White-space and penetration visible against the existing Lieferando partner base — you see immediately where the market is open and where it's saturated.

The same approach scales to any city, any vertical with public web presence, with one config line per city.

---

## Manual vs. Automated

| Task | Manual | This project |
|---|---|---|
| Complete restaurant list for one city | ~3h research + Excel | ~90s script run |
| Check existing partner status | Click city by city | One column in the export |
| Prioritize acquisition candidates | Subjective gut feel | Lead score from data quality |
| Refresh in 6 months | Start from scratch | Re-run the script |
| Find decision-maker per lead | 5–10 min per restaurant | Pre-extracted column |
| Spot multi-location groups | Almost impossible by hand | Auto-clustered via VAT-ID |

---

## Frontend Features

- **Stats bar:** total / with website / hot leads / Lieferando market penetration
- **Market insights:** average main-course price by district and cuisine
- **Restaurant groups:** 25 multi-location clusters with Trojan-acquisition / greenfield / full-partner buckets
- **Table:** live filters (search, category, district, hot leads, acquisition candidates), sortable per column
- **Map (Leaflet):** color-coded pins by lead score; click a pin to see decision-maker data and open the full restaurant modal
- **Restaurant modal:** master data + structured menu + decision-maker block from imprint
- **Excel export:** filtered or complete list, including decision-maker columns

---

## Architecture

```
 OSM (Overpass)        GMaps (local             Restaurant websites
 ODbL                  discovery scraper)        (public URLs from OSM)
        │                       │                          │
        ▼                       ▼                          ▼
  scrape_potsdam.py        enrich_gmaps.py        enrich_speisekarten.py
  • Overpass query         • Multi-query           • Multi-subpage crawl
  • District via NN        • Dedup                 • GPT-4o-mini extract
  • Lead score             • Phone/website-        • Structured JSON
  • Lieferando match         enrichment              with categorization
        │                       │                          │
        │                       │                  enrich_impressum.py
        │                       │                  • §5 TMG imprint
        │                       │                  • Decision-maker
        │                       │                  • VAT-ID for clusters
        │                       │                          │
        └───────────┬───────────┴──────────────┬───────────┘
                    ▼                          ▼
        partnerliste_potsdam.xlsx       speisekarten.json
        4 sheets · lead traffic-light   impressum.json
        Acquisition pipeline sheet      Categorized menu data
                    │                          │
                    └──────────────┬───────────┘
                                   ▼
                           Next.js frontend
                           Table · Map · Detail modal
                           Market insights · Cluster view
```

### Three orthogonal pipelines

1. **OSM discovery** (`scrape_potsdam.py`) — Overpass API delivers the universe of gastronomy (555 in Potsdam). District assignment via nearest-neighbor against `place=suburb` centroids.

2. **GMaps enrichment** (`enrich_gmaps.py`) — wrapper around the local `gosom/google-maps-scraper` binary. 21 city + district + cuisine queries → 470+ unique hits → fuzzy-match to OSM list via geo-distance < 120m. Lifts hot-lead share by ~38%.

3. **Menu + decision-maker extraction** (`enrich_speisekarten.py`, `enrich_impressum.py`) — crawls homepage + up to 12 sub-pages per restaurant, sends aggregated text to GPT-4o-mini, gets back validated JSON. Used both for menu data (categorized: pizza, pasta, drinks…) and for §5 TMG imprint data (owner, managing director, VAT-ID for cluster detection). ~€0.90 for all 407 websites.

---

## Tech Stack

- **Pipeline:** Python 3.13 (`requests`, `beautifulsoup4`, `openpyxl`, `pypdf`, `rapidfuzz`)
- **Discovery source:** OpenStreetMap via Overpass API (free, ODbL-licensed)
- **Phone/website enrichment:** local Google Maps scraper (gosom/google-maps-scraper)
- **AI / LLM:** OpenAI GPT-4o-mini with JSON schema validation for menu and imprint extraction
- **Frontend:** Next.js 16 (App Router) + TypeScript + Tailwind CSS + shadcn/ui (Radix Dialog)
- **Map:** Leaflet with OSM tiles
- **Data layer:** static JSON in `web/public/` — no database, no backend
- **Hosting:** Vercel (static)

---

## Quickstart

### 1. Pull the data

```bash
cd data-pipeline
python -m venv .venv && source .venv/bin/activate   # .venv\Scripts\activate on Windows
pip install -r requirements.txt
python scrape_potsdam.py
```

Output: `data-pipeline/output/restaurants.json` and `data-pipeline/output/partnerliste_potsdam.xlsx`.

### 2. (Optional) Phone enrichment via Google Maps

```bash
# Requires compiled google-maps-scraper.exe (path configurable in enrich_gmaps.py)
python enrich_gmaps.py
python scrape_potsdam.py --merge-gmaps
```

Lifts phone-number coverage from ~43% (OSM only) to ~85–95%, which directly increases the number of Score-3 hot leads.

### 3. (Optional) Menu extraction via GPT-4o-mini

```bash
# OpenAI key in credentials.json (gitignored):
#   {"openai_key": "sk-..."}
python enrich_speisekarten.py --resume   # ~30–60 min, ~€0.90 for 407 restaurants
```

Crawls homepage + up to 12 sub-pages and extracts a structured menu as JSON in `output/speisekarten.json`. Local fallback with Llama 3.1:8b via `--force-ollama` (free, but ~20–30% hallucination rate).

### 4. (Optional) Decision-maker extraction via GPT-4o-mini

```bash
python enrich_impressum.py --resume
```

Extracts §5 TMG imprint data (owner, managing director, contact email, VAT-ID, commercial register) per restaurant and writes to `output/impressum.json`. VAT-IDs are then matched across restaurants to identify multi-location groups.

### 5. (Optional) Lieferando partners

Fill `data-pipeline/lieferando_partners_potsdam.txt` with one partner name per line (manually captured from the public market overview), then:

```bash
python scrape_potsdam.py --merge-gmaps
```

The `Auf_Lieferando` column is populated via fuzzy match (threshold 88) against the OSM list. The "acquisition pipeline" sheet immediately surfaces non-partners with high data quality.

### 6. Run the frontend locally

```bash
cp data-pipeline/output/restaurants.json web/public/
cp data-pipeline/output/partnerliste_potsdam.xlsx web/public/
cp data-pipeline/output/speisekarten.json web/public/
cp data-pipeline/output/impressum.json web/public/
cd web
npm install
npm run dev
# → http://localhost:3000
```

---

## Concrete insights from the Potsdam dataset

1. **OSM is a credible discovery source for German cities.** ~59% of restaurants have a website on file — usable as a baseline before paid enrichment.
2. **Fragmented market penetration.** Lieferando holds ~24% of the OSM gastronomy as partners — both significant reach and significant remaining potential.
3. **Lead-score distribution.** ~43% of restaurants are hot leads (Score 3) reachable with both website and phone — that's the priority pipeline.
4. **District concentration.** Center + Babelsberg + Bornstedt dominate; outlying areas like Drewitz, Schlaatz, Eiche remain white spaces where a manager with local knowledge can create real value.

## What would come next

- **Scale to multiple cities:** Berlin, Brandenburg, Frankfurt/Oder with one config line per city.
- **Phone coverage via licensed API:** Google Places API as the production-grade variant (~$17/1000 calls); OSM as the free baseline.
- **Delta detection:** compare old vs. new OSM list → "what opened since the last run?"
- **Internal partner-list integration:** inside Lieferando, the Auf_Lieferando match would run against the internal partner list directly instead of a manual snapshot — making the acquisition sheet fully self-updating.

---

## License & Data Sources

- **OSM data:** © OpenStreetMap contributors, licensed under [ODbL](https://www.openstreetmap.org/copyright)
- **Code:** MIT
- **Lieferando partner count:** captured manually from the public market overview on lieferando.de (snapshot 2026-04-27, 132 partners). No Lieferando content was scraped.

---

_Built by Mathias Dobbelaere as part of an application for Werkstudent Strategic Accounts at Just Eat Takeaway / Lieferando._
