#!/usr/bin/env python3
import json
import html as htmllib
import time
from html.parser import HTMLParser
from urllib.parse import urljoin
from urllib.request import Request, urlopen

BASE_URL = "https://ai-act-service-desk.ec.europa.eu"
TOC_URL = f"{BASE_URL}/en/ai-act-explorer"
OUT_PATH = "/Users/hakantaskin/Projects/LeadAITrustFramework-docker/apps/core-svc/app/seed_data/eu_ai_act_requirements.json"


def normalize(text: str) -> str:
    text = htmllib.unescape(text)
    text = text.replace("\xa0", " ")
    for ch in ("–", "—", "‑", "−"):
        text = text.replace(ch, "-")
    for ch in ("’", "‘", "‛"):
        text = text.replace(ch, "'")
    for ch in ("“", "”", "„"):
        text = text.replace(ch, '"')
    return " ".join(text.split())


class TocParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.toc_started = False
        self.in_h3 = False
        self.in_p = False
        self.in_a = False
        self.current_href = None
        self.mode = "chapters"
        self.chapter = None
        self.section = None
        self.articles = []
        self.annexes = []

    def handle_starttag(self, tag, attrs):
        if tag == "h3":
            self.in_h3 = True
        elif tag == "p":
            self.in_p = True
        elif tag == "a":
            self.in_a = True
            for k, v in attrs:
                if k == "href":
                    self.current_href = v

    def handle_endtag(self, tag):
        if tag == "h3":
            self.in_h3 = False
        elif tag == "p":
            self.in_p = False
        elif tag == "a":
            self.in_a = False
            self.current_href = None

    def handle_data(self, data):
        text = normalize(data)
        if not text:
            return
        if self.in_h3:
            if text == "Table of content":
                self.toc_started = True
                return
            if not self.toc_started:
                return
            if text.startswith("Chapter "):
                self.chapter = text
                self.section = None
                self.mode = "chapters"
            elif text == "Recitals":
                self.mode = "recitals"
            elif text == "Annexes":
                self.mode = "annexes"
            return

        if not self.toc_started:
            return

        if self.mode == "chapters" and self.in_p and text.startswith("Section "):
            self.section = text

        if self.in_a and self.current_href:
            if self.mode == "recitals":
                return
            if self.mode == "annexes" and text.startswith("Annex"):
                self.annexes.append((text, urljoin(BASE_URL, self.current_href)))
                return
            if text.startswith("Article "):
                article_label, _, title = text.partition(":")
                self.articles.append(
                    {
                        "chapter": self.chapter,
                        "section": self.section,
                        "article": article_label.strip(),
                        "content": title.strip() or None,
                        "links": urljoin(BASE_URL, self.current_href),
                    }
                )


class AnnexTitleParser(HTMLParser):
    def __init__(self, annex_label: str):
        super().__init__()
        self.annex_label = annex_label
        self.in_heading = False
        self.found_heading = False
        self.capture_next = False
        self.title = None

    def handle_starttag(self, tag, attrs):
        if tag in ("h2", "h3", "h4"):
            self.in_heading = True
        elif self.found_heading and tag in ("p", "h3", "h4") and not self.title:
            self.capture_next = True

    def handle_endtag(self, tag):
        if tag in ("h2", "h3", "h4"):
            self.in_heading = False
        elif tag == "p":
            self.capture_next = False

    def handle_data(self, data):
        text = normalize(data)
        if not text:
            return
        if self.in_heading and text.startswith(self.annex_label):
            remainder = text[len(self.annex_label) :].strip(" :;-.\t")
            if remainder:
                self.title = remainder
            self.found_heading = True
            return
        if self.capture_next and not self.title:
            self.title = text
            self.capture_next = False


def fetch(url: str) -> str:
    req = Request(
        url,
        headers={
            "User-Agent": "LeadAI-AIMS/1.0 (requirements seed)",
            "Accept": "text/html,application/xhtml+xml",
        },
    )
    with urlopen(req) as resp:
        return resp.read().decode("utf-8", errors="ignore")


def build():
    html_text = fetch(TOC_URL)
    toc = TocParser()
    toc.feed(html_text)

    records = toc.articles[:]

    for annex_label, annex_link in toc.annexes:
        time.sleep(1)
        annex_html = fetch(annex_link)
        parser = AnnexTitleParser(annex_label)
        parser.feed(annex_html)
        content = parser.title or annex_label
        records.append(
            {
                "chapter": "Annexes",
                "section": None,
                "article": annex_label,
                "content": content,
                "links": annex_link,
            }
        )

    return records


def main():
    records = build()
    out_dir = OUT_PATH.rsplit("/", 1)[0]
    import os

    os.makedirs(out_dir, exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2, ensure_ascii=True)
    print(f"Wrote {len(records)} records to {OUT_PATH}")


if __name__ == "__main__":
    main()
