#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
import zipfile
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

try:
    from pypdf import PdfReader  # type: ignore
except Exception:  # pragma: no cover
    PdfReader = None  # type: ignore

import xml.etree.ElementTree as ET


DOCX_NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
DOCX_W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


DEFAULT_IGNORED_BASENAMES = {
    ".DS_Store",
    "Icon",
    "Icon\r",
}


EMAIL_RE = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
FR_PHONE_RE = re.compile(r"\b(?:\+33|0)\s*[1-9](?:[\s.\-]*\d{2}){4}\b")
INTL_PHONE_RE = re.compile(r"\+\d{1,3}[\s.\-]?\d(?:[\s.\-]*\d){6,}")


def slugify(text: str) -> str:
    text = text.strip().lower()
    text = text.replace("’", "'")
    text = re.sub(r"[^\w\s\-']", " ", text, flags=re.UNICODE)
    text = re.sub(r"[\s_]+", "-", text)
    text = re.sub(r"-{2,}", "-", text)
    return text.strip("-") or "document"


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def redact_pii(text: str) -> str:
    text = EMAIL_RE.sub("[EMAIL]", text)
    text = FR_PHONE_RE.sub("[TELEPHONE]", text)
    text = INTL_PHONE_RE.sub("[TELEPHONE]", text)
    return text


def unescape_light_markdown(text: str) -> str:
    return re.sub(r"\\([\[\]_*`\\])", r"\1", text)


def clean_common(text: str, *, redact: bool) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = text.replace("\u00a0", " ")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    if redact:
        text = redact_pii(text)
    return text.strip() + "\n"


def normalize_slide_txt_to_md(text: str) -> str:
    text = unescape_light_markdown(text)
    lines = []
    expect_title = False
    for raw in text.splitlines():
        line = raw.rstrip()
        if re.fullmatch(r"\s*\\?-{3,}\s*", line):
            lines.append("---")
            continue
        m = re.match(r"^\*\*\[DIAPORAMA\]\s*(.+?)\s*\*\*$", line, flags=re.IGNORECASE)
        if m:
            lines.append(f"# {m.group(1).strip()}")
            continue
        m = re.match(r"^\*\*\[DIAPOSITIVE\s+(\d+)\]\*\*$", line, flags=re.IGNORECASE)
        if m:
            lines.append(f"## Diapositive {m.group(1)}")
            continue
        m = re.match(r"^\*\*\[TITRE\]\*\*\s*(.*)$", line, flags=re.IGNORECASE)
        if m:
            title = m.group(1).strip()
            if title:
                lines.append(f"### {title}")
                expect_title = False
            else:
                expect_title = True
            continue
        if re.match(r"^\*\*\[CONTENU\]\*\*", line, flags=re.IGNORECASE):
            line = re.sub(r"^\*\*\[CONTENU\]\*\*\s*", "", line, flags=re.IGNORECASE).strip()
            if not line:
                continue
        if expect_title and line.strip() and not line.strip().startswith("**["):
            lines.append(f"### {line.strip()}")
            expect_title = False
            continue
        lines.append(line)
    return "\n".join(lines).strip() + "\n"


def should_drop_line(line: str) -> bool:
    s = line.strip()
    if not s:
        return False
    if s.lower().startswith("table des matières"):
        return True
    if "PAGEREF" in s:
        return True
    if re.match(r"^\s*TOC\b", s):
        return True
    if "Erreur !" in s and ("Signet" in s or "signet" in s):
        return True
    if re.fullmatch(r"\d{1,4}", s):
        return True
    return False


def docx_to_markdown(docx_path: Path) -> tuple[str, list[str]]:
    warnings: list[str] = []
    if not zipfile.is_zipfile(docx_path):
        return "", [f"not-a-zip-docx:{docx_path.name}"]

    try:
        with zipfile.ZipFile(docx_path) as z:
            xml_bytes = z.read("word/document.xml")
    except Exception as e:  # pragma: no cover
        return "", [f"docx-read-failed:{e!r}"]

    try:
        root = ET.fromstring(xml_bytes)
    except Exception as e:  # pragma: no cover
        return "", [f"docx-xml-parse-failed:{e!r}"]

    out_lines: list[str] = []
    for p in root.findall(".//w:p", DOCX_NS):
        style_el = p.find("./w:pPr/w:pStyle", DOCX_NS)
        style = style_el.get(f"{DOCX_W}val") if style_el is not None else ""
        style_norm = (style or "").lower()
        if style_norm.startswith("toc"):
            continue

        is_list = p.find("./w:pPr/w:numPr", DOCX_NS) is not None

        parts: list[str] = []
        for node in p.iter():
            if node.tag == f"{DOCX_W}t" and node.text:
                parts.append(node.text)
            elif node.tag == f"{DOCX_W}tab":
                parts.append("\t")
            elif node.tag == f"{DOCX_W}br":
                parts.append("\n")

        text = "".join(parts)
        text = text.replace("\u00a0", " ").strip()
        if not text:
            continue
        if should_drop_line(text):
            continue

        if style_norm in {"title"}:
            out_lines.append(f"# {text}")
            continue
        if style_norm.startswith("heading"):
            m = re.match(r"heading(\d+)", style_norm)
            level = int(m.group(1)) if m else 2
            level = max(1, min(6, level))
            out_lines.append("#" * level + f" {text}")
            continue

        if is_list:
            out_lines.append(f"- {text}")
        else:
            out_lines.append(text)

    if not out_lines:
        warnings.append("docx-empty-output")

    return "\n".join(out_lines).strip() + "\n", warnings


