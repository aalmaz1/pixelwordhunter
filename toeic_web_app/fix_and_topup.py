# -*- coding: utf-8 -*-
"""Fix mojibake, remove exact duplicates, and top-up categories to 100 unique questions."""
import json, re, copy

with open('toeic_database.json', encoding='utf-8') as f:
    db = json.load(f)

# ---------- 1. Fix mojibake (U+FFFD + letter -> original cp1251 char) ----------
def fix(s):
    return s.replace('\ufffdf', '’').replace('\ufffdg', '“').replace('\ufffdh', '”')

fixed = 0
for q in db['questions']:
    new_q = fix(q['question'])
    new_opts = [fix(o) for o in q['options']]
    new_c = fix(q['correct'])
    if new_q != q['question'] or new_opts != q['options'] or new_c != q['correct']:
        fixed += 1
    q['question'], q['options'], q['correct'] = new_q, new_opts, new_c
print(f'Mojibake fixed in {fixed} questions')

# ---------- 2. New questions (checked to be absent from the DB) ----------
NEW_P3 = [
    {"question": "The weather ___________________ for tomorrow is warm and sunny.",
     "options": ["forecast", "foreword", "forefather", "forehead"], "correct": "forecast"},
    {"question": "Passengers are requested to fasten their seat belts during ___________________ and landing.",
     "options": ["take-in", "take-off", "take-out", "take-over"], "correct": "take-off"},
    {"question": "The medicine did not have any ___________________ effect on the patient.",
     "options": ["benevolent", "benefactor", "beneficial", "beneficiary"], "correct": "beneficial"},
    {"question": "His ___________________ knowledge of the subject made everyone doubt his competence.",
     "options": ["inadequate", "invaluable", "inevitable", "inordinate"], "correct": "inadequate"},
    {"question": "The journalist refused to reveal the ___________________ of his information.",
     "options": ["source", "sauce", "resource", "outsource"], "correct": "source"},
    {"question": "Neither the secretary nor the managers ___________________ present at the meeting.",
     "options": ["was", "is", "were", "has been"], "correct": "were"},
    {"question": "It is high time we ___________________ something to protect the environment.",
     "options": ["do", "did", "have done", "will do"], "correct": "did"},
    {"question": "No sooner had the concert begun ___________________ the lights went out.",
     "options": ["when", "that", "than", "then"], "correct": "than"},
    {"question": "She is used to ___________________ up early in the morning.",
     "options": ["get", "got", "getting", "have got"], "correct": "getting"},
    {"question": "The students were looking forward to ___________________ their summer holidays.",
     "options": ["spend", "spending", "have spent", "spent"], "correct": "spending"},
]

NEW_P7 = [
    {"question": "The quarterly sales report must be submitted _____ 5 p.m. on the last Friday of the month.",
     "options": ["during", "since", "until", "by"], "correct": "by"},
    {"question": "All employees are required to attend the safety seminar, _____ of their position in the company.",
     "options": ["despite", "instead", "regardless", "ahead"], "correct": "regardless"},
    {"question": "The marketing department has worked on the campaign _____ over three months.",
     "options": ["since", "for", "by", "from"], "correct": "for"},
    {"question": "Ms. Park was promoted to regional manager _____ her outstanding performance in sales.",
     "options": ["in spite of", "although", "because of", "whereas"], "correct": "because of"},
    {"question": "Every conference room in the new building is equipped _____ modern video conferencing systems.",
     "options": ["by", "for", "of", "with"], "correct": "with"},
    {"question": "Customers may exchange any item _____ 30 days of purchase, provided they have a receipt.",
     "options": ["within", "among", "along", "throughout"], "correct": "within"},
    {"question": "The keynote address was _____ inspiring that the audience requested a second session.",
     "options": ["such", "too", "so", "very"], "correct": "so"},
    {"question": "The east elevator will remain out of service _____ the maintenance work is completed.",
     "options": ["when", "during", "since", "until"], "correct": "until"},
    {"question": "The new scheduling software is _____ easier to use than the old one.",
     "options": ["very", "too", "far", "so"], "correct": "far"},
    {"question": "Production _____ steadily since the factory introduced automated equipment.",
     "options": ["increased", "has increased", "is increasing", "increases"], "correct": "has increased"},
    {"question": "Applicants should submit their resumes _____ the Human Resources office by the deadline.",
     "options": ["at", "in", "on", "to"], "correct": "to"},
    {"question": "The annual report offers a comprehensive _____ of the company's financial results.",
     "options": ["oversight", "overlook", "overview", "overtone"], "correct": "overview"},
    {"question": "Due to rising material costs, the construction will take _____ than originally expected.",
     "options": ["long", "longest", "lengthy", "longer"], "correct": "longer"},
    {"question": "The manager asked her assistant _____ all the travel arrangements for the trade fair.",
     "options": ["to arrange", "arranging", "arrange", "arranged"], "correct": "to arrange"},
    {"question": "A notice about the revised vacation policy _____ to all staff members last Friday.",
     "options": ["sent", "was sent", "has sent", "is sending"], "correct": "was sent"},
    {"question": "Despite _____ best efforts, the sales team could not reach the quarterly target.",
     "options": ["they", "them", "their", "theirs"], "correct": "their"},
    {"question": "The supervisor recommended that every technician _____ the safety manual before the inspection.",
     "options": ["reads", "will read", "reading", "read"], "correct": "read"},
    {"question": "Clients can access their account details online _____ they register for the service.",
     "options": ["unless", "although", "provided", "moreover"], "correct": "provided"},
    {"question": "Bentley & Sons will relocate its headquarters _____ a larger office complex across the river.",
     "options": ["into", "at", "inside", "to"], "correct": "to"},
    {"question": "All invoices must be settled within 30 days; _____, interest will be charged on overdue balances.",
     "options": ["moreover", "therefore", "however", "otherwise"], "correct": "otherwise"},
    {"question": "Mr. Tanaka's proposal received _____ support from all the board members.",
     "options": ["favorable", "favorably", "favor", "favoring"], "correct": "favorable"},
]

