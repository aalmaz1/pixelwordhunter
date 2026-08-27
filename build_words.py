#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Rebuild the canonical public/words_optimized.json dictionary.

Every category contains exactly the 12 words from Lin Lougheed's
"600 Essential Words for the TOEIC" (Barron's), with RU/KO translations and
EN/RU/KO example sentences.
"""
import json
import re
import sys

from build_data_a import CATS_A
from build_data_b import CATS_B
from build_data_c import CATS_C
from build_data_d import CATS_D

CATS = {}
CATS.update(CATS_A)
CATS.update(CATS_B)
CATS.update(CATS_C)
CATS.update(CATS_D)

# Preserve the category order already used by the app (Correspondence is
# stored last in the existing file, matching the current category grid).
CATEGORY_ORDER = [
    "Contracts", "Marketing", "Warranties", "Business Planning", "Conferences",
    "Computers", "Office Technology", "Office Procedures", "Electronics",
    "Job Advertising and Recruiting", "Applying and Interviewing",
    "Hiring and Training", "Salaries and Benefits",
    "Promotions, Pensions, and Awards", "Shopping", "Ordering Supplies",
    "Shipping", "Invoices", "Inventory", "Banking", "Accounting",
    "Investments", "Taxes", "Financial Statements", "Property and Departments",
    "Board Meeting and Committees", "Quality Control", "Product Development",
    "Renting and Leasing", "Selecting a Restaurant", "Eating Out",
    "Ordering Lunch", "Cooking as a Career", "Events", "General Travel",
    "Airlines", "Trains", "Hotels", "Car Rentals", "Movies", "Theater",
    "Music", "Museums", "Media", "Doctors Office", "Dentists Office",
    "Health Insurance", "Hospitals", "Pharmacy", "Correspondence",
]

def slug(s):
    s = s.strip().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")

def card(cat, eng, rus, kor, exEng, exRus, exKor):
    return {
        "id": f"{slug(cat)}--{slug(eng)}",
        "category": cat,
        "eng": eng,
        "rus": rus,
        "exampleEng": exEng,
        "exampleRus": exRus,
        "kor": kor,
        "exampleKor": exKor,
    }

def main():
    # Validate coverage
    missing = [c for c in CATEGORY_ORDER if c not in CATS]
    extra = [c for c in CATS if c not in CATEGORY_ORDER]
    if missing or extra:
        print("MISSING categories:", missing)
        print("EXTRA categories:", extra)
        sys.exit(1)

    data = []
    for cat in CATEGORY_ORDER:
        rows = CATS[cat]
        assert len(rows) == 12, f"{cat} has {len(rows)} words, expected 12"
        for r in rows:
            assert len(r) == 6, f"{cat} {r!r} malformed"
            data.append(card(cat, *r))

    assert len(data) == 600, f"expected 600 cards, got {len(data)}"
    ids = [w["id"] for w in data]
    assert len(ids) == len(set(ids)), "duplicate ids"
    for w in data:
        assert w["rus"].strip() and w["kor"].strip(), f"empty translation: {w['id']}"

    # Ship a compact single-letter key format to keep the dictionary small
    # (loaded and parsed by the app on every start). sanitize.js reads both
    # this format and the long key names, so hand-edited data still works.
    SHORT_KEYS = {
        "id": "i", "category": "c", "eng": "e", "rus": "r",
        "exampleEng": "E", "exampleRus": "R", "kor": "k", "exampleKor": "K",
    }
    compact = [{SHORT_KEYS[k]: v for k, v in w.items()} for w in data]
    payload = json.dumps(compact, ensure_ascii=False, separators=(",", ":"))
    with open("public/words_optimized.json", "w", encoding="utf-8") as f:
        f.write(payload + "\n")

    unique_eng = len({w["eng"] for w in data})
    print(f"Total cards: {len(data)}")
    print(f"Unique English terms: {unique_eng}")
    print(f"Categories: {len(CATEGORY_ORDER)}")
    for cat in CATEGORY_ORDER:
        print(f"  {len(CATS[cat]):2}  {cat}")

if __name__ == "__main__":
    main()
