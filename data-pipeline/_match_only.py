"""Match Lieferando-Partner gegen existing restaurants.json — überspringt
Overpass-Refetch (geht bei 504-Outage)."""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from scrape_potsdam import (
    Restaurant, calc_lead_score, write_excel, write_json, OUTPUT_DIR,
    load_lieferando_partner_csv, match_lieferando_csv,
    add_unmatched_partners_as_restaurants,
    LIEFERANDO_PARTNERS_TOTAL, _pct,
)

JSON_PATH = OUTPUT_DIR / "restaurants.json"


def main():
    data = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    restaurants = []
    skipped_old = 0
    for d in data["restaurants"]:
        # Alte Lieferando-only-Einträge verwerfen — werden gleich neu gebaut
        if d.get("kategorie") in ("lieferando_only", "lieferando_non_gastro"):
            skipped_old += 1
            continue
        restaurants.append(Restaurant(**d))
        # auf_lieferando-Flag zurücksetzen für sauberen Re-Match
        restaurants[-1].auf_lieferando = False
    print(f"[Load] {len(restaurants)} OSM-Restaurants (alte {skipped_old} Lieferando-only verworfen)")

    partners_csv = load_lieferando_partner_csv()
    print(f"[CSV]  {len(partners_csv)} Lieferando-Partner aus CSV")

    matched, unmatched = match_lieferando_csv(restaurants, partners_csv)
    added = add_unmatched_partners_as_restaurants(restaurants, unmatched)
    print(f"[Match] {matched} / {len(partners_csv)} gematcht in OSM")
    print(f"[Add]   {added} als Lieferando-only-Einträge ergänzt (Apotheken, Ketten ohne OSM-Match, etc.)")

    json_path = write_json(restaurants)
    excel_path = write_excel(restaurants)
    print(f"[Output] {json_path}")
    print(f"[Output] {excel_path}")

    total = len(restaurants)
    osm_only = sum(1 for r in restaurants if r.kategorie not in ("lieferando_only", "lieferando_non_gastro"))
    lieferando_only = sum(1 for r in restaurants if r.kategorie in ("lieferando_only", "lieferando_non_gastro"))
    on_lieferando = sum(1 for r in restaurants if r.auf_lieferando)
    osm_on_lieferando = sum(
        1 for r in restaurants
        if r.auf_lieferando and r.kategorie not in ("lieferando_only", "lieferando_non_gastro")
    )
    not_partner = osm_only - osm_on_lieferando
    not_partner_hot = sum(
        1 for r in restaurants
        if not r.auf_lieferando and r.lead_score == 3
        and r.kategorie not in ("lieferando_only", "lieferando_non_gastro")
    )
    print()
    print("=" * 60)
    print(f"Restaurants gesamt:               {total}")
    print(f"  davon OSM-Gastro:               {osm_only}")
    print(f"  davon Lieferando-only erganzt:  {lieferando_only}")
    print()
    print(f"Auf Lieferando (CSV-Coverage):    {on_lieferando} / {len(partners_csv)} ({_pct(on_lieferando, len(partners_csv))})")
    print(f"  davon in OSM gematcht:          {osm_on_lieferando}")
    print(f"  davon Lieferando-only:          {lieferando_only}")
    print()
    print(f"Akquise-Universe (OSM, offen):    {not_partner}")
    print(f"Akquise Hot Leads (Score 3):      {not_partner_hot}")
    print("=" * 60)


if __name__ == "__main__":
    main()
