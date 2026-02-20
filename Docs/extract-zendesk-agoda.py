import os
import re
import json
import time
import hashlib
from datetime import datetime, timezone

import requests
import trafilatura
from bs4 import BeautifulSoup


OUT_DIR = "docs_dump"
SLEEP_SECONDS = 0.8  # be polite

SITES = [
    ("agoda_homes", "https://agodahomeshelp.zendesk.com"),
    ("agoda_property", "https://agodapropertypartnerhelp.zendesk.com"),
]


def slugify(s: str) -> str:
    s = s.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s[:80] if s else "article"


def html_to_markdown(html_fragment: str) -> str:
    html = f"<html><body>{html_fragment}</body></html>"
    md = trafilatura.extract(html, output_format="markdown") or ""
    if md.strip():
        return md

    # fallback to plain text
    soup = BeautifulSoup(html, "lxml")
    return soup.get_text("\n", strip=True)


def ensure_dirs(site_key: str):
    os.makedirs(os.path.join(OUT_DIR, site_key, "md"), exist_ok=True)


def fetch_all_articles(base_url: str, session: requests.Session):
    url = f"{base_url}/api/v2/help_center/articles.json?per_page=100"
    while url:
        r = session.get(url, timeout=25)
        r.raise_for_status()
        data = r.json()

        for a in data.get("articles", []):
            yield a

        url = data.get("next_page")
        time.sleep(SLEEP_SECONDS)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    meta_path = os.path.join(OUT_DIR, "meta.jsonl")

    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, identity",
    })

    for site_key, base in SITES:
        ensure_dirs(site_key)
        count = 0

        for a in fetch_all_articles(base, session):
            # Skip drafts if present
            if a.get("draft") is True:
                continue

            article_id = str(a.get("id"))
            title = (a.get("title") or "").strip()
            html_url = (a.get("html_url") or "").strip()
            body = a.get("body") or ""
            updated_at = a.get("updated_at") or ""

            md = html_to_markdown(body)

            file_slug = slugify(title)
            filename = f"{article_id}-{file_slug}.md"
            md_path = os.path.join(OUT_DIR, site_key, "md", filename)

            with open(md_path, "w", encoding="utf-8") as f:
                f.write(f"# {title}\n\n")
                if html_url:
                    f.write(f"Source: {html_url}\n\n")
                if updated_at:
                    f.write(f"Updated: {updated_at}\n\n")
                f.write(md.strip() + "\n")

            meta = {
                "platform": "agoda",
                "site": site_key,
                "id": article_id,
                "title": title,
                "url": html_url,
                "updated_at": updated_at,
                "mdPath": md_path.replace("\\", "/"),
                "fetchedAt": datetime.now(timezone.utc).isoformat(),
            }
            with open(meta_path, "a", encoding="utf-8") as m:
                m.write(json.dumps(meta, ensure_ascii=False) + "\n")

            count += 1

        print(f"OK [{site_key}] downloaded {count} articles")

    print("Done.")


if __name__ == "__main__":
    main()