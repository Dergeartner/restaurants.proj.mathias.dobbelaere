"""
Impressum-Extraktion: Decision-Maker pro Restaurant
====================================================
Lädt für jedes Restaurant mit Website die Impressum-Seite (TMG-Pflicht-Veröffentlichung)
und extrahiert per GPT-4o-mini strukturierte Daten:
- Inhaber-Name / Geschäftsführer
- Geschäftsform (Einzelunternehmen, GmbH, GbR, ...)
- Adresse, Telefon, E-Mail
- Handelsregister, USt-IdNr.

Diese Daten sind für Sales/Strategic-Accounts deutlich wertvoller als die Speisekarte:
direkter Decision-Maker-Kontakt für Akquise-Calls.

Output: output/impressum.json

Aufruf:
    python enrich_impressum.py --limit 10        # Test
    python enrich_impressum.py                   # alle
    python enrich_impressum.py --resume          # nur die noch nicht verarbeiteten
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

OUTPUT_DIR = Path(__file__).parent / "output"
RESTAURANTS_JSON = OUTPUT_DIR / "restaurants.json"
IMPRESSUM_JSON = OUTPUT_DIR / "impressum.json"
CREDENTIALS_FILE = Path(__file__).parent / "credentials.json"

OPENAI_URL = "https://api.openai.com/v1/chat/completions"
OPENAI_MODEL = "gpt-4o-mini"

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)
HTTP_TIMEOUT = 12
MAX_HTML_CHARS = 12_000

# Typische Impressum-URL-Pfade
IMPRESSUM_KEYWORDS = [
    "impressum", "imprint", "impressum-und-datenschutz",
    "rechtliches", "anbieterkennzeichnung",
]


def get_openai_key() -> str:
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


def fetch_html(url: str) -> str:
    """Lädt HTML mit Schema-Retry."""
    if not url:
        return ""
    if not url.startswith(("http://", "https://")):
        url = f"https://{url}"
    for try_url in [url] + ([url.replace("https://", "http://", 1)] if url.startswith("https") else []):
        try:
            r = requests.get(
                try_url,
                headers={"User-Agent": USER_AGENT, "Accept-Language": "de-DE,de;q=0.9"},
                timeout=HTTP_TIMEOUT,
                allow_redirects=True,
            )
            if r.status_code == 200 and r.text:
                return r.text
        except Exception:
            continue
    return ""


def find_impressum_url(homepage_html: str, base_url: str) -> str | None:
    """Sucht den Impressum-Link auf der Homepage."""
    if not homepage_html:
        return None
    try:
        soup = BeautifulSoup(homepage_html, "html.parser")
    except Exception:
        return None
    base_host = urlparse(base_url).netloc

    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        text = (a.get_text() or "").lower().strip()
        href_lower = href.lower()
        combined = f"{href_lower} {text}"
        if not any(kw in combined for kw in IMPRESSUM_KEYWORDS):
            continue
        absolute = urljoin(base_url, href)
        if not absolute.startswith("http"):
            continue
        if urlparse(absolute).netloc != base_host:
            continue
        return absolute.split("#")[0]

    # Fallback: probiere /impressum direkt
    try:
        candidate = urljoin(base_url, "/impressum")
        return candidate
    except Exception:
        return None


def extract_text(html: str) -> str:
    if not html:
        return ""
    try:
        soup = BeautifulSoup(html, "html.parser")
    except Exception:
        return html[:MAX_HTML_CHARS]
    for tag in soup(["script", "style", "noscript", "header", "nav"]):
        tag.decompose()
    target = soup.find("main") or soup.find("article") or soup.find("body") or soup
    text = target.get_text(separator="\n", strip=True)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text[:MAX_HTML_CHARS]


PROMPT = """Du bist ein Daten-Extraktor für deutsche Impressum-Seiten (TMG-Pflicht).
Extrahiere strukturiert:

