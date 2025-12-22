import json
import os
import re
from datetime import datetime, timezone
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup
from dateutil import parser as dateparser

FEED_URL = "https://portalportuario.cl/feed/"
OUT = "data/news.json"
MAX_ITEMS = 12

UA = "Mozilla/5.0 (compatible; LiveDataDashboard/1.0)"

def save(payload):
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

def load_existing():
    if os.path.exists(OUT):
        try:
            with open(OUT, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return None
    return None

def clean_text(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "")).strip()

def strip_html(html: str) -> str:
    if not html:
        return ""
    soup = BeautifulSoup(html, "lxml")
    return clean_text(soup.get_text(" ", strip=True))

def safe_portal_url(u: str) -> bool:
    try:
        p = urlparse(u)
        return p.netloc.endswith("portalportuario.cl")
    except Exception:
        return False

def main():
    existing = load_existing()
    now_iso = datetime.now(timezone.utc).isoformat()

    try:
        r = requests.get(FEED_URL, timeout=25, headers={"User-Agent": UA})
        r.raise_for_status()

        soup = BeautifulSoup(r.text, "xml")
        entries = soup.find_all("item")

        items = []
        for it in entries[:MAX_ITEMS]:
            title = clean_text(it.title.get_text()) if it.title else None
            link = clean_text(it.link.get_text()) if it.link else None
            pub = clean_text(it.pubDate.get_text()) if it.pubDate else None
            desc = it.description.get_text() if it.description else ""
            summary = strip_html(desc)

            if not title or not link:
                continue
            if not safe_portal_url(link):
                continue

            pub_iso = None
            if pub:
                try:
                    pub_iso = dateparser.parse(pub).astimezone(timezone.utc).isoformat()
                except Exception:
                    pub_iso = None

            # “resumen TV”
            if summary and len(summary) > 220:
                summary = summary[:217] + "..."

            items.append({
                "title": title,
                "link": link,
                "pubDate": pub_iso or now_iso,
                "summary": summary or (title[:160] + ("..." if len(title) > 160 else "")),
                "image": None
            })

        if len(items) < 3:
            raise RuntimeError("RSS devolvió pocos items (inesperado).")

        payload = {
            "source": FEED_URL,
            "lastUpdated": now_iso,
            "items": items
        }
        save(payload)
        print(f"OK RSS: {len(items)} items -> {OUT}")

    except Exception as e:
        # No fallar: mantener lo último bueno
        if existing:
            existing["checkedAt"] = now_iso
            existing["note"] = f"RSS fetch failed; kept last good data. Error: {e}"
            save(existing)
            print(f"WARN: RSS falló, mantuve {OUT}. Error: {e}")
        else:
            payload = {
                "source": FEED_URL,
                "lastUpdated": None,
                "checkedAt": now_iso,
                "items": [],
                "note": f"RSS fetch failed and no previous file. Error: {e}"
            }
            save(payload)
            print(f"WARN: no había {OUT}; se creó vacío. Error: {e}")

if __name__ == "__main__":
    main()
