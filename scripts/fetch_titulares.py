import json
import os
import re
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from dateutil import parser as dateparser

LIST_URL = "https://portalportuario.cl/titulares/"
OUT = "data/news.json"

MAX_ITEMS = 10         # cuántos titulares guardar en JSON
DETAIL_FETCH = 6       # cuántos titulares visitar para sacar resumen/fecha real (para no ser pesado)

UA = "Mozilla/5.0 (compatible; LiveDataDashboard/1.0; +https://github.com/aeoelckers/Live-Data-Desarrollo)"

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

def is_valid_article_url(url: str) -> bool:
    """Filtra URLs que parezcan notas (no tags/category/etc)."""
    try:
        p = urlparse(url)
        if not p.netloc.endswith("portalportuario.cl"):
            return False
        path = p.path or ""
        if path in ("/", ""):
            return False
        # excluir secciones típicas
        bad = ("/tag/", "/category/", "/wp-", "/author/", "/page/")
        if any(b in path for b in bad):
            return False
        # excluir anchors o cosas raras
        if url.endswith("#"):
            return False
        return True
    except Exception:
        return False

def pick_meta(soup: BeautifulSoup, key: str, attr: str = "property"):
    tag = soup.find("meta", attrs={attr: key})
    if tag and tag.get("content"):
        return clean_text(tag.get("content"))
    return None

def extract_pubdate_from_article(soup: BeautifulSoup):
    # 1) article:published_time (OG)
    for attr, key in [("property", "article:published_time"), ("name", "article:published_time")]:
        v = pick_meta(soup, key, attr=attr)
        if v:
            try:
                return dateparser.parse(v).astimezone(timezone.utc).isoformat()
            except Exception:
                pass

    # 2) meta name=date / datePublished
    for name_key in ["date", "datePublished", "pubdate", "publish-date"]:
        v = pick_meta(soup, name_key, attr="name")
        if v:
            try:
                return dateparser.parse(v).astimezone(timezone.utc).isoformat()
            except Exception:
                pass

    # 3) <time datetime="...">
    t = soup.find("time")
    if t and t.get("datetime"):
        try:
            return dateparser.parse(t["datetime"]).astimezone(timezone.utc).isoformat()
        except Exception:
            pass

    return None

def extract_summary_from_article(soup: BeautifulSoup):
    # 1) meta description
    desc = pick_meta(soup, "description", attr="name")
    if desc and len(desc) >= 40:
        return desc

    # 2) og:description
    ogd = pick_meta(soup, "og:description", attr="property")
    if ogd and len(ogd) >= 40:
        return ogd

    # 3) primer párrafo razonable del contenido
    # intentos típicos
    candidates = soup.select("article p, .entry-content p, .post-content p, .td-post-content p")
    for p in candidates:
        txt = clean_text(p.get_text(" ", strip=True))
        if 60 <= len(txt) <= 240:
            return txt
    # fallback: cualquier p
    for p in soup.find_all("p"):
        txt = clean_text(p.get_text(" ", strip=True))
        if 60 <= len(txt) <= 240:
            return txt

    return None

def extract_title_from_article(soup: BeautifulSoup):
    # og:title
    ogt = pick_meta(soup, "og:title", attr="property")
    if ogt and len(ogt) > 10:
        return ogt
    # <title>
    if soup.title and soup.title.string:
        return clean_text(soup.title.string)
    # h1
    h1 = soup.find("h1")
    if h1:
        return clean_text(h1.get_text(" ", strip=True))
    return None

def extract_image_from_article(soup: BeautifulSoup):
    img = pick_meta(soup, "og:image", attr="property")
    if img and img.startswith("http"):
        return img
    return None

def fetch_detail(url: str):
    r = requests.get(url, timeout=25, headers={"User-Agent": UA})
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "lxml")

    title = extract_title_from_article(soup)
    pub = extract_pubdate_from_article(soup)
    summary = extract_summary_from_article(soup)
    image = extract_image_from_article(soup)

    return {
        "title": title,
        "pubDate": pub,
        "summary": summary,
        "image": image,
    }

def main():
    existing = load_existing()
    now_iso = datetime.now(timezone.utc).isoformat()

    try:
        r = requests.get(LIST_URL, timeout=25, headers={"User-Agent": UA})
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "lxml")

        # 1) extraer links de titulares desde la página /titulares/
        links = []
        for a in soup.select("a[href]"):
            href = a.get("href", "")
            if not href:
                continue
            abs_url = urljoin(LIST_URL, href)  # <-- CLAVE: soporta links relativos
            if not is_valid_article_url(abs_url):
                continue

            text = clean_text(a.get_text(" ", strip=True))
            if len(text) < 15:
                continue

            links.append((abs_url, text))

        # dedupe por URL manteniendo orden
        seen = set()
        uniq = []
        for url, text in links:
            if url in seen:
                continue
            seen.add(url)
            uniq.append({"link": url, "title_hint": text})
            if len(uniq) >= MAX_ITEMS:
                break

        if len(uniq) < 3:
            raise RuntimeError("No se encontraron suficientes links en /titulares/. (HTML cambió o bloqueo)")

        # 2) Enriquecer los primeros DETAIL_FETCH con fecha/resumen/imagen reales
        items = []
        for i, it in enumerate(uniq):
            url = it["link"]
            title_hint = it.get("title_hint")

            item = {
                "title": title_hint,
                "link": url,
                "pubDate": None,
                "summary": None,
                "image": None,
            }

            if i < DETAIL_FETCH:
                try:
                    detail = fetch_detail(url)
                    if detail.get("title"):
                        item["title"] = detail["title"]
                    if detail.get("pubDate"):
                        item["pubDate"] = detail["pubDate"]
                    if detail.get("summary"):
                        item["summary"] = detail["summary"]
                    if detail.get("image"):
                        item["image"] = detail["image"]
                except Exception:
                    # si falla el detalle, igual dejamos el titular
                    pass

            # fallback por si no hay nada
            if not item["summary"]:
                item["summary"] = item["title"][:140] + ("..." if len(item["title"]) > 140 else "")

            # si no hay pubDate, le ponemos now (para no romper orden/fecha en UI)
            if not item["pubDate"]:
                item["pubDate"] = now_iso

            items.append(item)

        payload = {
            "source": LIST_URL,
            "lastUpdated": now_iso,
            "items": items
        }
        save(payload)
        print(f"OK: guardados {len(items)} titulares enriquecidos en {OUT}")

    except Exception as e:
        # NO FALLAR: mantener el último archivo
        if existing:
            existing["checkedAt"] = now_iso
            existing["note"] = f"Fetch failed; kept last good data. Error: {e}"
            save(existing)
            print(f"WARN: fallo fetch, se mantuvo {OUT}. Error: {e}")
        else:
            payload = {
                "source": LIST_URL,
                "lastUpdated": None,
                "checkedAt": now_iso,
                "items": [],
                "note": f"Fetch failed and no previous file. Error: {e}"
            }
            save(payload)
            print(f"WARN: no había {OUT}; se creó vacío. Error: {e}")

if __name__ == "__main__":
    main()