- inhaber_name: Name der natürlichen oder juristischen Person (z.B. "Max Mustermann" oder "Mustermann GmbH")
- geschaeftsform: "Einzelunternehmen" / "GbR" / "GmbH" / "UG" / "OHG" / "KG" / "GmbH & Co. KG" / "AG" / "Verein" / "Sonstige"
- geschaeftsfuehrer: bei juristischer Person Name(n) der Geschäftsführer (sonst null)
- adresse: vollständige Adresse (Straße + Hausnummer + PLZ + Ort)
- telefon: Telefonnummer (international format wenn möglich, z.B. "+49 331 200 60 66")
- email: E-Mail-Adresse
- handelsregister: Handelsregister-Nummer (z.B. "HRB 12345 Amtsgericht Potsdam") oder null
- ust_id: USt-Identifikationsnummer (DE...) oder null
- verantwortlich_inhaltlich: Name der inhaltlich verantwortlichen Person nach §55 RStV/MStV

REGELN:
- Wenn Information NICHT im Text vorkommt: setze null (NICHT erfinden!)
- Bei Inhaber: nur die Person/Firma, NICHT die Anschrift
- email/telefon: bereinige Whitespace, halte aber Symbole (+, -, /)
- Antworte AUSSCHLIESSLICH mit einem JSON-Objekt, ohne Markdown-Codeblock

FORMAT:
{"inhaber_name": "...", "geschaeftsform": "...", "geschaeftsfuehrer": null, "adresse": "...", "telefon": "...", "email": "...", "handelsregister": null, "ust_id": null, "verantwortlich_inhaltlich": null}

WENN KEIN IMPRESSUM-INHALT erkennbar ist: alle Felder null setzen.

TEXT:
---
{text}
---

