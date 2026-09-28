# -*- coding: utf-8 -*-
"""Repair questions that were broken in the ORIGINAL database
(merged records, glued explanations, wrong 'correct' fields, truncated texts)."""
import json

with open('toeic_database.json', encoding='utf-8') as f:
    db = json.load(f)

qs = {q['id']: q for q in db['questions']}

def fix(qid, question=None, options=None, correct=None):
    q = qs[qid]
    if question is not None: q['question'] = question
    if options is not None: q['options'] = options
    if correct is not None: q['correct'] = correct

# id 171: two merged questions -> keep the one matching the options
fix(171,
    question="Her intelligence more than __________________ for her lack of experience.",
    correct="compensates")

# id 179: trailing garbage removed
fix(179, question="She spoke with __________________ about her life.")

# id 244 / 245: explanations glued into the question text
fix(244, question="__________________ a word if you don't understand it.")
fix(245, question="__________________ the mistakes in your notebook.")

# id 300: wrong 'correct' + missing spaces
fix(300,
    question="Europe’s economic recovery will last only if ________ governments decide to make deeper economic reforms.",
    correct="its")

# id 510/511/514: stray "\tE.\t<definition>" fragments inside the question word
fix(510, question="Symmetry")
fix(511, question="symbiotic")
fix(514, question="Surreptitious")

# id 520: wrong 'correct' field
fix(520, correct="disciplinary")

# id 533: correct answer was absent from options -> make question + proper correct option
fix(533,
    question="Blase",
    options=["Bored, unimpressed", "Marked by excitement", "Abnormal",
             "Having the ability to pick up on things quickly"],
    correct="Bored, unimpressed")

# id 597/598: truncated/garbled text + wrong 'correct'
fix(597,
    question="Mr. Krammer is renowned for his ability to develop and maintain relationships with his colleagues that result ________ optimum solutions for the good of the Corporation.",
    correct="in")
fix(598,
    question="The director got the secretary ____ all prospective clients and inform them about the company’s new products and services.",
    correct="to contact")

# id 599/600: wrong 'correct' field
fix(599, correct="as")
fix(600, correct="specializing")

# id 876: merged record of two questions that BOTH already exist separately
# (id 860 "Less developed countries..." and id 861 "The new secretary...")
# -> replace it with a brand-new business-style question
fix(876,
    question="Neither the suppliers nor the distributor _____ responsible for the shipping delay.",
    options=["are", "is", "have been", "were"],
    correct="is")

# verify every question
import re
bad = [q['id'] for q in db['questions'] if q['correct'] not in q['options']]
assert not bad, f"Still broken: {bad}"
# no new text duplicates should appear
def norm(s): return re.sub(r'\s+', ' ', s.strip().lower())
from collections import Counter, defaultdict
cnt = defaultdict(Counter)
for q in db['questions']:
    cnt[q['category']][(norm(q['question']), tuple(sorted(norm(o) for o in q['options'])))] += 1
for cat, c in cnt.items():
    dups = {k: v for k, v in c.items() if v > 1}
    assert not dups, f"{cat}: duplicates appeared: {dups}"
# each category must still have 100
cats = Counter(q['category'] for q in db['questions'])
assert all(v == 100 for v in cats.values()), cats

with open('toeic_database.json', 'w', encoding='utf-8') as f:
    json.dump(db, f, ensure_ascii=False, indent=2)
    f.write('\n')
with open('toeic_data.js', 'w', encoding='utf-8') as f:
    f.write('const TOEIC_DATA = ')
    f.write(json.dumps(db, ensure_ascii=False, indent=2))
    f.write(';\n')
print('All repaired. 9 x 100 unique questions, every correct answer matches its options.')
