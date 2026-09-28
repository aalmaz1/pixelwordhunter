# -*- coding: utf-8 -*-
"""
rebuild_bank.py — clean-up pass over the TOEIC question bank.

See toeic_web_app/BANK_AUDIT.md for the findings this script fixes:

1. normalises the blank marker to "____" and fixes the spacing around it;
2. strips stray spaces, collapses double spaces, removes spaces before
   punctuation and repairs the misspelled / glued words;
3. replaces every non-TOEIC item (dictionary definitions, "Which sentence is
   correct ?" drills), the duplicates and the items with mangled options with
   new business-context items from rebuild_items.py;
4. renames the nine sets to what they actually are (Part 5 practice sets);
5. rewrites toeic_database.json and the standalone copy toeic_data.js, then
   runs a self-check.

Run from the repository root:  python3 toeic_web_app/rebuild_bank.py
"""
import io
import json
import re
import sys

sys.path.insert(0, 'toeic_web_app')
from rebuild_items import REPLACEMENTS  # noqa: E402
from rebuild_items_b import REST  # noqa: E402
from rebuild_items_c import REPAIRS  # noqa: E402

_overlap = (set(REPLACEMENTS) & set(REST)) | (set(REPLACEMENTS) & set(REPAIRS)) | (set(REST) & set(REPAIRS))
assert not _overlap, 'duplicate replacement ids: %s' % sorted(_overlap)
REPLACEMENTS.update(REST)

JSON_PATH = 'toeic_web_app/toeic_database.json'
JS_PATH = 'toeic_web_app/toeic_data.js'

PART_NAMES = {
    1: 'Part 5 \u00b7 Set 1',
    2: 'Part 5 \u00b7 Set 2',
    3: 'Part 5 \u00b7 Set 3',
    4: 'Part 5 \u00b7 Set 4',
    5: 'Part 5 \u00b7 Set 5',
    6: 'Part 5 \u00b7 Set 6',
    7: 'Part 5 \u00b7 Set 7',
    8: 'Part 5 \u00b7 Set 8',
    9: 'Part 5 \u00b7 Set 9',
}

WORD_FIXES = {
    'untill': 'until',
    'inspite': 'in spite',
    'biggger': 'bigger',
    'fullfill': 'fulfill',
    'succcess': 'success',
    'specfications': 'specifications',
    'excercises': 'exercises',
    'profitablity': 'profitability',
    'challeges': 'challenges',
    'immensy': 'immensely',
    'dteriorated': 'deteriorated',
    'reliablity': 'reliability',
    'angred': 'angered',
    'orbitted': 'orbited',
    'monitered': 'monitored',
    'oftening': 'softening',
    'occured': 'occurred',
    'retentioned': 'retained',
}

GLUED_FIXES = {
    'finallymade': 'finally made',
    'thecapital': 'the capital',
    'theytook': 'they took',
    'tocommon': 'to common',
    'officeby': 'office by',
    'expecthim': 'expect him',
    'bywednesday': 'by Wednesday',
    'canexperience': 'can experience',
    'providefor': 'provide for',
    'nothave': 'not have',
    'mustbe': 'must be',
    'newpatients': 'new patients',
    'discountwill': 'discount will',
    'jointhe': 'join the',
    'twocars': 'two cars',
    'officein': 'office in',
    'identificatio': 'identification',
    'evening.The': 'evening. The',
    'Ms.Ruble': 'Ms. Ruble',
    'software____________with': 'software ____ with',
    'byWednesday': 'by Wednesday',
}

# questions that stay in the bank but need a sentence-level repair
SENTENCE_FIXES = {
    80: ("The soccer team always performs ____ warm-up exercises before starting the game.", None),
    126: ("At the meeting, the CEO, Mr. Petterson, spoke ____ about sustaining the current high level of growth until well into the next term.",
          None),
    134: ("Trendy Fashions Corporation is ____ bigger than its domestic competitors, which gives the company greater financial flexibility.",
          None),
    140: ("Gerber Corporation emerged as the most ____ brand in a recent survey, with 97% of respondents expressing their satisfaction with the products of the company.",
          ["reliability", "thanked", "trusted", "grateful"]),
    148: ("The software ____ with the notebook computer enables people to create documents and calculations.",
          None),
    426: ("We consider the results ____.", None),
    520: ("The company's CEO has implemented the company's ____ procedures for employees in accordance with the law.", None),
    590: ("____ signs that Mr. Francos was softening his stance towards the protesting employees.",
          None),
    593: ("RDA Ltd. ____ applications for the position of System Coordinator. For a detailed position announcement, visit our website.",
          None),
    594: ("Surprisingly, Gertz Ltd., ____ is an established company, got a government contract.",
          None),
    595: ("____ the graphic designer call, please tell him that I am tied up today and that I will call back tomorrow.",
          None),
    596: ("The department's secretariat will be at your ____ should you need any assistance.", None),
    677: ("Mr. Morgan is out of the office right now, ____ I expect him back shortly.", None),
    3: ("The supervisor looked ____ of the office window at the delivery van.", None),
    846: ("Analysts said the strong dollar was mainly ____ for the fall in exports.", None),
    696: ("People who buy alcohol are ____ to have proper identification.", None),
}

