import os
import re
import time
import json
import hashlib
from datetime import datetime, timezone
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup
import trafilatura


ALLOWED_DOMAINS = {
    "partner.booking.com",
    "partnerhub.agoda.com",
    "agodahomeshelp.zendesk.com",
    "www.airbnb.com",
    "airbnb.com",
    "agodahomeshelp.zendesk.com",
    "agodapropertypartnerhelp.zendesk.com"
}

OUT_DIR = "docs_dump"
SLEEP_SECONDS = 1.5  # be polite; increase if you get rate-limited


def is_allowed(url: str) -> bool:
    try:
        host = urlparse(url).hostname or ""
        host = host.lower()
        return any(host == d or host.endswith("." + d) for d in ALLOWED_DOMAINS)
    except Exception:
        return False


def safe_name(url: str) -> str:
    # stable filename from URL hash
    h = hashlib.sha256(url.encode("utf-8")).hexdigest()[:16]
    return h


def get_title_from_html(html: str) -> str:
    soup = BeautifulSoup(html, "lxml")
    t = soup.title.get_text(strip=True) if soup.title else ""
    return t[:200]


def ensure_dirs(platform: str):
    os.makedirs(os.path.join(OUT_DIR, platform, "html"), exist_ok=True)
    os.makedirs(os.path.join(OUT_DIR, platform, "md"), exist_ok=True)


def platform_from_url(url: str) -> str:
    host = (urlparse(url).hostname or "").lower()
    if "booking" in host:
        return "booking"
    if "agoda" in host or "zendesk.com" in host:
        return "agoda"
    if "airbnb" in host:
        return "airbnb"
    return "other"


def main():
    if not os.path.exists("urls.txt"):
        raise SystemExit("Create urls.txt first (one URL per line).")

    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0",
        "Accept-Language": "en-US,en;q=0.9",
    })

    meta_path = os.path.join(OUT_DIR, "meta.jsonl")
    os.makedirs(OUT_DIR, exist_ok=True)

    with open("urls.txt", "r", encoding="utf-8") as f:
        urls = [line.strip() for line in f if line.strip() and not line.strip().startswith("#")]

    for url in urls:
        if not is_allowed(url):
            print(f"SKIP (domain not allowed): {url}")
            continue

        platform = platform_from_url(url)
        ensure_dirs(platform)

        try:
            resp = session.get(url, timeout=25)
            status = resp.status_code
            resp.raise_for_status()

            html = resp.text
            title = get_title_from_html(html)

            doc_id = safe_name(url)
            html_file = os.path.join(OUT_DIR, platform, "html", f"{doc_id}.html")
            md_file = os.path.join(OUT_DIR, platform, "md", f"{doc_id}.md")

            with open(html_file, "w", encoding="utf-8") as hf:
                hf.write(html)

            # Extract main content to Markdown (best-effort)
            md = trafilatura.extract(html, output_format="markdown") or ""
            if not md.strip():
                # fallback: plain text
                text = trafilatura.extract(html) or ""
                md = text

            with open(md_file, "w", encoding="utf-8") as mf:
                mf.write(md)

            meta = {
                "id": doc_id,
                "url": url,
                "platform": platform,
                "title": title,
                "status": status,
                "fetchedAt": datetime.now(timezone.utc).isoformat(),
                "htmlPath": html_file.replace("\\", "/"),
                "mdPath": md_file.replace("\\", "/"),
            }
            with open(meta_path, "a", encoding="utf-8") as m:
                m.write(json.dumps(meta, ensure_ascii=False) + "\n")

            print(f"OK [{platform}] {status}: {title}")

        except Exception as e:
            print(f"ERR: {url} -> {e}")

        time.sleep(SLEEP_SECONDS)


if __name__ == "__main__":
    main()