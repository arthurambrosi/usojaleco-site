#!/usr/bin/env python3
"""
Fill event thumbnails automatically from Google Images.

Primary strategy:
- HTTP request to Google Images results page
- Pick first encrypted-tbn0 image URL

Optional fallback:
- Playwright browser scraping if HTTP strategy fails
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

try:
    from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
    from playwright.sync_api import sync_playwright
except Exception:
    sync_playwright = None
    PlaywrightTimeoutError = Exception


GOOGLE_IMAGES_SEARCH_URL = "https://www.google.com/search?tbm=isch&hl=pt-BR&q={query}"

TBN_PLAIN_REGEX = re.compile(
    r"https://encrypted-tbn0\.gstatic\.com/images\?q=tbn:[^\"'<>\s)]+",
    flags=re.IGNORECASE,
)

TBN_ESCAPED_REGEX = re.compile(
    r"https://encrypted-tbn0\.gstatic\.com/images\?q\\u003dtbn:[^\"'<>\s,}\]]+",
    flags=re.IGNORECASE,
)


def parse_args() -> argparse.Namespace:
    default_data = Path(__file__).with_name("data.json")

    parser = argparse.ArgumentParser(
        description="Fill event thumbnails from first Google Images result"
    )
    parser.add_argument(
        "--data",
        type=Path,
        default=default_data,
        help=f"Path to JSON data file (default: {default_data})",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite existing thumbnail values",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Maximum number of events to process (0 = all)",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=0.8,
        help="Delay in seconds between requests",
    )
    parser.add_argument(
        "--timeout-ms",
        type=int,
        default=15000,
        help="Request/page timeout in milliseconds",
    )
    parser.add_argument(
        "--headful",
        action="store_true",
        help="Run browser with UI (fallback only)",
    )
    parser.add_argument(
        "--http-only",
        action="store_true",
        help="Disable Playwright fallback and use HTTP strategy only",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Do not save file changes",
    )
    return parser.parse_args()


def load_data(path: Path) -> list[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    if not isinstance(payload, list):
        raise ValueError("Expected a JSON list in data file")
    return payload


def save_data(path: Path, events: list[dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(events, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def build_query(event: dict[str, Any]) -> str:
    name = str(event.get("nome") or "").strip()
    if not name:
        return ""

    date_start = str(event.get("data_inicio") or "")
    year = date_start[:4] if len(date_start) >= 4 else ""

    if year and year.isdigit() and year not in name:
        return f"{name} {year}"
    return name


def normalize_google_image_url(raw_url: str) -> str:
    url = html.unescape(raw_url)
    url = url.replace("\\u003d", "=")
    url = url.replace("\\u0026", "&")
    url = url.replace("\\/", "/")
    return url


def search_first_google_image_http(query: str, timeout_ms: int) -> str | None:
    encoded = urllib.parse.quote_plus(query)
    url = GOOGLE_IMAGES_SEARCH_URL.format(query=encoded)

    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/123.0.0.0 Safari/537.36"
            ),
            "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        },
    )

    with urllib.request.urlopen(req, timeout=max(2, timeout_ms / 1000)) as response:
        raw_html = response.read().decode("utf-8", "ignore")

    for regex in (TBN_PLAIN_REGEX, TBN_ESCAPED_REGEX):
        matches = regex.findall(raw_html)
        if not matches:
            continue
        for match in matches:
            candidate = normalize_google_image_url(match)
            if candidate.startswith("http"):
                return candidate

    return None


def click_google_consent_if_present(page: Any) -> None:
    selectors = [
        "button:has-text('Aceitar tudo')",
        "button:has-text('Aceito')",
        "button:has-text('I agree')",
        "button:has-text('Accept all')",
        "#L2AGLb",
    ]

    for selector in selectors:
        try:
            node = page.locator(selector).first
            if node.count() > 0 and node.is_visible():
                node.click(timeout=1500)
                page.wait_for_timeout(800)
                return
        except Exception:
            continue


def first_usable_image_src(page: Any) -> str | None:
    raw_items = page.eval_on_selector_all(
        "img",
        """
        (images) => images.map((img) => ({
          src: img.currentSrc || img.src || '',
          width: img.naturalWidth || img.width || 0,
          height: img.naturalHeight || img.height || 0
        }))
        """,
    )

    for item in raw_items:
        src = str(item.get("src") or "").strip()
        width = int(item.get("width") or 0)
        height = int(item.get("height") or 0)

        if not src.startswith("http"):
            continue
        if width < 80 or height < 80:
            continue

        lower = src.lower()
        if "gstatic.com/images/branding" in lower:
            continue
        if "googlelogo" in lower:
            continue
        if "favicon" in lower:
            continue

        return src

    return None


def search_first_google_image_browser(page: Any, query: str, timeout_ms: int) -> str | None:
    encoded = urllib.parse.quote_plus(query)
    url = GOOGLE_IMAGES_SEARCH_URL.format(query=encoded)

    page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
    click_google_consent_if_present(page)

    try:
        page.wait_for_selector("img", timeout=timeout_ms)
    except PlaywrightTimeoutError:
        return None

    page.wait_for_timeout(1200)
    src = first_usable_image_src(page)
    if src:
        return src

    page.wait_for_timeout(1200)
    return first_usable_image_src(page)


def main() -> int:
    args = parse_args()

    if not args.data.exists():
        print(f"ERROR: data file not found: {args.data}", file=sys.stderr)
        return 2

    events = load_data(args.data)

    targets: list[tuple[int, dict[str, Any]]] = []
    for idx, event in enumerate(events):
        thumb = str(event.get("thumbnail") or "").strip()
        if args.overwrite or not thumb:
            targets.append((idx, event))

    if args.limit and args.limit > 0:
        targets = targets[: args.limit]

    print(f"Loaded events: {len(events)}")
    print(f"Targets: {len(targets)} (overwrite={args.overwrite})")

    if not targets:
        print("Nothing to do.")
        return 0

    use_browser_fallback = (not args.http_only) and (sync_playwright is not None)
    if (not args.http_only) and (sync_playwright is None):
        print("Playwright not available; running HTTP-only mode.")

    updated = 0
    failed: list[str] = []

    playwright_manager = None
    browser = None
    context = None
    page = None

    try:
        for pos, (idx, event) in enumerate(targets, start=1):
            name = str(event.get("nome") or "").strip()
            query = build_query(event)

            if not query:
                failed.append(name or f"index:{idx}")
                print(f"[{pos}/{len(targets)}] SKIP empty name at index {idx}")
                continue

            print(f"[{pos}/{len(targets)}] Searching: {query}")

            src = None

            try:
                src = search_first_google_image_http(query, args.timeout_ms)
            except Exception as exc:
                print(f"  -> http error: {exc}")

            if not src and use_browser_fallback:
                try:
                    if page is None:
                        playwright_manager = sync_playwright()
                        p = playwright_manager.start()
                        browser = p.chromium.launch(headless=not args.headful)
                        context = browser.new_context(locale="pt-BR")
                        page = context.new_page()

                    src = search_first_google_image_browser(page, query, args.timeout_ms)
                except Exception as exc:
                    print(f"  -> browser error: {exc}")

            if src:
                event["thumbnail"] = src
                updated += 1
                print(f"  -> ok: {src}")
            else:
                failed.append(name or query)
                print("  -> no image found")

            if args.delay > 0:
                time.sleep(args.delay)

    finally:
        if context is not None:
            try:
                context.close()
            except Exception:
                pass
        if browser is not None:
            try:
                browser.close()
            except Exception:
                pass
        if playwright_manager is not None:
            try:
                playwright_manager.stop()
            except Exception:
                pass

    if not args.dry_run and updated > 0:
        save_data(args.data, events)
        print(f"Saved: {args.data}")
    elif args.dry_run:
        print("Dry run mode: file not saved")

    print("---")
    print(f"Updated thumbnails: {updated}")
    print(f"Failed: {len(failed)}")

    if failed:
        for item in failed[:30]:
            print(f"  - {item}")
        if len(failed) > 30:
            print(f"  ... and {len(failed) - 30} more")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
