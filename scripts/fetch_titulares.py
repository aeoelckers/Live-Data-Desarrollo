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
    s = re.sub(r"\s+", " ", s or "").strip()
    return s

def main():
    existing = load_existing()

    try:
        r = requests.get(URL, timeout=20, headers={
            "User-Agent": "Mozilla/5.0 (compatible; SitransDashboard/1.0)"
        })
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "lxml")

        # Intento genérico: tomar links a artículos dentro del listado de titulares
        # y usar el texto del <a> como título.
        items = []
        for a in soup.select("a"):
            href = a.get("href", "")
            title = clean_text(a.get_text(" ", strip=True))

            if not href or not title:
                continue

            # filtrar cosas típicas (menú, tags, etc.)
            if "portalportuario.cl" not in href:
                continue
            if "/tag/" in href or "/category/" in href:
                continue
            if len(title) < 25:
                continue

            items.append({"title": title, "link": href})

        # dedupe por link manteniendo orden
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
            raise RuntimeError("Pocos titulares encontrados (posible cambio HTML).")

        payload = {
            "source": URL,
            "updatedAt": datetime.now(timezone.utc).isoformat(),
            "items": uniq
        }

        save(payload)
        print(f"OK: guardados {len(uniq)} titulares en {OUT}")

    except Exception as e:
        # NO FALLAR: mantener existente
        if existing:
            existing["checkedAt"] = datetime.now(timezone.utc).isoformat()
            existing["note"] = f"Fetch failed; kept last good data. Error: {e}"
            save(existing)
            print(f"WARN: fallo fetch, se mantuvo {OUT}. Error: {e}")
        else:
            # si no existe nada aún, generar vacío pero válido y NO fallar
            payload = {
                "source": URL,
                "updatedAt": None,
                "checkedAt": datetime.now(timezone.utc).isoformat(),
                "items": [],
                "note": f"Fetch failed and no previous file. Error: {e}"
            }
            save(payload)
            print(f"WARN: no había {OUT}; se creó vacío. Error: {e}")

if __name__ == "__main__":
    main()
