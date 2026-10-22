import re
from collections import defaultdict
from pathlib import Path

from sklearn.datasets import fetch_20newsgroups

from .config import DATA_DIR
from .text import normalize_subject

HEADER_RE = re.compile(r"^([A-Za-z][A-Za-z\-]*):\s*(.*)$")
PAREN_RE = re.compile(r"\(([^)]*)\)")
ANGLE_RE = re.compile(r'^\s*"?([^"<]*?)"?\s*<')
SOLO_SUBJECTS = {"", "(no subject)", "no subject"}


def split_post(text):
    head, separator, body = text.partition("\n\n")
    if not separator:
        return {}, text.strip()
    headers = {}
    last = None
    for line in head.splitlines():
        if line[:1] in (" ", "\t") and last:
            headers[last] += " " + line.strip()
            continue
        match = HEADER_RE.match(line)
        if match:
            last = match.group(1).lower()
            headers[last] = match.group(2).strip()
    if "from" not in headers and "subject" not in headers:
        return {}, text.strip()
    return headers, body.strip()


def parse_author(raw):
    raw = (raw or "").strip()
    paren = PAREN_RE.search(raw)
    if paren and paren.group(1).strip():
        return paren.group(1).strip()
    angle = ANGLE_RE.match(raw)
    if angle and angle.group(1).strip():
        return angle.group(1).strip()
    return raw.split("@")[0].strip() or "unknown"


def assign_threads(docs):
    thread_ids = {}
    for doc in docs:
        subject = doc["norm_subject"]
        if subject in SOLO_SUBJECTS:
            key = (doc["group"], f"solo:{doc['id']}")
        else:
            key = (doc["group"], subject)
        if key not in thread_ids:
            thread_ids[key] = len(thread_ids)
        doc["thread_id"] = thread_ids[key]
    return docs


def load_corpus():
    bunch = fetch_20newsgroups(
        data_home=str(DATA_DIR / "sklearn"),
        subset="all",
        remove=("footers", "quotes"),
        shuffle=False,
    )
    docs = []
    for text, target, filename in zip(bunch.data, bunch.target, bunch.filenames):
        headers, body = split_post(text)
        subject = re.sub(r"\s+", " ", headers.get("subject", "")).strip() or "(no subject)"
        if not body and subject == "(no subject)":
            continue
        name = Path(filename).name
        from_raw = headers.get("from", "").strip()
        docs.append(
            {
                "id": len(docs),
                "group": bunch.target_names[target],
                "number": int(name) if name.isdigit() else len(docs),
                "subject": subject,
                "norm_subject": normalize_subject(subject),
                "author": parse_author(from_raw),
                "from_raw": from_raw,
                "organization": headers.get("organization", "").strip(),
                "body": body,
            }
        )
    return assign_threads(docs)
