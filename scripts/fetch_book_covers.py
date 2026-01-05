#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import html
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


def resolve_image_path(raw: str, project_root: Path) -> Path:
    p = Path(str(raw or ""))
    if not p.as_posix():
        return project_root / "img" / "books" / "unknown.jpg"
    if p.is_absolute():
        return p
    parts = p.parts
    if parts and parts[0] == "..":
        p = Path(*parts[1:])
    return (project_root / p).resolve()


def extract_isbn_from_amazon_url(url: str) -> str | None:
    m = re.search(r"/dp/([A-Z0-9]{10})", url)
    if m:
        return m.group(1)
    m = re.search(r"/gp/product/([A-Z0-9]{10})", url)
    if m:
        return m.group(1)
    return None


def extract_asin_from_amazon_url(url: str) -> str | None:
    m = re.search(r"/dp/([A-Z0-9]{10})", url)
    if m:
        return m.group(1)
    m = re.search(r"/gp/product/([A-Z0-9]{10})", url)
    if m:
        return m.group(1)
    return None


def fetch_amazon_cover_url(
    url: str,
    user_agent: str,
    timeout_s: int,
) -> str | None:
    asin = extract_asin_from_amazon_url(url)
    if asin:
        url = f"https://www.amazon.fr/dp/{asin}"

    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": user_agent,
            "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout_s) as resp:
            page = resp.read(900_000).decode("utf-8", "ignore")
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError):
        return None

    m = re.search(r'id="landingImage"[^>]+data-a-dynamic-image="([^"]+)"', page)
    if not m:
        m = re.search(r'data-a-dynamic-image="([^"]+)"', page)
    if not m:
        return None

    raw = html.unescape(m.group(1))
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None

    best_url = None
    best_area = -1
    for u, size in data.items():
        if not isinstance(u, str) or not u.startswith("http"):
            continue
        if not isinstance(size, list) or len(size) != 2:
            continue
        w, h = size
        if not isinstance(w, int) or not isinstance(h, int):
            continue
        area = w * h
        if area > best_area:
            best_area = area
            best_url = u

    if not best_url:
        return None

    # Try to upgrade to a larger variant when possible.
    upgrade_candidates: list[str] = [best_url]
    upgraded = re.sub(r"\._S[XYL]\d+_\.", "._SL1500_.", best_url)
    if upgraded != best_url:
        upgrade_candidates.insert(0, upgraded)
    stripped = re.sub(r"\._S[XYL]\d+_\.", ".", best_url)
    if stripped != best_url:
        upgrade_candidates.append(stripped)

    for candidate in upgrade_candidates:
        # Light validation: must look like an image URL.
        if re.search(r"\.(jpe?g|png)\b", candidate, re.IGNORECASE):
            return candidate
    return best_url


def download(url: str, dest: Path, user_agent: str, timeout_s: int) -> bool:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": user_agent,
            "Accept": "image/jpeg,image/png,image/*;q=0.8,*/*;q=0.5",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout_s) as resp:
            ctype = (resp.headers.get("Content-Type") or "").lower()
            if "image/" not in ctype:
                return False
            data = resp.read()
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError):
        return False

    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    return True


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        description="Télécharge les couvertures des livres (via ISBN) dans img/books d'après data/bibliotheque.json.",
    )
    parser.add_argument("--data", default="data/bibliotheque.json", help="Chemin vers le JSON de la bibliothèque.")
    parser.add_argument(
        "--source",
        choices=["auto", "amazon", "openlibrary"],
        default="auto",
        help="Source des couvertures (auto = amazon puis fallback).",
    )
    parser.add_argument("--force", action="store_true", help="Réécrit les images existantes.")
    parser.add_argument("--limit", type=int, default=0, help="Limite le nombre de téléchargements (0 = illimité).")
    parser.add_argument("--sleep", type=float, default=0.35, help="Pause entre téléchargements (secondes).")
    parser.add_argument("--timeout", type=int, default=15, help="Timeout réseau par image (secondes).")
    parser.add_argument(
        "--user-agent",
        default="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        help="User-Agent utilisé pour les requêtes HTTP.",
    )
    args = parser.parse_args(argv)

    data_path = Path(args.data)
    if not data_path.exists():
        print(f"Erreur: fichier introuvable: {data_path}", file=sys.stderr)
        return 2
    project_root = data_path.resolve().parent.parent

    raw = json.loads(data_path.read_text(encoding="utf-8"))
    books = raw.get("livres")
    if not isinstance(books, list):
        print("Erreur: JSON inattendu (clé 'livres' manquante ou invalide).", file=sys.stderr)
        return 2

    downloaded = 0
    skipped = 0
    failed = 0

    for b in books:
        title = str(b.get("titre") or "").strip() or "(sans titre)"
        dest = resolve_image_path(str(b.get("image") or ""), project_root)
        if not str(dest).endswith((".jpg", ".jpeg", ".png", ".webp")):
            failed += 1
            print(f"[skip] {title}: champ 'image' invalide ({b.get('image')})")
            continue

        if dest.exists() and dest.stat().st_size > 0 and not args.force:
            skipped += 1
            continue

        url_amazon = str(b.get("url_amazon") or "").strip()
        ok = False
        if args.source in ("auto", "amazon"):
            cover_url = fetch_amazon_cover_url(url_amazon, user_agent=args.user_agent, timeout_s=args.timeout)
            if cover_url:
                ok = download(cover_url, dest, user_agent=args.user_agent, timeout_s=args.timeout)

        if not ok and args.source in ("auto", "openlibrary"):
            isbn = extract_isbn_from_amazon_url(url_amazon)
            if isbn:
                cover_url = f"https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg?default=false"
                ok = download(cover_url, dest, user_agent=args.user_agent, timeout_s=args.timeout)

        if ok:
            downloaded += 1
            print(f"[ok] {title} -> {dest}")
        else:
            failed += 1
            print(f"[fail] {title}: cover introuvable")

        if args.limit and downloaded >= args.limit:
            break
        time.sleep(max(0.0, float(args.sleep)))

    print(f"Terminé: téléchargés={downloaded} ignorés={skipped} échecs={failed}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
