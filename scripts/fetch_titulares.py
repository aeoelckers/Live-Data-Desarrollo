import json
import os
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

import requests
from bs4 import BeautifulSoup
from dateutil import parser as dateparser

FEED = "https://portalportuario.cl/feed/"
OUT = "data/news.json"

UA = "Mozilla/5.0 (compatible; DesarrolloInforma/1.0; +https://github.com/aeoelckers/Live-Data-Desarrollo)"

MEDIA_NS = "{http://search.yahoo.com/mrss/}"
CONTENT_NS = "{http://purl.org/rss/1.0/modules/content/}"
DC_NS = "{http://purl.org/dc/elements/1.1/}"


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


def clean_text(value: str) -> str:
    value = (value or "").replace("\xa0", " ")
    value = re.sub(r"\s+", " ", value).strip()
    return value


def clean_html(value: str) -> str:
    soup = BeautifulSoup(value or "", "lxml")
    text = clean_text(soup.get_text(" ", strip=True))
    return text


def get(url: str, timeout=25) -> requests.Response:
    response = requests.get(url, timeout=timeout, headers={"User-Agent": UA})
    if not response.encoding or response.encoding.lower() == "iso-8859-1":
        response.encoding = response.apparent_encoding or "utf-8"
    response.raise_for_status()
    return response


def parse_date(value: str):
    if not value:
        return None
    try:
        return dateparser.parse(value).astimezone(timezone.utc).isoformat()
    except Exception:
        return None


def parse_feed_items(xml_text: str):
    root = ET.fromstring(xml_text)
    channel = root.find("channel")
    if channel is None:
        return []

    items = []
    for item in channel.findall("item"):
        title = clean_text(item.findtext("title"))
        link = clean_text(item.findtext("link"))
        pub_raw = item.findtext("pubDate") or item.findtext(f"{DC_NS}date")
        pub_date = parse_date(pub_raw)

        description = item.findtext("description")
        content_encoded = item.findtext(f"{CONTENT_NS}encoded")
        summary = clean_html(content_encoded or description or "")

        image = None
        media_content = item.find(f"{MEDIA_NS}content")
        media_thumb = item.find(f"{MEDIA_NS}thumbnail")
        enclosure = item.find("enclosure")

        for candidate in (media_content, media_thumb, enclosure):
            if candidate is not None and candidate.get("url"):
                image = candidate.get("url")
                break

        if not title or not link:
            continue

        items.append(
            {
                "title": title,
                "link": link,
                "pubDate": pub_date,
                "summary": summary,
                "image": image,
            }
        )

        if len(items) >= 10:
            break

    return items


def fetch_latest_items():
    response = get(FEED)
    return parse_feed_items(response.text)


def main():
    existing = load_existing()
    items = []
    try:
        items = fetch_latest_items()
    except Exception:
        if existing:
            items = existing.get("items", [])

    payload = {
        "source": FEED,
        "lastUpdated": now_utc_iso(),
        "items": items,
    }
    save(payload)


if __name__ == "__main__":
    main()