def pdf_to_markdown_chunks(pdf_path: Path, *, chunk_pages: int) -> tuple[list[tuple[int, int, str]], list[str]]:
    warnings: list[str] = []
    if PdfReader is None:
        return [], ["pypdf-not-installed"]

    try:
        reader = PdfReader(str(pdf_path))
    except Exception as e:  # pragma: no cover
        return [], [f"pdf-open-failed:{e!r}"]

    chunks: list[tuple[int, int, str]] = []
    total = len(reader.pages)
    if total == 0:
        return [], ["pdf-empty"]

    for start in range(0, total, max(1, chunk_pages)):
        end = min(total, start + max(1, chunk_pages))
        pages_text: list[str] = []
        for i in range(start, end):
            try:
                page_text = reader.pages[i].extract_text() or ""
            except Exception:
                page_text = ""
            if not page_text.strip():
                continue
            pages_text.append(page_text)

        joined = "\n\n".join(pages_text)
        joined = joined.replace("\x0c", "\n")
        # Drop obvious TOC / bookmark noise line-by-line.
        cleaned_lines = [ln for ln in joined.splitlines() if not should_drop_line(ln)]
        md = "\n".join(cleaned_lines).strip() + "\n"
        if not md.strip():
            warnings.append(f"pdf-chunk-empty:{start+1}-{end}")
        chunks.append((start + 1, end, md))

    return chunks, warnings


def infer_title_from_filename(path: Path) -> str:
    stem = path.stem.replace("_", " ").strip()
    stem = re.sub(r"\s{2,}", " ", stem)
    return stem


def yaml_frontmatter(meta: dict) -> str:
    def esc(v: str) -> str:
        return v.replace('"', '\\"')

    lines = ["---"]
    for k, v in meta.items():
        if v is None:
            continue
        if isinstance(v, bool):
            lines.append(f"{k}: {'true' if v else 'false'}")
        elif isinstance(v, (int, float)):
            lines.append(f"{k}: {v}")
        else:
            lines.append(f'{k}: "{esc(str(v))}"')
    lines.append("---")
    return "\n".join(lines) + "\n\n"


@dataclass
class ManifestEntry:
    id: str
    title: str
    source_path: str
    output_path: str
    source_type: str
    output_type: str
    redacted: bool
    sha256: str
    bytes: int
    chars: int
    words: int
    created_at: str
    warnings: str


def iter_source_files(root: Path) -> Iterable[Path]:
    for p in root.rglob("*"):
        if not p.is_file():
            continue
        if p.name in DEFAULT_IGNORED_BASENAMES:
            continue
        if p.name.startswith("."):
            continue
        yield p