# repeated options and non-words that survive the mechanical pass
OPTION_FIXES = {
    70: {3: 'desirably'},
    102: {3: 'were written'},
    149: {3: 'assertion'},
    229: {2: 'map at'},
    248: {0: 'unfold', 1: 'uncover', 2: 'unpack'},
    675: {3: 'makeover'},
    846: {0: 'responsible', 1: 'instrumental', 2: 'important', 3: 'essential'},
    849: {0: 'taking on', 1: 'take on', 2: 'takes on', 3: 'taken on'},
}

# the key of an item whose sentence was rewritten above
CORRECT_FIXES = {
    846: 'responsible',
}


def fix_text(text):
    for wrong, right in GLUED_FIXES.items():
        # \b keeps a fix like "identificatio" from mangling "identification"
        text = re.sub(r'\b%s\b' % re.escape(wrong), right, text)
    for wrong, right in WORD_FIXES.items():
        text = re.sub(r'\b%s\b' % re.escape(wrong), right, text)
    # normalise the blank marker and its spacing
    text = re.sub(r'_{2,}', '____', text)
    text = re.sub(r'(\S)____', r'\1 ____', text)
    text = re.sub(r'____(\S)', r'____ \1', text)
    text = re.sub(r'\s+([?!.,;:])', r'\1', text)
    text = re.sub(r'\s{2,}', ' ', text)
    return text.strip()


def main():
    with io.open(JSON_PATH, encoding='utf-8') as f:
        bank = json.load(f)

    replacements = 0
    replacements_per_part = {}
    for q in bank['questions']:
        qid = q['id']
        q['category'] = PART_NAMES[q['type_id']]

        if qid in REPAIRS:
            sentence, options, correct = REPAIRS[qid]
            q['question'] = fix_text(sentence)
            q['options'] = [fix_text(o) for o in options]
            q['correct'] = fix_text(correct)
            continue

        if qid in REPLACEMENTS:
            sentence, options, correct = REPLACEMENTS[qid]
            q['question'] = fix_text(sentence)
            q['options'] = [fix_text(o) for o in options]
            q['correct'] = fix_text(correct)
            # rotate the options so the keys of the new items are spread over
            # all four positions instead of piling up in the first slot
            slot = replacements_per_part.get(q['type_id'], 0) % 4
            replacements_per_part[q['type_id']] = slot + 1
            index = q['options'].index(q['correct'])
            shift = (slot - index) % 4
            q['options'] = q['options'][shift:] + q['options'][:shift]
            replacements += 1
            continue

        if qid in SENTENCE_FIXES:
            sentence, options = SENTENCE_FIXES[qid]
            q['question'] = fix_text(sentence)
            if options:
                q['options'] = options

        q['question'] = fix_text(q['question'])
        q['options'] = [fix_text(o) for o in q['options']]
        q['correct'] = fix_text(q['correct'])

        for index, value in OPTION_FIXES.get(qid, {}).items():
            q['options'][index] = value

        if qid in CORRECT_FIXES:
            q['correct'] = CORRECT_FIXES[qid]

    for category in bank['categories']:
        category['name'] = PART_NAMES[category['id']]

    # ---- self-check --------------------------------------------------------
    problems = []
    seen = {}
    for q in bank['questions']:
        if not q['question'].strip():
            problems.append('empty stem #%s' % q['id'])
        if len(q['options']) != 4:
            problems.append('#%s has %s options' % (q['id'], len(q['options'])))
        if q['correct'] not in q['options']:
            problems.append('#%s key is not among its options' % q['id'])
        if len(set(q['options'])) != 4:
            problems.append('#%s repeats an option' % q['id'])
        if any(not o.strip() for o in q['options']):
            problems.append('#%s has an empty option' % q['id'])
        if re.search(r'[a-z]{2,}____|____[a-z]{2,}', q['question']):
            problems.append('#%s has a glued blank' % q['id'])
        if q['question'] != q['question'].strip() or any(o != o.strip() for o in q['options']):
            problems.append('#%s has stray spaces' % q['id'])
        key = '%s|%s' % (q['question'].lower(), '|'.join(sorted(q['options'])))
        if key in seen:
            problems.append('#%s duplicates #%s' % (q['id'], seen[key]))
        seen[key] = q['id']
        if q['correct'] not in q['question'] and '____' not in q['question']:
            problems.append('#%s has no blank' % q['id'])

    counts = {}
    for q in bank['questions']:
        counts[q['type_id']] = counts.get(q['type_id'], 0) + 1

    if problems:
        print('SELF-CHECK FAILED:')
        for p in problems[:40]:
            print('  -', p)
        raise SystemExit(1)

    with io.open(JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(bank, f, ensure_ascii=False, indent=2)
        f.write('\n')

    with io.open(JS_PATH, 'w', encoding='utf-8') as f:
        f.write('/* eslint-disable no-unused-vars -- loaded by index.html via a plain <script> tag (standalone app) */\n')
        f.write('const TOEIC_DATA = ')
        json.dump(bank, f, ensure_ascii=False, indent=2)
        f.write(';\n')

    print('replacements applied:', replacements)
    print('questions per part:', json.dumps(counts))
    print('total questions:', len(bank['questions']))
    print('self-check: OK')


if __name__ == '__main__':
    main()
