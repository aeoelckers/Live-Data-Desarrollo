import json
import os
import re
from datetime import datetime, timezone

import requests
from bs4 import BeautifulSoup

URL = "https://portalportuario.cl/titulares/"
OUT = "data/news.json"

def load_existing():
    if os.path.exists(OUT):
        try:
            with open(OUT, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return None
    return None

def save(payload):
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

def clean_text(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "")).strip()

def make_summary(title: str) -> str:
    # Resumen simple “tipo TV” si no hay bajada disponible
    t = clean_text(title)
    if len(t) <= 120:
        return t
    return t[:117] + "..."

def main():
    existing = load_existing()
    now_iso = datetime.now(timezone.utc).isoformat()

    try:
        r = requests.get(
            URL,
            timeout=25,
            headers={"User-Agent": "Mozilla/5.0 (compatible; LiveDataDashboard/1.0)"}
        )
        r.raise_for_status()

        soup = BeautifulSoup(r.text, "lxml")

        # Tomar links a notas del sitio desde /titulares/
        items = []
        for a in soup.select("a"):
            href = a.get("href", "")
            title = clean_text(a.get_text(" ", strip=True))

            if not href or not title:
                continue
            if "portalportuario.cl" not in href:
                continue
            if "/tag/" in href or "/category/" in href:
                continue
            if len(title) < 25:
                continue

            items.append({
                "title": title,
                "link": href,
                # PortalPortuario en /titulares/ no siempre trae fecha fácil.
                # Para no romper el front, le ponemos pubDate = ahora.
                "pubDate": now_iso,
                "summary": make_summary(title),
                # si después quieres imágenes, podemos scrapear la nota individual
                "image": None
            })

        # Dedupe por link
        seen = set()
        uniq = []
        for it in items:
            if it["link"] in seen:
                continue
            seen.add(it["link"])
            uniq.append(it)
            if len(uniq) >= 12:
                break

        if len(uniq) < 3:
            raise RuntimeError("Pocos titulares encontrados (posible cambio HTML / bloqueo).")

        payload = {
            "source": URL,
            "lastUpdated": now_iso,   # <-- clave para tu app.js
            "items": uniq
        }
        save(payload)
        print(f"OK: guardados {len(uniq)} titulares en {OUT}")

    except Exception as e:
        # NO FALLAR: mantener el último news.json válido
        if existing:
            existing["checkedAt"] = now_iso
            existing["note"] = f"Fetch failed; kept last good data. Error: {e}"
            save(existing)
            print(f"WARN: fallo fetch, se mantuvo {OUT}. Error: {e}")
        else:
            payload = {
                "source": URL,
                "lastUpdated": None,
                "checkedAt": now_iso,
                "items": [],
                "note": f"Fetch failed and no previous file. Error: {e}"
            }
            save(payload)
            print(f"WARN: no había {OUT}; se creó vacío. Error: {e}")

if __name__ == "__main__":
    main()
