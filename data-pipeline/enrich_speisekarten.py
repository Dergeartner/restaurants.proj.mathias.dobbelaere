"""
Speisekarten-Extraktion für Potsdam-Restaurants
================================================
Lädt für jedes Restaurant mit Website das HTML, sucht nach einer Speisekarte
(typische Sub-Pages: /speisekarte, /menu, /karte, /menue), und extrahiert mit
Llama 3.1:8b strukturierte Gerichte + Preise.

Output: output/speisekarten.json — pro Restaurant eine Liste
[{"gericht": "Palak Paneer", "preis": 11.48, "kategorie": "Hauptgericht"}, ...]

Nutzt KEIN Lieferando, kein Google Maps — nur die offiziellen Restaurant-
Webseiten, die Restaurants selbst veröffentlichen.

Aufruf:
    python enrich_speisekarten.py --limit 10        # Test mit 10 Restaurants
    python enrich_speisekarten.py                   # alle 407 Websites
    python enrich_speisekarten.py --resume          # nur die noch nicht verarbeiteten
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from io import BytesIO

try:
    from pypdf import PdfReader
    PDF_SUPPORT = True
except ImportError:
    PDF_SUPPORT = False

OUTPUT_DIR = Path(__file__).parent / "output"
RESTAURANTS_JSON = OUTPUT_DIR / "restaurants.json"
SPEISEKARTEN_JSON = OUTPUT_DIR / "speisekarten.json"
CREDENTIALS_FILE = Path(__file__).parent / "credentials.json"

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llama3.1:8b"
OPENAI_URL = "https://api.openai.com/v1/chat/completions"
OPENAI_MODEL = "gpt-4o-mini"


def get_openai_key() -> str:
    """Liest OpenAI-Key aus ENV-Var oder credentials.json."""
    import os
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    if key:
        return key
    if CREDENTIALS_FILE.exists():
        try:
            data = json.loads(CREDENTIALS_FILE.read_text(encoding="utf-8"))
            return str(data.get("openai_key", "")).strip()
        except Exception:
            pass
    return ""

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)
HTTP_TIMEOUT = 12
MAX_HTML_CHARS_PER_PAGE = 12_000  # pro einzelner Sub-Page
MAX_HTML_CHARS_TOTAL = 45_000     # gesamtes Text-Budget je Restaurant (großzügig — GPT-4o-mini hat 128k Kontext)
MAX_SUBPAGES = 12                 # max Sub-Pages pro Restaurant

# Typische Sub-Page-Pfade für Speisekarten — Hinweise auf eine Speisekarten-Section
SPEISEKARTEN_KEYWORDS = [
    "speisekarte", "speisekarten", "speise-karte", "menu", "menue", "menü",
    "karte", "karten", "essen", "gerichte", "menukarte", "menuekarte",
    "drinks", "getränkekarte", "getraenkekarte", "weinkarte", "cocktailkarte",
    "bar-karte", "barkarte", "tageskarte", "lunchkarte", "abendkarte",
    "frühstückskarte", "fruehstueckskarte",
    # Bestell- / Lieferservice-Pfade
    "bestellen", "bestellung", "online-bestellen", "lieferservice",
    "lieferdienst", "online-shop", "shop", "order", "delivery",
    "online-bestellung",
]

# Typische Speisekarten-Kategorien, die als eigene Sub-Pages existieren
SPEISEN_KATEGORIEN_KEYWORDS = [
    "pizza", "pasta", "salat", "salate", "burger", "vorspeise", "vorspeisen",
    "hauptgericht", "hauptgerichte", "dessert", "desserts", "nachspeise",
    "specials", "tagesangebot", "fleisch", "fisch", "vegetarisch", "vegan",
    "beilage", "beilagen", "suppe", "suppen", "wraps", "snacks",
    "spezialitäten", "spezialitaeten", "sushi", "döner", "doener",
    "kuchen", "torten", "backwaren", "brote", "brötchen", "broetchen",
    "frühstück", "fruehstueck", "mittagstisch", "mittag",
]

# Externe Bestell-Plattformen, die als iframe-src auftauchen können
EXTERNAL_MENU_HOSTS = [
    "speisekartenweb.de", "speisekarte24.com",
    "resmio.com", "resmio.de",
    "bestellbar.com", "bestellbar.de",
    "click-eat.de", "wirsindbestellbar.de",
    "lieferando.de",  # nicht crawlen, nur erkennen
    "restablo.de", "ordry.com",
]


# ---------------------------------------------------------------------------
# HTTP-Fetch mit BeautifulSoup-Parsing
# ---------------------------------------------------------------------------


def _do_get(url: str, timeout: int = HTTP_TIMEOUT) -> str:
    """Einzelner GET-Versuch, gibt body bei 200 zurück."""
    try:
        r = requests.get(
            url,
            headers={
                "User-Agent": USER_AGENT,
                "Accept-Language": "de-DE,de;q=0.9",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
            timeout=timeout,
            allow_redirects=True,
        )
        if r.status_code == 200 and r.text:
            return r.text
    except Exception:
        pass
    return ""


def _follow_meta_refresh(html: str, base_url: str, depth: int = 0) -> str:
    """Folgt <meta http-equiv='refresh' content='0;url=...'> Weiterleitungen.
    Manche alte Restaurant-Seiten haben fast leere Homepage + Meta-Refresh nach Willkommen.html.
    """
    if depth > 2 or not html or len(html) > 5000:
        # Wenn HTML schon groß ist, ist's keine reine Redirect-Page
        return html
    try:
        soup = BeautifulSoup(html, "html.parser")
        meta = soup.find("meta", attrs={"http-equiv": re.compile(r"refresh", re.I)})
        if not meta:
            return html
        content = meta.get("content", "")
        m = re.search(r"url=([^;]+)", content, re.IGNORECASE)
        if not m:
            return html
        target = m.group(1).strip().strip("\"'")
        absolute = urljoin(base_url, target)
        if absolute == base_url:
            return html
        new_html = _do_get(absolute)
        if new_html:
            return _follow_meta_refresh(new_html, absolute, depth + 1)
    except Exception:
        pass
    return html


def fetch_html(url: str) -> str:
    """Lädt HTML einer URL mit Retry-Logik:
    1. Original-URL versuchen
    2. Bei Fehler: anderes Schema versuchen (https <-> http)
    3. Bei Fehler: Domain-Root probieren (falls Pfad)
    4. Auf Erfolg: Meta-Refresh-Weiterleitungen folgen
    """
    if not url:
        return ""
    if not url.startswith(("http://", "https://")):
        url = f"https://{url}"

    body = _do_get(url)
    if not body:
        if url.startswith("https://"):
            body = _do_get("http://" + url[8:])
        else:
            body = _do_get("https://" + url[7:])
    if not body:
        try:
            parsed = urlparse(url)
            if parsed.path and parsed.path != "/":
                root = f"{parsed.scheme}://{parsed.netloc}/"
                body = _do_get(root)
        except Exception:
            pass

    if body:
        body = _follow_meta_refresh(body, url)
    return body


def fetch_pdf_text(url: str) -> str:
    """Lädt eine PDF-URL und extrahiert den Text. Gibt leeren String bei Fehler zurück."""
    if not PDF_SUPPORT:
        return ""
    try:
        if not url.startswith(("http://", "https://")):
            url = f"https://{url}"
        r = requests.get(
            url,
            headers={"User-Agent": USER_AGENT, "Accept-Language": "de-DE,de;q=0.9"},
            timeout=HTTP_TIMEOUT * 2,  # PDFs können größer sein
            allow_redirects=True,
        )
        if r.status_code != 200 or not r.content:
            return ""
        # Sanity-check: ist's wirklich ein PDF?
        if not r.content[:4].startswith(b"%PDF"):
            return ""
        reader = PdfReader(BytesIO(r.content))
        pages_text = []
        for page in reader.pages[:8]:  # max 8 Seiten reichen für eine Speisekarte
            try:
                t = page.extract_text() or ""
                if t.strip():
                    pages_text.append(t)
            except Exception:
                continue
        text = "\n\n".join(pages_text)
        # Entferne mehrfache Whitespaces
        return re.sub(r"\s+", " ", text).strip()
    except Exception:
        return ""


def is_pdf_url(url: str) -> bool:
    """Heuristisch: endet die URL auf .pdf?"""
    return url.lower().split("?")[0].split("#")[0].endswith(".pdf")


def find_speisekarten_urls(homepage_html: str, base_url: str) -> list[str]:
    """Sammelt ALLE Speisekarten-relevanten Sub-Pages.

    Strategien:
    1. Same-Domain-<a>-Links mit Speisekarten-Keywords im href oder text
    2. Reine Path-Pattern wie /karte, /menu am Pfadende
    3. <iframe src="..."> mit external Menu-Plattform (speisekartenweb, resmio)
    """
    if not homepage_html:
        return []
    try:
        soup = BeautifulSoup(homepage_html, "html.parser")
    except Exception:
        return []

    base_host = urlparse(base_url).netloc
    seen: set[str] = set()
    urls: list[str] = []
    keywords = SPEISEKARTEN_KEYWORDS + SPEISEN_KATEGORIEN_KEYWORDS

    # Strategie 1+2: <a>-Links auf same-domain
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        text = (a.get_text() or "").lower().strip()
        href_lower = href.lower()
        combined = f"{href_lower} {text}"

        # Match: Keyword im Text oder Href
        keyword_match = any(kw in combined for kw in keywords)

        # Match: Pfad-Ende ist ein Speisekarten-Kürzel
        path_match = False
        try:
            path = urlparse(href if href.startswith("http") else urljoin(base_url, href)).path.lower()
            path_segments = [s for s in path.strip("/").split("/") if s]
            if path_segments:
                last = path_segments[-1]
                if last in {"karte", "menu", "menue", "menü", "speisekarte", "speisen"}:
                    path_match = True
        except Exception:
            pass

        if not (keyword_match or path_match):
            continue

        absolute = urljoin(base_url, href)
        if not absolute.startswith("http"):
            continue
        if urlparse(absolute).netloc != base_host:
            continue
        absolute = absolute.split("#")[0]
        if absolute in seen or absolute.rstrip("/") == base_url.rstrip("/"):
            continue
        seen.add(absolute)
        urls.append(absolute)
        if len(urls) >= MAX_SUBPAGES:
            break

    # Strategie 3: Externe Menu-Plattformen via iframe
    if len(urls) < MAX_SUBPAGES:
        for iframe in soup.find_all("iframe", src=True):
            src = iframe["src"].strip()
            absolute = urljoin(base_url, src)
            if not absolute.startswith("http"):
                continue
            host = urlparse(absolute).netloc.replace("www.", "").lower()
            if any(h in host for h in EXTERNAL_MENU_HOSTS):
                if "lieferando" in host:
                    continue
                absolute = absolute.split("#")[0]
                if absolute not in seen:
                    seen.add(absolute)
                    urls.append(absolute)
                    if len(urls) >= MAX_SUBPAGES:
                        break

    # Strategie 4: <frame>-Tags (klassisches Frameset, alte Webseiten)
    if len(urls) < MAX_SUBPAGES:
        for frame in soup.find_all(["frame"], src=True):
            src = frame["src"].strip()
            absolute = urljoin(base_url, src)
            if not absolute.startswith("http"):
                continue
            if urlparse(absolute).netloc != base_host:
                continue
            absolute = absolute.split("#")[0]
            if absolute not in seen and absolute.rstrip("/") != base_url.rstrip("/"):
                seen.add(absolute)
                urls.append(absolute)
                if len(urls) >= MAX_SUBPAGES:
                    break

    return urls


def extract_text_block(html: str, max_chars: int = MAX_HTML_CHARS_PER_PAGE) -> str:
    """Extrahiert sichtbaren Textinhalt (ohne Skripte/Styles), gekürzt."""
    if not html:
        return ""
    try:
        soup = BeautifulSoup(html, "html.parser")
    except Exception:
        return html[:max_chars]

    for tag in soup(["script", "style", "noscript", "header", "footer", "nav"]):
        tag.decompose()

    # Bevorzugt main / article Tags, sonst body
    target = soup.find("main") or soup.find("article") or soup.find("body") or soup
    text = target.get_text(separator="\n", strip=True)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text[:max_chars]


def collect_all_pages_text(homepage_html: str, homepage_url: str) -> tuple[str, list[str]]:
    """Sammelt Text der Homepage + aller Speisekarten-Sub-Pages.
    Returns: (kombinierter Text, Liste der Quell-URLs)
    """
    pages: list[tuple[str, str]] = []  # (url, text)
    homepage_text = extract_text_block(homepage_html)
    if homepage_text:
        pages.append((homepage_url, homepage_text))

    sub_urls = find_speisekarten_urls(homepage_html, homepage_url)
    for sub_url in sub_urls:
        if sum(len(t) for _, t in pages) >= MAX_HTML_CHARS_TOTAL:
            break
        # PDF-Support: wenn .pdf, dann via pypdf
        if is_pdf_url(sub_url):
            pdf_text = fetch_pdf_text(sub_url)
            if pdf_text:
                pages.append((sub_url, pdf_text[:MAX_HTML_CHARS_PER_PAGE]))
            continue
        sub_html = fetch_html(sub_url)
        if not sub_html:
            continue
        sub_text = extract_text_block(sub_html)
        if sub_text:
            pages.append((sub_url, sub_text))

    # Texte mit URL-Headern verkettet zusammenführen, hartes Limit
    chunks = []
    used = 0
    quellen: list[str] = []
    for url, text in pages:
        header = f"\n\n--- SEITE: {url} ---\n"
        budget = MAX_HTML_CHARS_TOTAL - used - len(header)
        if budget <= 200:
            break
        snippet = text[:budget]
        chunks.append(header + snippet)
        quellen.append(url)
        used += len(header) + len(snippet)

    return "".join(chunks).strip(), quellen


# ---------------------------------------------------------------------------
# Ollama-Aufruf zur strukturierten Extraktion
# ---------------------------------------------------------------------------


PROMPT_TEMPLATE = """Du bist ein präziser Daten-Extraktor für Restaurant-Speisekarten. Aus dem folgenden Text (kann mehrere Unterseiten der Restaurant-Webseite enthalten) extrahierst du JEDEN einzelnen Menüpunkt mit konkretem Preis in Euro – egal ob Speise oder Getränk.

