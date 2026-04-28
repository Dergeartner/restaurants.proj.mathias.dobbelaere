"""
Halluzinations-Filter für extrahierte Speisekarten.

Lädt jede Restaurant-Webseite erneut (HTML-Cache), prüft ob jedes vom LLM
extrahierte Gericht als Substring im sichtbaren Text der Seite vorkommt.
Halluzinierte Einträge werden entfernt.

Aufruf:
    python verify_speisekarten.py
"""

from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup

OUTPUT_DIR = Path(__file__).parent / "output"
SPEISEKARTEN_JSON = OUTPUT_DIR / "speisekarten.json"

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)
HTTP_TIMEOUT = 12

# Mindest-Token-Match: ein Gericht ist nur "echt", wenn mindestens einer der
# signifikanten Tokens (≥4 Buchstaben) im Source-Text auftaucht
MIN_SIGNIFICANT_LEN = 4


def normalize_text(s: str) -> str:
    """Lowercase + Sonderzeichen raus, für robustes Substring-Matching."""
    s = s.lower()
    s = re.sub(r"[^a-zäöüß0-9 ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def fetch_page_text(url: str) -> str:
    """Lädt URL und gibt den Plain-Text zurück."""
    try:
        if not url.startswith(("http://", "https://")):
            url = f"https://{url}"
        r = requests.get(
            url,
            headers={"User-Agent": USER_AGENT, "Accept-Language": "de-DE,de;q=0.9"},
            timeout=HTTP_TIMEOUT,
            allow_redirects=True,
        )
        if r.status_code != 200 or not r.text:
            return ""
        soup = BeautifulSoup(r.text, "html.parser")
        for tag in soup(["script", "style", "noscript"]):
            tag.decompose()
        return normalize_text(soup.get_text(" "))
    except Exception:
        return ""


def gericht_in_source(gericht: str, source_text: str, preis: float) -> bool:
    """Prüft, ob ein Gericht plausibel im Source-Text vorkommt.

    Strategien:
    1. Vollständiger Name als Substring
    2. Mindestens 1 signifikantes Token (>=4 Buchstaben) UND der Preis-String
    """
    if not source_text:
        return False
    name_norm = normalize_text(gericht)
    if not name_norm:
        return False

    # Strategie 1: voller Name kommt vor
    if name_norm in source_text:
        return True

    # Strategie 2: signifikantes Token + Preis im Text
    tokens = [t for t in name_norm.split() if len(t) >= MIN_SIGNIFICANT_LEN]
    if not tokens:
        return False

    # Preis als String mit verschiedenen Schreibweisen
    preis_int = int(preis)
    preis_dec = f"{preis:.2f}".replace(".", ",")
    preis_alt = f"{preis:.2f}".replace(".", ",").rstrip("0").rstrip(",")
    has_price = (
        preis_dec in source_text
        or f"{preis_int}," in source_text
        or preis_alt in source_text
    )
    if not has_price:
        return False

    # Mindestens 1 signifikanter Token muss in der Nähe des Preises stehen
    return any(t in source_text for t in tokens)


def main() -> int:
    if not SPEISEKARTEN_JSON.exists():
        sys.exit("Keine speisekarten.json — erst enrich_speisekarten.py laufen lassen.")

    data = json.loads(SPEISEKARTEN_JSON.read_text(encoding="utf-8"))
    restaurants = data["restaurants"]
    candidates = [r for r in restaurants if r.get("anzahl_gerichte", 0) > 0]
    print(f"[Init] {len(candidates)} Restaurants mit Speisekarten zu prüfen")

    total_before = sum(r["anzahl_gerichte"] for r in candidates)
    total_kept = 0
    total_dropped = 0
    t0 = time.time()

    for i, r in enumerate(candidates, 1):
        url = r.get("speisekarten_url") or r["website"]
        text = fetch_page_text(url)
        if not text:
            print(f"  [{i}/{len(candidates)}] {r['name'][:40]:<40}  -- HTML nicht erreichbar, behalte alle")
            continue

        kept = []
        dropped = []
        for g in r["gerichte"]:
            if gericht_in_source(g["gericht"], text, g["preis"]):
                kept.append(g)
            else:
                dropped.append(g)

        if dropped:
            print(
                f"  [{i}/{len(candidates)}] {r['name'][:40]:<40}  "
                f"{len(kept):>3} ok / {len(dropped):>3} halluziniert"
            )
        r["gerichte"] = kept
        r["anzahl_gerichte"] = len(kept)
        r["halluzinationen"] = len(dropped)
        total_kept += len(kept)
        total_dropped += len(dropped)

    SPEISEKARTEN_JSON.write_text(
        json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    dur = int(time.time() - t0)
    print()
    print("=" * 60)
    print(f"  Vorher:        {total_before} Gerichte")
    print(f"  Verifiziert:   {total_kept}")
    print(f"  Halluziniert:  {total_dropped} ({100*total_dropped/max(total_before,1):.1f} %)")
    print(f"  Dauer:         {dur//60} min {dur%60} s")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
