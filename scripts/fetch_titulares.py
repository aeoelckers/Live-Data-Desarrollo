import json
import os
import re
from datetime import datetime, timezone
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from dateutil import parser as dateparser

HOME = "https://portalportuario.cl/"
TITULARES = "https://portalportuario.cl/titulares/"
OUT = "data/news.json"

UA = "Mozilla/5.0 (compatible; DesarrolloInforma/1.0; +https://github.com/aeoelckers/Live-Data-Desarrollo)"

def now_utc_iso():
    return datetime.now(timezone.utc).isoformat()

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
    s = (s or "").replace("\xa0", " ")
    s = re.sub(r"\s+", " ", s).strip()
    return s

def get(url: str, timeout=25) -> requests.Response:
    r = requests.get(url, timeout=timeout, headers={"User-Agent": UA})
    # FIX encoding típico (ChaÃ±aral)
    # requests a veces no detecta bien -> usamos apparent_encoding
    if not r.encoding or r.encoding.lower() == "iso-8859-1":
        r.encoding = r.apparent_encoding or "utf-8"
    r.raise_for_status()
    return r

def extract_meta_date(soup: BeautifulSoup):
    """
    Intenta sacar fecha desde:
    - meta property="article:published_time"
    - time datetime
    - texto con fecha en el artículo
    """
    meta = soup.select_one('meta[property="article:published_time"]')
    if meta and meta.get("content"):
        try:
            return dateparser.parse(meta["content"]).astimezone(timezone.utc).isoformat()
        except Exception:
            pass

    t = soup.select_one("time[datetime]")
    if t and t.get("datetime"):
        try:
            return dateparser.parse(t["datetime"]).astimezone(timezone.utc).isoformat()
        except Exception:
            pass

    # fallback: buscar algo tipo "22 diciembre 2025" o "22 dic 2025" en el texto visible
    text = clean_text(soup.get_text(" ", strip=True))
    m = re.search(r"(\d{1,2}\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+\d{4})", text, re.IGNORECASE)
    if m:
        try:
            return dateparser.parse(m.group(1), languages=["es"]).astimezone(timezone.utc).isoformat()
        except Exception:
            pass

    return None

def extract_og_image(soup: BeautifulSoup):
    meta = soup.select_one('meta[property="og:image"]')
    if meta and meta.get("content"):
        return meta["content"].strip()
    return None

def extract_summary(soup: BeautifulSoup):
    """
    Resumen: intenta con meta description, excerpt, o primer párrafo del contenido.
    """
    meta = soup.select_one('meta[name="description"]')
    if meta and meta.get("content"):
        desc = clean_text(meta["content"])
        if len(desc) >= 40:
            return desc

    # excerpt típico wordpress
    excerpt = soup.select_one(".entry-summary, .td-post-content .td-excerpt, .post-excerpt")
    if excerpt:
        t = clean_text(excerpt.get_text(" ", strip=True))
        if len(t) >= 40:
            return t

    # primer párrafo dentro del artículo
    for p in soup.select("article p"):
        t = clean_text(p.get_text(" ", strip=True))
        if len(t) >= 60:
            return t[:220] + ("…" if len(t) > 220 else "")

    # fallback
    return ""

def is_valid_article_url(u: str) -> bool:
    if not u:
        return False
    if not u.startswith("http"):
        return False
    if "portalportuario.cl" not in u:
        return False

    # filtros: no categorías, tags, feeds, login, etc.
    bad = ["/tag/", "/category/", "/wp-json/", "/feed/", "/page/", "#", "/contacto", "/suscribete"]
    if any(x in u for x in bad):
        return False

    # artículos suelen ser /YYYY/MM/.../ o /algo/
    # aceptamos casi todo menos “secciones” obvias:
    bad_sections = [
        "/industria-portuaria/", "/navegacion/", "/cruceros/", "/comercio-exterior/",
        "/aduanas/", "/puerto-sustentable/", "/logistica/", "/entrevistas/", "/opinion/"
    ]
    if any(x in u for x in bad_sections):
        return False

    return True

def scrape_from_home():
    """
    Busca el bloque 'NOTICIAS RECIENTES' en el HOME.
    """
    r = get(HOME)
    soup = BeautifulSoup(r.text, "lxml")

    # Heurística: buscar un contenedor cercano a un header con "NOTICIAS RECIENTES"
    # y tomar links de artículos dentro de esa zona.
    candidates = []

    # 1) buscar encabezado con ese texto
    headers = soup.find_all(string=re.compile(r"NOTICIAS\s+RECIENTES", re.IGNORECASE))
    for h in headers:
        parent = h.parent
        # subir algunos niveles para capturar el bloque
        block = parent
        for _ in range(4):
            if block and block.parent:
                block = block.parent
        if not block:
            continue

        for a in block.select("a[href]"):
            href = a.get("href")
            url = urljoin(HOME, href)
            title = clean_text(a.get_text(" ", strip=True))
            if is_valid_article_url(url) and len(title) >= 25:
                candidates.append((url, title))

    # dedupe manteniendo orden
    seen = set()
    out = []
    for url, title in candidates:
        if url in seen:
            continue
        seen.add(url)
        out.append({"link": url, "title": title})
        if len(out) >= 10:
            break

    return out

def scrape_from_titulares():
    """
    Backup: sacar links desde /titulares/ (listado).
    """
    r = get(TITULARES)
    soup = BeautifulSoup(r.text, "lxml")

    links = []
    for a in soup.select("a[href]"):
        href = a.get("href")
        url = urljoin(TITULARES, href)
        title = clean_text(a.get_text(" ", strip=True))
        if is_valid_article_url(url) and len(title) >= 25:
            links.append((url, title))

    seen = set()
    out = []
    for url, title in links:
        if url in seen:
            continue
        seen.add(url)
        out.append({"link": url, "title": title})
        if len(out) >= 10:
            break
    return out

def enrich_article(item):
    """
    Entra al artículo y agrega pubDate, summary e image.
    """
    url = item["link"]
    r = get(url)
    soup = BeautifulSoup(r.text, "lxml")

    pub = extract_meta_date(soup)
    img = extract_og_image(soup)
    summ = extract_summary(soup)

    return {
        "title": item.get("title", ""),
        "link":
