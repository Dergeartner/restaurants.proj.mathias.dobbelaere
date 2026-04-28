"""
GMaps-Telefon-Anreicherung für Potsdam-Restaurants
====================================================
Nutzt den open-source google-maps-scraper (https://github.com/gosom/google-maps-scraper)
für Discovery von Gastro-Betrieben in Potsdam. Output ist eine CSV, die anschließend
in scrape_potsdam.py mit der OSM-Liste fuzzy-gemerged wird (Name + Geo-Distanz < 100 m).

Voraussetzung:
- Lokal kompilierte Binary des gosom-Scrapers, z.B. via:
    git clone https://github.com/gosom/google-maps-scraper && cd google-maps-scraper && go build
- Pfad zur Binary entweder über --binary Argument oder GMAPS_SCRAPER_BINARY ENV-Variable

Aufruf:
    set GMAPS_SCRAPER_BINARY=C:\\path\\to\\google-maps-scraper.exe
    python enrich_gmaps.py
    # oder
    python enrich_gmaps.py --binary "C:\\path\\to\\google-maps-scraper.exe"

Output: output/gmaps_potsdam.csv  (CSV-Schema vom gosom-Scraper)
"""

from __future__ import annotations

import argparse
import csv
import os
import subprocess
import sys
import time
from pathlib import Path

# Default: aus ENV-Variable lesen, sonst lokaler ./google-maps-scraper/-Ordner
DEFAULT_BINARY = Path(
    os.environ.get(
        "GMAPS_SCRAPER_BINARY",
        str(Path.home() / "google-maps-scraper" / "google-maps-scraper.exe"),
    )
)

OUTPUT_DIR = Path(__file__).parent / "output"

# Discovery-Queries: breit genug für ganz Potsdam, deckt alle Gastro-Typen ab
QUERIES = [
    # Allgemeine Stadtsuche
    "restaurants in Potsdam, Germany",
    "cafes in Potsdam, Germany",
    "bars in Potsdam, Germany",
    "pubs in Potsdam, Germany",
    "fast food in Potsdam, Germany",
    "biergarten in Potsdam, Germany",
    "imbiss in Potsdam, Germany",
    # Stadtteil-fokussiert (für bessere Long-Tail-Coverage)
    "restaurants in Babelsberg, Potsdam, Germany",
    "restaurants in Innenstadt, Potsdam, Germany",
    "restaurants in Bornstedt, Potsdam, Germany",
    "restaurants in Drewitz, Potsdam, Germany",
    "restaurants in Schlaatz, Potsdam, Germany",
    "restaurants in Eiche, Potsdam, Germany",
    "restaurants in Groß Glienicke, Potsdam, Germany",
    "restaurants in Waldstadt, Potsdam, Germany",
    "restaurants in Potsdam West, Germany",
    # Cuisine-fokussiert
    "italienisch in Potsdam, Germany",
    "asiatisch in Potsdam, Germany",
    "döner in Potsdam, Germany",
    "burger in Potsdam, Germany",
    "pizza in Potsdam, Germany",
]


def run_scraper(binary: Path, depth: int = 5, concurrency: int = 3) -> Path:
    """Führt den gosom-Scraper aus und gibt den CSV-Pfad zurück."""
    if not binary.exists():
        sys.exit(f"FEHLER: Scraper-Binary nicht gefunden: {binary}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    queries_file = OUTPUT_DIR / "_gmaps_queries.txt"
    results_file = OUTPUT_DIR / "gmaps_potsdam.csv"

    queries_file.write_text("\n".join(QUERIES), encoding="utf-8")

    cmd = [
        str(binary),
        "-input", str(queries_file),
        "-results", str(results_file),
        "-lang", "de",
        "-depth", str(depth),
        "-c", str(concurrency),
        "-exit-on-inactivity", "3m",
    ]

    print(f"[GMaps] Starte Scraper mit {len(QUERIES)} Queries (depth={depth}) ...")
    print(f"[GMaps] Output: {results_file}")
    t0 = time.time()

    try:
        proc = subprocess.Popen(
            cmd,
            cwd=str(binary.parent),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        while proc.poll() is None:
            time.sleep(5)
            if results_file.exists():
                try:
                    with open(results_file, "r", encoding="utf-8", errors="replace") as f:
                        n = sum(1 for _ in f) - 1
                    print(f"\r[GMaps] {max(n, 0)} Treffer bisher ...", end="", flush=True)
                except Exception:
                    pass
        print()
    except KeyboardInterrupt:
        proc.terminate()
        sys.exit("[GMaps] abgebrochen")

    queries_file.unlink(missing_ok=True)

    if not results_file.exists():
        sys.exit("[GMaps] Keine Ergebnisdatei produziert.")

    # Doppel-Treffer entfernen (mehrere Queries treffen oft dieselben Betriebe)
    deduplicate_csv(results_file)

    dur = int(time.time() - t0)
    with open(results_file, "r", encoding="utf-8", errors="replace") as f:
        n = sum(1 for _ in f) - 1
    print(f"[GMaps] Fertig in {dur//60} min {dur%60} s — {n} unique Treffer.")
    return results_file


def deduplicate_csv(path: Path) -> None:
    """Entfernt Duplikate (gleiche place_id ODER Name+Adresse)."""
    if not path.exists() or path.stat().st_size == 0:
        return
    with open(path, "r", encoding="utf-8", errors="replace", newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        fields = reader.fieldnames or []

    seen: set[str] = set()
    unique = []
    for r in rows:
        place_id = (r.get("place_id") or "").strip()
        name = (r.get("title") or "").strip().lower()
        addr = (r.get("complete_address") or r.get("address") or "").strip().lower()
        key = place_id or f"{name}|{addr}"
        if not key or key in seen:
            continue
        seen.add(key)
        unique.append(r)

    with open(path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(unique)


def main() -> int:
    parser = argparse.ArgumentParser(description="GMaps Discovery für Potsdam-Gastro")
    parser.add_argument("--binary", default=str(DEFAULT_BINARY), help="Pfad zum google-maps-scraper.exe")
    parser.add_argument("--depth", type=int, default=5)
    parser.add_argument("--concurrency", type=int, default=3)
    args = parser.parse_args()

    run_scraper(Path(args.binary), depth=args.depth, concurrency=args.concurrency)
    print()
    print("Nächster Schritt:")
    print("  python scrape_potsdam.py --merge-gmaps")
    print("  -> mergt OSM mit GMaps und schreibt restaurants.json + Excel neu")
    return 0


if __name__ == "__main__":
    sys.exit(main())
