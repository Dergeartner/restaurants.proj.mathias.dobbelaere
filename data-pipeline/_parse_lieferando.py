"""Parser für die manuell erfasste Lieferando-Liste (aus _lieferando_raw.txt)."""

import csv
import re
from pathlib import Path

RAW = Path(__file__).parent / "_lieferando_raw.txt"
OUT = Path(__file__).parent / "lieferando_partners_potsdam.csv"

# Zeilen, die garantiert KEIN Restaurant-Name sind
NOISE_EXACT = {
    "Stempelkarte", "Gesponsert", "Neu",
    "Lieferung vorbestellen", "Lieferung nicht möglich",
    "Keine Bestellannahme", "Kein Mindestbestellwert",
    "Kostenlose Lieferung", "Gratis Lieferung möglich",
    "So werden diese Ergebnisse sortiert",
}

NOISE_PATTERNS = [
    re.compile(r"^Bei \d+ Partnern bestellen$"),
    re.compile(r"^\d+[,.]?\d*$"),                       # Bewertung "4,1" oder "5"
    re.compile(r"^\(.*\)$"),                            # Reviews "(1.800+)"
    re.compile(r"^Min\. .*€"),                          # Min-Bestellwert
    re.compile(r"^\d+([,.]\d+)?€ Lieferung"),
    re.compile(r"^Geöffnet ab"),
    re.compile(r"^\d+-\d+ min"),
    re.compile(r"\d+ ?% Rabatt"),
    re.compile(r"^\d+ für \d+ Deal"),
    re.compile(r"^Spare \d+"),
    re.compile(r"^Gratis Produkt"),
    re.compile(r"^Suppen-Dienstag"),
    re.compile(r"^Month deal"),
    re.compile(r"^\d+% off$"),
    re.compile(r"^\d+,\d+ € Rabatt"),
    re.compile(r"^\d+ ?€ Lieferung$"),
]

# Cuisine-Tags — kommen typisch genau VOR Min-Bestellwert
# enthalten Komma + bekannte Cuisine-Wörter
CUISINE_INDICATORS = [
    "Indisch", "Italienisch", "Italienische Pizza", "Amerikanische Pizza",
    "Burger", "Vegan", "Vegetarisch", "Sushi", "Asiatisch", "Türkisch",
    "Chinesisch", "Thailändisch", "Vietnamesisch", "Koreanisch", "Japanisch",
    "Mexikanisch", "Griechisch", "Libanesisch", "Arabisch", "Französisch",
    "Hähnchen", "Hühnchen", "Pasta", "Salate", "Snacks", "Pommes",
    "Suppen", "Dumplings", "Bagels", "Bowls", "Poke bowl", "Falafel",
    "Frühstück", "Mittagsangebote", "Nachspeisen", "Kuchen", "Café",
    "Donuts", "Bubble Tea", "Pfannkuchen", "Hot Dog", "Steaks", "Gyros",
    "Eiscreme", "Backwaren", "Lebensmittel", "Geschäfte", "Apotheken",
    "Alkohol", "Getränke/Snacks", "Sandwiches", "Sonstiges", "Glutenfrei",
    "Football Deals", "100% Halal", "2 für 1 Deals", "Angebote",
    "Deutsch", "Deutsche Gerichte", "Fisch", "Mittagsangebote",
    "Pizza", "Döner", "Asiatisch", "Fish",
]


def is_noise(line: str) -> bool:
    if not line.strip() or line.strip() in NOISE_EXACT:
        return True
    for p in NOISE_PATTERNS:
        if p.match(line.strip()):
            return True
    return False


def is_cuisine_tag(line: str) -> bool:
    """Eine Cuisine-Zeile enthält typisch ',' + bekannte Cuisine-Worte
    oder ist eine reine Cuisine ohne Komma (z.B. 'Steaks', 'Hot Dog', 'Asiatisch')."""
    s = line.strip()
    if "," in s:
        return any(w in s for w in CUISINE_INDICATORS)
    # Single-Cuisine-Zeilen
    return s in CUISINE_INDICATORS


def parse() -> list[str]:
    text = RAW.read_text(encoding="utf-8")
    lines = [l.rstrip() for l in text.split("\n")]

    # Block-basiertes Parsing: Restaurants durch Leerzeile getrennt
    # Innerhalb eines Blocks ist Name = erste nicht-Noise-Zeile, die KEINE Cuisine ist
    blocks: list[list[str]] = []
    current: list[str] = []
    for ln in lines:
        if not ln.strip():
            if current:
                blocks.append(current)
                current = []
        else:
            current.append(ln)
    if current:
        blocks.append(current)

    names: list[str] = []
    for block in blocks:
        # Filter raus: alle Noise-Zeilen
        clean = [l.strip() for l in block if not is_noise(l)]
        if not clean:
            continue
        # Erste Zeile, die KEINE Cuisine ist, ist der Restaurant-Name
        for l in clean:
            if not is_cuisine_tag(l):
                names.append(l)
                break

    # Dedup (case-insensitive), aber Reihenfolge erhalten
    seen = set()
    unique = []
    for n in names:
        k = n.lower()
        if k in seen:
            continue
        seen.add(k)
        unique.append(n)

    return unique


def main():
    names = parse()
    print(f"Extrahiert: {len(names)} Restaurants")

    # CSV zuerst schreiben (UTF-8), dann erst Konsolen-Print mit ASCII-Fallback
    with OUT.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["name", "adresse"])
        for n in names:
            w.writerow([n, ""])
    print(f"-> {OUT}")
    print()
    for i, n in enumerate(names, 1):
        try:
            print(f"  {i:>3}. {n}")
        except UnicodeEncodeError:
            ascii_safe = n.encode("ascii", errors="replace").decode("ascii")
            print(f"  {i:>3}. {ascii_safe}  [non-ASCII]")


if __name__ == "__main__":
    main()