# ---------- 3. Remove exact duplicates within each category ----------
def norm(s):
    return re.sub(r'\s+', ' ', s.strip().lower())

def key(q):
    return (norm(q['question']),
            tuple(sorted(norm(o) for o in q['options'])),
            norm(q['correct']))

kept, removed = [], 0
seen_by_cat = {}
for q in db['questions']:
    cat = q['category']
    seen = seen_by_cat.setdefault(cat, set())
    k = key(q)
    if k in seen:
        removed += 1
        continue
    seen.add(k)
    kept.append(q)
print(f'Removed {removed} exact duplicates')

db['questions'] = kept
by_cat = {}
for q in db['questions']:
    by_cat.setdefault(q['category'], []).append(q)

# ---------- 4. Top-up categories ----------
def add_questions(cat_name, new_items):
    existing = { (norm(q['question']), tuple(sorted(norm(o) for o in q['options']))) for q in by_cat[cat_name] }
    existing_texts = {norm(q['question']) for q in by_cat[cat_name]}
    added = 0
    for item in new_items:
        qt, opts = norm(item['question']), tuple(sorted(norm(o) for o in item['options']))
        assert qt not in existing_texts, f"Text already exists in {cat_name}: {item['question']}"
        assert item['correct'] in item['options'], f"Correct not in options: {item['question']}"
        by_cat[cat_name].append({
            "id": None, "type_id": by_cat[cat_name][0]['type_id'],
            "category": cat_name,
            "question": item['question'], "options": item['options'], "correct": item['correct'],
        })
        existing.add((qt, opts)); existing_texts.add(qt); added += 1
    return added

print('P3 added:', add_questions('Grammar Part 3', NEW_P3))
print('P7 added:', add_questions('Grammar Part 7', NEW_P7))

# ---------- 5. Rebuild question list in category order and re-ID ----------
final = []
for cat in db['categories']:
    final.extend(by_cat.get(cat['name'], []))
for i, q in enumerate(final, 1):
    q['id'] = i
db['questions'] = final

# ---------- 6. Verify ----------
from collections import Counter
counts = Counter(q['category'] for q in db['questions'])
for cat in db['categories']:
    assert counts[cat['name']] == 100, f"{cat['name']} has {counts[cat['name']]} != 100"
all_keys = [key(q) for q in db['questions']]
assert len(all_keys) == len(set(all_keys)), 'Duplicates remain!'
assert all('\ufffd' not in q['question'] and all('\ufffd' not in o for o in q['options']) for q in db['questions'])
print('Verification passed: 9 categories x 100 unique questions =', len(db['questions']))

# ---------- 7. Save JSON + JS ----------
with open('toeic_database.json', 'w', encoding='utf-8') as f:
    json.dump(db, f, ensure_ascii=False, indent=2)
    f.write('\n')

with open('toeic_data.js', 'w', encoding='utf-8') as f:
    f.write('const TOEIC_DATA = ')
    f.write(json.dumps(db, ensure_ascii=False, indent=2))
    f.write(';\n')

print('Saved toeic_database.json and toeic_data.js')