ABSOLUT VOLLSTÄNDIG SEIN:
- Erfasse JEDE Pizza, JEDE Pasta, JEDEN Salat, JEDEN Burger, JEDES Hauptgericht, JEDE Vorspeise, JEDES Dessert, JEDES Getränk – nichts auslassen.
- Auch wenn das Menü 80+ Einträge hat: alle erfassen.
- Mehrere Unterseiten (Pizza, Pasta, Burger, Getränke separat) im Text? → alle extrahieren.

PREIS-REGELN:
- Nur Einträge mit klar erkennbarem Preis (z.B. "11,48 €", "12.50€", "8,90 €", "€ 9.50").
- Bei Preis-Bereichen oder mehreren Größen ("klein 8,50 / groß 12,00"): erfasse JEDE Größe als eigenen Eintrag mit Größenangabe im Namen ("Pizza Margherita (klein)").
- Ignoriere Mindestbestellwerte, Liefergebühren, Pfand-Beträge, Trinkgeld-Hinweise.
- Plausibilitätscheck: Preis zwischen 0,50 € und 200 € (außerhalb = ignorieren).

KATEGORIE — entscheide selbst:
Wähle die zutreffendste Kategorie aus dieser Liste:
"Pizza", "Pasta", "Salat", "Vorspeise", "Suppe", "Hauptgericht", "Burger", "Beilage",
"Dessert", "Snack", "Frühstück", "Kindergericht", "Spezialität",
"Heißgetränk", "Kaltgetränk", "Bier", "Wein", "Spirituose", "Cocktail", "Sonstiges"

