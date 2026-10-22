import re

from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS

TOKEN_RE = re.compile(r"[a-z0-9]+")
STOP_WORDS = frozenset(ENGLISH_STOP_WORDS)
PREFIX_RE = re.compile(r"^\s*((re|fwd?|aw)\s*(\[\d+\])?\s*:\s*)+", re.IGNORECASE)
SPACE_RE = re.compile(r"\s+")


def tokenize(text):
    return [
        token
        for token in TOKEN_RE.findall((text or "").lower())
        if len(token) > 1 and token not in STOP_WORDS
    ]


def strip_prefix(subject):
    return SPACE_RE.sub(" ", PREFIX_RE.sub("", subject or "")).strip()


def normalize_subject(subject):
    return strip_prefix(subject).lower()


def index_text(doc):
    subject = strip_prefix(doc["subject"])
    return f"{subject} {subject} {doc['body']}"


def embed_text(doc):
    return f"{strip_prefix(doc['subject'])}. {doc['body'][:1200]}"


def make_snippet(body, terms, width=240):
    flat = SPACE_RE.sub(" ", body or "").strip()
    if not flat:
        return ""
    if not terms:
        return flat[:width] + ("..." if len(flat) > width else "")
    lower = flat.lower()
    positions = []
    for term in terms:
        for match in re.finditer(re.escape(term.lower()), lower):
            positions.append(match.start())
            if len(positions) >= 300:
                break
    if not positions:
        return flat[:width] + ("..." if len(flat) > width else "")
    positions.sort()
    best_start = positions[0]
    best_count = 0
    for start in positions:
        count = sum(1 for p in positions if start <= p < start + width)
        if count > best_count:
            best_start, best_count = start, count
    begin = max(0, best_start - 40)
    end = begin + width
    snippet = flat[begin:end]
    return ("..." if begin > 0 else "") + snippet + ("..." if end < len(flat) else "")
