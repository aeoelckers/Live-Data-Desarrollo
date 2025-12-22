import json
import os
import re
import html
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
    s = (s or "").strip()
    if not s:
        return ""

    # 1) Decodificar entidades HTML (&amp; etc)
    s = html.unescape(s)

    # 2) A veces vienen strings mal-decoded (Ã±). Normalizamos en lo posible:
    #    - si el texto parece mojibake típico, intentamos repararlo
    #    Nota: no siempre aplica, pero ayuda en muchos feeds.
    if "Ã" in s or "Â" in s:
        try:
            s = s.encode("latin1", errors="ignore").decode("utf-8", errors="ignore")
        except Exception:
            pass

    # 3) Normalizar espacios
    s = re.sub(r"\s+", " ", s).strip()
    return s

def strip_html(html_str: str) -> str:
    if not html_str:
        return ""
    html_str = html.unescape(html_str)
    soup = BeautifulSoup(html_str, "lxml")
    txt = soup.get_text(" ", strip=True)
    return clean_text(txt)

def safe_portal_url(u: str) -> bool:
    try:
        p = urlparse(u)
        return p.netloc.endswith("portalportuario.cl")
    except Exception:
        return False

def looks_like_not_an_article(title: str, link: str) -> bool:
    """
    Filtra cosas tipo 'Titulares - PortalPortuario' / páginas utilitarias.
    Ajusta aquí si aparecen más.
    """
    t = (title or "").lower().strip()
    l = (link or "").lower().strip()

    # títulos muy genéricos
    bad_title_patterns = [
        "titulares - portalportuario",
        "titulares – portalportuario",
        "titulares portalportuario",
        "estado de puertos - portalportuario",
        "estado de puertos – portalportuario",
        "informe de lectoría - portalportuario",
        "informe de lectoria - portalportuario",
    ]
    if any(p in t for p in bad_title_patterns):
        return True