JSON:"""


def query_openai(text: str, api_key: str, timeout: int = 60) -> dict | None:
    if not text.strip():
        return None
    prompt = PROMPT.replace("{text}", text)
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
                "temperature": 0.0,
                "max_tokens": 800,
                "response_format": {"type": "json_object"},
            },
            timeout=timeout,
        )
        if r.status_code != 200:
            print(f"    [OpenAI] HTTP {r.status_code}: {r.text[:120]}")
            return None
        raw = r.json()["choices"][0]["message"]["content"].strip()
        return json.loads(raw)
    except Exception as e:
        print(f"    [OpenAI] {type(e).__name__}: {str(e)[:80]}")
        return None


def normalize_fields(data: dict) -> dict:
    """Säubert + valdiert die extrahierten Felder."""
    def clean(s):
        if s is None:
            return None
        s = str(s).strip()
        if not s or s.lower() in {"null", "none", "n/a", "-", "—"}:
            return None
        return s

    def clean_phone(s):
        s = clean(s)
        if not s:
            return None
        # Bereinige aber behalte Plus + Klammern
        s = re.sub(r"[‐-―−]", "-", s)
        return re.sub(r"\s+", " ", s).strip()

    def clean_email(s):
        s = clean(s)
        if not s or "@" not in s:
            return None
        return s.lower()

    return {
        "inhaber_name": clean(data.get("inhaber_name")),
        "geschaeftsform": clean(data.get("geschaeftsform")),
        "geschaeftsfuehrer": clean(data.get("geschaeftsfuehrer")),
        "adresse": clean(data.get("adresse")),
        "telefon": clean_phone(data.get("telefon")),
        "email": clean_email(data.get("email")),
        "handelsregister": clean(data.get("handelsregister")),
        "ust_id": clean(data.get("ust_id")),
        "verantwortlich_inhaltlich": clean(data.get("verantwortlich_inhaltlich")),
    }


def process_restaurant(r: dict, api_key: str) -> dict:
    name = r["name"]
    website = r["website"]
    result = {
        "name": name,
        "website": website,
        "impressum_url": None,
        "inhaber_name": None,
        "geschaeftsform": None,
        "geschaeftsfuehrer": None,
        "adresse": None,
        "telefon": None,
        "email": None,
        "handelsregister": None,
        "ust_id": None,
        "verantwortlich_inhaltlich": None,
        "fehler": None,
    }

    homepage = fetch_html(website)
    if not homepage:
        result["fehler"] = "homepage_nicht_erreichbar"
        return result

    impressum_url = find_impressum_url(homepage, website)
    if not impressum_url:
        result["fehler"] = "impressum_link_nicht_gefunden"
        return result

    result["impressum_url"] = impressum_url
    impressum_html = fetch_html(impressum_url)
    if not impressum_html:
        result["fehler"] = "impressum_seite_nicht_erreichbar"
        return result

    text = extract_text(impressum_html)
    if not text:
        result["fehler"] = "kein_text_extrahierbar"
        return result

    parsed = query_openai(text, api_key)
    if parsed is None:
        result["fehler"] = "llm_fehler"
        return result

    cleaned = normalize_fields(parsed)
    result.update(cleaned)
    if not any(cleaned.values()):
        result["fehler"] = "keine_daten_erkennbar"
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--resume", action="store_true")
    args = parser.parse_args()

    api_key = get_openai_key()
    if not api_key:
        sys.exit("FEHLER: OPENAI_API_KEY fehlt — credentials.json oder ENV setzen.")

    if not RESTAURANTS_JSON.exists():
        sys.exit(f"FEHLER: {RESTAURANTS_JSON} nicht gefunden.")
    data = json.loads(RESTAURANTS_JSON.read_text(encoding="utf-8"))
    candidates = [r for r in data["restaurants"] if r.get("website")]
    print(f"[Init] {len(candidates)} Restaurants mit Website")

    existing: dict[str, dict] = {}
    if IMPRESSUM_JSON.exists():
        try:
            existing_data = json.loads(IMPRESSUM_JSON.read_text(encoding="utf-8"))
            for r in existing_data.get("restaurants", []):
                existing[r["name"]] = r
        except Exception:
            pass

    if args.resume:
        candidates = [r for r in candidates if r["name"] not in existing]
        print(f"[Resume] {len(candidates)} noch zu verarbeiten")
    if args.limit:
        candidates = candidates[: args.limit]
        print(f"[Limit] auf {len(candidates)}")

    t0 = time.time()
    success = 0
    for i, r in enumerate(candidates, 1):
        try:
            res = process_restaurant(r, api_key)
        except KeyboardInterrupt:
            print("\n[Abbruch]")
            break
        except Exception as e:
            res = {"name": r["name"], "website": r["website"], "fehler": str(e)[:80]}

        ok = bool(res.get("inhaber_name"))
        if ok:
            success += 1
        name_safe = r["name"].encode("ascii", errors="replace").decode()[:40]
        flag = "OK " if ok else "-- "
        info = (res.get("inhaber_name") or res.get("fehler") or "?")[:50]
        info_safe = info.encode("ascii", errors="replace").decode()
        print(f"  [{i}/{len(candidates)}] {name_safe:<40} {flag} {info_safe}")

        existing[r["name"]] = res
        if i % 10 == 0:
            _save(existing)

    _save(existing)
    dur = int(time.time() - t0)
    total = len(existing)
    with_inhaber = sum(1 for r in existing.values() if r.get("inhaber_name"))
    with_email = sum(1 for r in existing.values() if r.get("email"))
    with_phone = sum(1 for r in existing.values() if r.get("telefon"))
    print()
    print("=" * 60)
    print(f"  Verarbeitet:        {total}")
    print(f"  Mit Inhaber-Name:   {with_inhaber} ({100*with_inhaber/max(total,1):.0f}%)")
    print(f"  Mit E-Mail:         {with_email}")
    print(f"  Mit Telefon:        {with_phone}")
    print(f"  Dauer:              {dur//60} min {dur%60} s")
    print("=" * 60)


def _save(existing: dict[str, dict]):
    payload = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "model": OPENAI_MODEL,
        "anzahl_restaurants": len(existing),
        "restaurants": list(existing.values()),
    }
    IMPRESSUM_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
