import re
from dataclasses import dataclass

OPERATOR_RE = re.compile(r'\b(group|from):(?:"([^"]+)"|(\S+))', re.IGNORECASE)
PHRASE_RE = re.compile(r'"([^"]+)"')
SPACE_RE = re.compile(r"\s+")


@dataclass
class ParsedQuery:
    text: str
    groups: list
    authors: list
    phrases: list


def parse_query(raw):
    groups = []
    authors = []

    def take(match):
        value = (match.group(2) or match.group(3)).strip().lower()
        if match.group(1).lower() == "group":
            groups.append(value)
        else:
            authors.append(value)
        return " "

    remainder = OPERATOR_RE.sub(take, raw or "")
    phrases = [SPACE_RE.sub(" ", p).strip().lower() for p in PHRASE_RE.findall(remainder)]
    phrases = [p for p in phrases if p]
    text = SPACE_RE.sub(" ", PHRASE_RE.sub(lambda m: f" {m.group(1)} ", remainder)).strip()
    return ParsedQuery(text=text, groups=groups, authors=authors, phrases=phrases)
