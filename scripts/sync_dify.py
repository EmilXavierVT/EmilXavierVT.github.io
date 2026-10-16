#!/usr/bin/env python3
"""Synchronize this portfolio's Markdown knowledge files with one Dify dataset."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any


DOCUMENT_PREFIX = "portfolio__"
TERMINAL_STATUSES = {"completed", "error", "paused", "stopped"}


@dataclass(frozen=True)
class SourceDocument:
    name: str
    path: Path
    text: str


class DifyApiError(RuntimeError):
    pass


class DifyClient:
    def __init__(self, base_url: str, api_key: str, dataset_id: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.dataset_id = dataset_id

    def request(self, method: str, path: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        body = json.dumps(payload).encode("utf-8") if payload is not None else None
        request = urllib.request.Request(
            f"{self.base_url}{path}",
            data=body,
            method=method,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "User-Agent": "emil-portfolio-dify-sync/1.0",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                raw = response.read().decode("utf-8")
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")[:500]
            raise DifyApiError(f"Dify returned HTTP {error.code}: {detail}") from error
        except urllib.error.URLError as error:
            raise DifyApiError(f"Could not reach Dify: {error.reason}") from error

    def list_documents(self) -> list[dict[str, Any]]:
        documents: list[dict[str, Any]] = []
        page = 1
        while True:
            query = urllib.parse.urlencode({"page": page, "limit": 100})
            response = self.request("GET", f"/datasets/{self.dataset_id}/documents?{query}")
            documents.extend(response.get("data", []))
            if not response.get("has_more"):
                return documents
            page += 1

    def create_document(self, source: SourceDocument) -> str:
        response = self.request(
            "POST",
            f"/datasets/{self.dataset_id}/document/create-by-text",
            {
                "name": source.name,
                "text": source.text,
                "indexing_technique": os.getenv("DIFY_INDEXING_TECHNIQUE", "high_quality"),
                "process_rule": {"mode": "automatic"},
                "doc_form": "text_model",
                "doc_language": "English",
            },
        )
        return require_batch(response)

    def update_document(self, document_id: str, source: SourceDocument) -> str:
        response = self.request(
            "POST",
            f"/datasets/{self.dataset_id}/documents/{document_id}/update-by-text",
            {
                "name": source.name,
                "text": source.text,
                "process_rule": {"mode": "automatic"},
                "doc_form": "text_model",
                "doc_language": "English",
            },
        )
        return require_batch(response)

    def wait_for_indexing(self, batch: str, timeout_seconds: float, poll_seconds: float) -> None:
        deadline = time.monotonic() + timeout_seconds
        while time.monotonic() < deadline:
            response = self.request(
                "GET", f"/datasets/{self.dataset_id}/documents/{urllib.parse.quote(batch)}/indexing-status"
            )
            statuses = response.get("data", [])
            if statuses and all(item.get("indexing_status") in TERMINAL_STATUSES for item in statuses):
                failures = [item for item in statuses if item.get("indexing_status") != "completed"]
                if failures:
                    details = "; ".join(
                        f"{item.get('id', 'unknown')}: {item.get('indexing_status')} {item.get('error') or ''}".strip()
                        for item in failures
                    )
                    raise DifyApiError(f"Indexing did not complete: {details}")
                return
            time.sleep(poll_seconds)
        raise DifyApiError(f"Indexing batch {batch} timed out after {timeout_seconds:.0f} seconds.")

    def delete_document(self, document_id: str) -> None:
        self.request("DELETE", f"/datasets/{self.dataset_id}/documents/{document_id}")


def require_batch(response: dict[str, Any]) -> str:
    batch = response.get("batch")
    if not isinstance(batch, str) or not batch:
        raise DifyApiError("Dify did not return an indexing batch ID.")
    return batch


def stable_document_name(path: Path, knowledge_root: Path) -> str:
    relative = path.relative_to(knowledge_root).as_posix().lower()
    safe = re.sub(r"[^a-z0-9._-]+", "-", relative)
    return f"{DOCUMENT_PREFIX}knowledge__{safe.replace('/', '__')}"


def discover_sources(project_root: Path) -> list[SourceDocument]:
    knowledge_root = project_root / "static" / "knowledge"
    sources = []
    for path in sorted(knowledge_root.rglob("*.md")):
        text = path.read_text(encoding="utf-8").strip()
        if text:
            sources.append(SourceDocument(stable_document_name(path, knowledge_root), path, text + "\n"))
    if not sources:
        raise RuntimeError(f"No Markdown knowledge files found below {knowledge_root}")
    return sources


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Show source documents without contacting Dify.")
    parser.add_argument(
        "--prune",
        action="store_true",
        help="Delete stale or duplicate Dify documents owned by this portfolio sync.",
    )
    return parser.parse_args()


def required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def main() -> int:
    args = parse_args()
    project_root = Path(__file__).resolve().parents[1]
    sources = discover_sources(project_root)

    print(f"Found {len(sources)} portfolio knowledge document(s):")
    for source in sources:
        print(f"- {source.name} <- {source.path.relative_to(project_root)} ({len(source.text)} chars)")
    if args.dry_run:
        return 0

    client = DifyClient(
        os.getenv("DIFY_BASE_URL", "").strip() or "https://api.dify.ai/v1",
        required_env("DIFY_DATASET_API_KEY"),
        required_env("DIFY_DATASET_ID"),
    )
    timeout_seconds = float(os.getenv("DIFY_INDEX_TIMEOUT", "600"))
    poll_seconds = max(1.0, float(os.getenv("DIFY_POLL_INTERVAL", "3")))
    write_delay = max(0.0, float(os.getenv("DIFY_WRITE_DELAY", "1")))

    remote_documents = client.list_documents()
    by_name: dict[str, list[dict[str, Any]]] = {}
    for document in remote_documents:
        name = document.get("name")
        if isinstance(name, str):
            by_name.setdefault(name, []).append(document)

    source_names = {source.name for source in sources}
    stale = [
        document
        for document in remote_documents
        if str(document.get("name", "")).startswith(DOCUMENT_PREFIX) and document.get("name") not in source_names
    ]
    duplicates = [document for name in source_names for document in by_name.get(name, [])[1:]]

    for source in sources:
        matches = by_name.get(source.name, [])
        if matches:
            document_id = str(matches[0]["id"])
            print(f"Updating {source.name} ({document_id})")
            batch = client.update_document(document_id, source)
        else:
            print(f"Creating {source.name}")
            batch = client.create_document(source)
        client.wait_for_indexing(batch, timeout_seconds, poll_seconds)
        print(f"Indexed {source.name}")
        if write_delay:
            time.sleep(write_delay)

    removable = stale + duplicates
    if removable and not args.prune:
        print(f"Found {len(removable)} stale or duplicate portfolio document(s); rerun with --prune to delete them.")
    elif removable:
        for document in removable:
            print(f"Deleting stale document {document.get('name')} ({document.get('id')})")
            client.delete_document(str(document["id"]))

    print("Dify knowledge sync complete.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (DifyApiError, RuntimeError, ValueError) as error:
        print(f"sync failed: {error}", file=sys.stderr)
        raise SystemExit(1)