NAMEN:
- Verwende den exakt geschriebenen Speisennamen wie auf der Karte (deutsch/italienisch wie geschrieben).
- KEINE Beschreibungstexte mit ins Feld "gericht" — nur der Name.
- Wenn ein Gericht mit Nummer durchnummeriert ist (z.B. "32. Palak Panir"), die Nummer weglassen.

FORMAT — antworte AUSSCHLIESSLICH mit einem JSON-Array, ohne Markdown-Codeblock, ohne Erklärtext:
[{"gericht": "Pizza Margherita", "preis": 8.50, "kategorie": "Pizza"}, ...]

WENN KEINE GÜLTIGEN PREIS-EINTRÄGE: antworte mit []

TEXT:
---
{text}
---

JSON:"""


def query_openai(text: str, api_key: str, timeout: int = 60) -> str:
    """Schickt Text an GPT-4o-mini, gibt rohe Response zurück."""
    if not text.strip():
        return ""
    prompt = PROMPT_TEMPLATE.replace("{text}", text)
    try:
        r = requests.post(
            OPENAI_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": OPENAI_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.05,
                "max_tokens": 8000,
            },
            timeout=timeout,
        )
        if r.status_code != 200:
            print(f"    [OpenAI] HTTP {r.status_code}: {r.text[:150]}")
            return ""
        return r.json()["choices"][0]["message"]["content"].strip()
    except Exception as e:
        print(f"    [OpenAI] Fehler: {type(e).__name__}: {str(e)[:80]}")
        return ""


def query_ollama_raw(text: str, timeout: int = 180) -> str:
    """Schickt Text an Llama 3.1, gibt rohe Response zurück."""
    prompt = PROMPT_TEMPLATE.replace("{text}", text)
    try:
        r = requests.post(
            OLLAMA_URL,
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": 0.05, "num_predict": 3500},
            },
            timeout=timeout,
        )
        if r.status_code != 200:
            return ""
        return r.json().get("response", "").strip()
    except Exception as e:
        print(f"    [Ollama] Fehler: {type(e).__name__}: {str(e)[:80]}")
        return ""


# Wird beim Start gesetzt, abhängig davon ob OpenAI-Key vorhanden ist
_OPENAI_KEY: str | None = None


def query_llm(text: str) -> list[dict] | None:
    """Schickt den Text an OpenAI (wenn Key) oder Ollama, parst das JSON-Array."""
    if not text.strip():
        return None
    try:
        if _OPENAI_KEY:
            raw = query_openai(text, _OPENAI_KEY)
        else:
            raw = query_ollama_raw(text)

        if not raw:
            return []
        # Smart-Quotes von LLM-Output normalisieren
        raw = raw.replace("“", '"').replace("”", '"').replace("‘", "'").replace("’", "'")
        # Codeblock-Marker entfernen
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```\s*$", "", raw)
        # JSON-Array aus dem Output ziehen
        match = re.search(r"\[.*\]", raw, re.DOTALL)
        if not match:
            return []
        try:
            parsed = json.loads(match.group(0))
        except json.JSONDecodeError:
            # Manchmal hängt LLM ein Komma am Ende rein — bereinigen
            cleaned = re.sub(r",\s*\]", "]", match.group(0))
            cleaned = re.sub(r",\s*\}", "}", cleaned)
            try:
                parsed = json.loads(cleaned)
            except json.JSONDecodeError:
                return []
        if not isinstance(parsed, list):
            return []
        result = []
        for e in parsed:
            if not isinstance(e, dict):
                continue
            normalized = _normalize_entry(e)
            if normalized is not None:
                result.append(normalized)
        return result
    except Exception as e:
        print(f"    [LLM] Parse-Fehler: {type(e).__name__}: {str(e)[:80]}")
        return None


def _normalize_entry(e: dict) -> dict | None:
    """Validiert + normalisiert einen Speise-Eintrag."""
    name = str(e.get("gericht", "")).strip()
    if not name or len(name) > 120:
        return None
    preis_raw = e.get("preis")
    try:
        preis = float(str(preis_raw).replace(",", "."))
    except (ValueError, TypeError):
        return None
    if preis <= 0 or preis > 500:  # Plausibilitäts-Grenzen
        return None
    kat = str(e.get("kategorie", "Sonstiges")).strip()[:30]
    return {"gericht": name, "preis": round(preis, 2), "kategorie": kat}


# ---------------------------------------------------------------------------
# Hauptablauf — pro Restaurant
# ---------------------------------------------------------------------------


def process_restaurant(r: dict) -> dict:
    """Verarbeitet ein einzelnes Restaurant. Returns Result-Dict."""
    name = r["name"]
    website = r["website"]
    result: dict = {
        "name": name,
        "website": website,
        "url_versucht": website,
        "speisekarten_url": None,
        "quellen_urls": [],
        "anzahl_gerichte": 0,
        "gerichte": [],
        "fehler": None,
    }

    if not website.startswith(("http://", "https://")):
        homepage_url = f"https://{website}"
    else:
        homepage_url = website

    homepage = fetch_html(homepage_url)
    if not homepage:
        result["fehler"] = "homepage_nicht_erreichbar"
        return result

    # Sammle Homepage + alle Speisekarten-Subpages
    text, quellen = collect_all_pages_text(homepage, homepage_url)
    if not text:
        result["fehler"] = "kein_text_extrahierbar"
        return result

    result["quellen_urls"] = quellen
    # Erste Sub-Page (= speisekarten-spezifisch) als primäre URL anzeigen
    result["speisekarten_url"] = quellen[1] if len(quellen) > 1 else quellen[0]

    parsed = query_llm(text)
    if parsed is None:
        result["fehler"] = "llm_fehler"
        return result

    # Duplikate entfernen (gleicher Name + Preis)
    seen = set()
    clean = []
    for entry in parsed:
        if entry is None:
            continue
        key = (entry["gericht"].lower(), entry["preis"])
        if key in seen:
            continue
        seen.add(key)
        clean.append(entry)

    result["gerichte"] = clean
    result["anzahl_gerichte"] = len(clean)
    if not clean:
        result["fehler"] = "keine_gerichte_gefunden"
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None, help="nur N Restaurants verarbeiten")
    parser.add_argument("--resume", action="store_true", help="bereits verarbeitete überspringen")
    parser.add_argument("--retry-failed", action="store_true",
                       help="Nur Restaurants mit keine_gerichte_gefunden / kein_text_extrahierbar / homepage_nicht_erreichbar erneut versuchen")
    parser.add_argument("--force-ollama", action="store_true", help="Ollama erzwingen, ignoriert OpenAI-Key")
    args = parser.parse_args()

    # LLM-Backend wählen
    global _OPENAI_KEY
    if not args.force_ollama:
        _OPENAI_KEY = get_openai_key()
    if _OPENAI_KEY:
        print(f"[LLM] Backend: OpenAI {OPENAI_MODEL}")
    else:
        print(f"[LLM] Backend: Ollama {OLLAMA_MODEL} (lokal)")

    if not RESTAURANTS_JSON.exists():
        sys.exit(f"FEHLER: {RESTAURANTS_JSON} nicht gefunden — erst scrape_potsdam.py laufen lassen.")

    data = json.loads(RESTAURANTS_JSON.read_text(encoding="utf-8"))
    candidates = [r for r in data["restaurants"] if r.get("website")]
    print(f"[Init] {len(candidates)} Restaurants mit Website")

    # Bereits verarbeitete Restaurants laden
    existing: dict[str, dict] = {}
    if SPEISEKARTEN_JSON.exists():
        try:
            existing_data = json.loads(SPEISEKARTEN_JSON.read_text(encoding="utf-8"))
            for r in existing_data.get("restaurants", []):
                existing[r["name"]] = r
        except Exception:
            pass

    if args.retry_failed:
        retry_errors = {
            "keine_gerichte_gefunden",
            "kein_text_extrahierbar",
            "homepage_nicht_erreichbar",
        }
        retry_names = {
            name for name, r in existing.items()
            if r.get("anzahl_gerichte", 0) == 0 and r.get("fehler") in retry_errors
        }
        candidates = [r for r in candidates if r["name"] in retry_names]
        print(f"[Retry] {len(candidates)} fehlgeschlagene Restaurants werden erneut versucht")
    elif args.resume:
        remaining = [r for r in candidates if r["name"] not in existing]
        print(f"[Resume] {len(remaining)} noch zu verarbeiten ({len(existing)} schon fertig)")
        candidates = remaining

    if args.limit:
        candidates = candidates[: args.limit]
        print(f"[Limit] auf {len(candidates)} begrenzt")

    results = list(existing.values())
    success = 0
    t0 = time.time()

    for i, r in enumerate(candidates, 1):
        print(f"  [{i}/{len(candidates)}] {r['name'][:50]:<50}", end=" ", flush=True)
        try:
            res = process_restaurant(r)
        except KeyboardInterrupt:
            print("\n[Abbruch] Speichere Zwischenstand ...")
            break
        except Exception as e:
            import traceback
            err_msg = f"{type(e).__name__}: {str(e)[:80]}"
            print(f"\n    [Trace] {err_msg}")
            traceback.print_exc()
            res = {
                "name": r["name"],
                "website": r["website"],
                "fehler": err_msg,
                "gerichte": [],
                "anzahl_gerichte": 0,
            }

        if res.get("anzahl_gerichte", 0) > 0:
            print(f"OK  {res['anzahl_gerichte']} Gerichte")
            success += 1
        else:
            print(f"--  {res.get('fehler', 'leer')}")

        existing[r["name"]] = res
        # Periodisch speichern damit nichts verloren geht
        if i % 10 == 0:
            _save(existing)

    _save(existing)
    dur = int(time.time() - t0)
    total = len(existing)
    with_menu = sum(1 for r in existing.values() if r.get("anzahl_gerichte", 0) > 0)
    total_dishes = sum(r.get("anzahl_gerichte", 0) for r in existing.values())
    print()
    print("=" * 60)
    print(f"  Verarbeitete Restaurants:  {total}")
    print(f"  Mit Speisekarte:           {with_menu} ({100*with_menu/max(total,1):.1f} %)")
    print(f"  Gesamt-Gerichte:           {total_dishes}")
    print(f"  Dauer:                     {dur//60} min {dur%60} s")
    print("=" * 60)
    return 0


def _save(existing: dict[str, dict]) -> None:
    payload = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "model": OLLAMA_MODEL,
        "anzahl_restaurants": len(existing),
        "restaurants": list(existing.values()),
    }
    SPEISEKARTEN_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    sys.exit(main())