def safe_relpath(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


def build_output_path(output_root: Path, source_root: Path, source_path: Path, *, suffix: str) -> Path:
    rel = source_path.relative_to(source_root)
    parts = [slugify(p) for p in rel.parts[:-1]]
    base = slugify(rel.stem) + suffix
    return output_root.joinpath(*parts, base)


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Prepare a clean knowledge base export (Markdown + manifest).")
    parser.add_argument("--input", default="knowledgebase", help="Input folder (default: knowledgebase)")
    parser.add_argument("--output", default="knowledgebase_clean", help="Output folder (default: knowledgebase_clean)")
    parser.add_argument("--redact-pii", action="store_true", default=True, help="Redact emails/phones (default: on)")
    parser.add_argument("--no-redact-pii", action="store_false", dest="redact_pii", help="Disable PII redaction")
    parser.add_argument("--chunk-pages", type=int, default=40, help="PDF chunk size in pages (default: 40)")
    parser.add_argument("--dry-run", action="store_true", help="Do not write files")
    args = parser.parse_args(argv)

    source_root = Path(args.input).resolve()
    output_root = Path(args.output).resolve()
    if not source_root.exists():
        print(f"Input folder not found: {source_root}", file=sys.stderr)
        return 2

    created_at = datetime.now(timezone.utc).isoformat()
    manifest: list[ManifestEntry] = []
    report_lines: list[str] = []

    for src in sorted(iter_source_files(source_root)):
        ext = src.suffix.lower()
        if ext not in {".txt", ".docx", ".pdf"}:
            report_lines.append(f"SKIP unsupported: {safe_relpath(src, source_root)}")
            continue

        title = infer_title_from_filename(src)
        category = src.parent.name
        common_meta = {
            "title": title,
            "source": safe_relpath(src, source_root),
            "category": category,
            "redacted": bool(args.redact_pii),
            "generated_at": created_at,
        }

        if ext == ".txt":
            raw = src.read_text(encoding="utf-8", errors="replace")
            md = normalize_slide_txt_to_md(raw)
            md = clean_common(md, redact=args.redact_pii)
            out_path = build_output_path(output_root, source_root, src, suffix=".md")
            content = yaml_frontmatter(common_meta) + md
            warnings = ""
            if not args.dry_run:
                write_text(out_path, content)
            b = content.encode("utf-8")
            manifest.append(
                ManifestEntry(
                    id=sha256_bytes(b)[:16],
                    title=title,
                    source_path=safe_relpath(src, source_root),
                    output_path=out_path.relative_to(output_root).as_posix(),
                    source_type="txt",
                    output_type="md",
                    redacted=bool(args.redact_pii),
                    sha256=sha256_bytes(b),
                    bytes=len(b),
                    chars=len(content),
                    words=len(re.findall(r"\\w+", content, flags=re.UNICODE)),
                    created_at=created_at,
                    warnings=warnings,
                )
            )
            continue

        if ext == ".docx":
            md, warns = docx_to_markdown(src)
            md = clean_common(md, redact=args.redact_pii)
            out_path = build_output_path(output_root, source_root, src, suffix=".md")
            content = yaml_frontmatter(common_meta) + md
            warnings = ";".join(warns)
            if not args.dry_run:
                write_text(out_path, content)
            b = content.encode("utf-8")
            manifest.append(
                ManifestEntry(
                    id=sha256_bytes(b)[:16],
                    title=title,
                    source_path=safe_relpath(src, source_root),
                    output_path=out_path.relative_to(output_root).as_posix(),
                    source_type="docx",
                    output_type="md",
                    redacted=bool(args.redact_pii),
                    sha256=sha256_bytes(b),
                    bytes=len(b),
                    chars=len(content),
                    words=len(re.findall(r"\\w+", content, flags=re.UNICODE)),
                    created_at=created_at,
                    warnings=warnings,
                )
            )
            if warns:
                report_lines.append(f"WARN docx {safe_relpath(src, source_root)}: {warnings}")
            continue

        if ext == ".pdf":
            chunks, warns = pdf_to_markdown_chunks(src, chunk_pages=args.chunk_pages)
            if warns:
                report_lines.append(f"WARN pdf {safe_relpath(src, source_root)}: {';'.join(warns)}")
            if not chunks:
                report_lines.append(f"SKIP pdf empty: {safe_relpath(src, source_root)}")
                continue

            for start_page, end_page, md in chunks:
                chunk_meta = dict(common_meta)
                chunk_meta["pages"] = f"{start_page}-{end_page}"
                md = clean_common(md, redact=args.redact_pii)
                out_path = build_output_path(output_root, source_root, src, suffix=f"-p{start_page:04d}-p{end_page:04d}.md")
                content = yaml_frontmatter(chunk_meta) + md
                warnings = ";".join(warns)
                if not args.dry_run:
                    write_text(out_path, content)
                b = content.encode("utf-8")
                manifest.append(
                    ManifestEntry(
                        id=sha256_bytes(b)[:16],
                        title=title,
                        source_path=safe_relpath(src, source_root),
                        output_path=out_path.relative_to(output_root).as_posix(),
                        source_type="pdf",
                        output_type="md",
                        redacted=bool(args.redact_pii),
                        sha256=sha256_bytes(b),
                        bytes=len(b),
                        chars=len(content),
                        words=len(re.findall(r"\\w+", content, flags=re.UNICODE)),
                        created_at=created_at,
                        warnings=warnings,
                    )
                )
            continue

    if not args.dry_run:
        output_root.mkdir(parents=True, exist_ok=True)
        manifest_path = output_root / "manifest.json"
        manifest_csv_path = output_root / "manifest.csv"
        report_path = output_root / "report.txt"

        manifest_json = {
            "generated_at": created_at,
            "source_root": str(source_root),
            "output_root": str(output_root),
            "redacted": bool(args.redact_pii),
            "documents": [asdict(m) for m in manifest],
        }
        manifest_path.write_text(json.dumps(manifest_json, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

        with manifest_csv_path.open("w", newline="", encoding="utf-8") as f:
            fieldnames = list(asdict(manifest[0]).keys()) if manifest else ["id"]
            w = csv.DictWriter(f, fieldnames=fieldnames)
            w.writeheader()
            for m in manifest:
                w.writerow(asdict(m))

        report = "\n".join(report_lines).strip() + ("\n" if report_lines else "")
        report_path.write_text(report, encoding="utf-8")

    print(f"Prepared {len(manifest)} documents in {output_root}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
