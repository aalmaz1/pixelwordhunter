#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_toeic_full.py — convert ALL_TOEIC_TESTS/*.json into the app's full-test bank.

Each source file is one full TOEIC test (200 questions, parts 1-7). The bank
keeps parts 2-7 (part 1 needs the picture files that are not in the repo):

- listening parts 2-4 keep the transcript (`audio`) so the app can voice it
  with speechSynthesis;
- reading parts 5-7 keep the passage (`description`, HTML) and per-question
  explanations. The source data carries explanations in EN and KO only (no
  Russian), so the bank keeps those two languages.

Answer keys are marked in the source as `{...}` (parts 2-4, inside the hints)
or `key:` (parts 5-7, inside the options arrays); both are resolved to a plain
`correct` field.

Usage:
    python3 build_toeic_full.py --only actual_test_2026_10   # one test (prototype)
    python3 build_toeic_full.py --all                        # all source files

Output: toeic_web_app/toeic_full_tests.json
"""
import argparse
import html
import json
import re
import sys
from pathlib import Path

SOURCE_DIR = Path('ALL_TOEIC_TESTS')
OUT_PATH = Path('toeic_web_app/toeic_full_tests.json')
SKIP_PARTS = {1}          # picture questions — no image files in the repo
EXPECTED_PARTS = [2, 3, 4, 5, 6, 7]
EXPECTED_QUESTIONS = 194  # 200 minus the 6 picture questions

TAG_RE = re.compile(r'<[^>]+>')
OPT_PREFIX_RE = re.compile(r'^\s*[A-D]\.\s+')
LETTER_PREFIX_RE = re.compile(r'^\s*\([A-D]\)\s*')
NUM_PREFIX_RE = re.compile(r'^\s*\d+\.\s*')


def strip_tags(s):
    # <br> is a line break — keep it as a space; inline tags vanish entirely so
    # "Times</i>." does not become "Times .".
    s = re.sub(r'<br\s*/?>', ' ', s or '')
    s = TAG_RE.sub('', s)
    s = html.unescape(s)
    return re.sub(r'\s+', ' ', s).strip()


def clean_transcript(s):
    """Transcript for speechSynthesis: tags off, speaker labels removed,
    question-number markers like (32) / (71) stripped so TTS doesn't
    read them as numbers."""
    s = re.sub(r'<br\s*/?>', ' ', s or '')
    s = TAG_RE.sub('', s)
    s = html.unescape(s)
    s = s.replace('[M:]', ' ').replace('{W:}', ' ').replace('[W:]', ' ').replace('{M:}', ' ')
    # Remove question-number markers like (32), (71), (100) — these are
    # question anchors, not spoken content.
    s = re.sub(r'\(\d{1,3}\)', '', s)
    # Remove ellipsis artifacts that break TTS prosody
    s = s.replace(' . . . ', ', ')
    return re.sub(r'\s+', ' ', s).strip()


def clean_option(o):
    o = strip_tags(o)
    o = LETTER_PREFIX_RE.sub('', o)
    o = OPT_PREFIX_RE.sub('', o)
    return o.strip()


def split_correct(o):
    """Pull the answer out of `{...}` or `key:` marked options."""
    o = (o or '').strip()
    m = re.match(r'^\{(.*)\}$', o, re.S)
    if m:
        return clean_option(m.group(1))
    m = re.match(r'^key:\s*(.*)$', o, re.I)
    if m:
        return clean_option(m.group(1))
    return None


def add_option(options, correct_holder, line):
    opt = clean_option(line)
    c = split_correct(line)
    if c:
        if correct_holder[0] is None:
            correct_holder[0] = c
        # Show the cleaned answer text, not the `{key:...}` marked original.
        opt = c
    if opt and opt not in options:
        options.append(opt)


def parse_question_block(block):
    """One hint block: `<b>N. question</b><br/>opt<br/>{opt}<br/>...`."""
    block = (block or '').strip()
    if not block:
        return None
    lines = [l.strip() for l in block.split('<br/>') if l.strip()]
    if not lines:
        return None
    stem = NUM_PREFIX_RE.sub('', strip_tags(lines[0])).strip()
    options = []
    correct = [None]
    for line in lines[1:]:
        add_option(options, correct, line)
    if not stem or not options:
        return None
    return {
        'question': stem,
        'options': options,
        'correct': correct[0],
        'explanation': {'en': '', 'ko': ''},
    }


def explanation_after_options(block):
    """EN explanation = text after the options block (`<br/><br/>`)."""
    idx = block.find('<br/><br/>')
    if idx == -1:
        return ''
    return strip_tags(block[idx + len('<br/><br/>'):])


def ko_explanation_block(block):
    """KO explanation: drop the answer header, option lines, and {...} markers."""
    out = []
    for line in (block or '').split('<br/>'):
        line = strip_tags(line)
        if not line:
            continue
        if line == '=>' or line == '==':
            continue
        if LETTER_PREFIX_RE.match(line):
            continue
        if OPT_PREFIX_RE.match(line):
            continue
        if NUM_PREFIX_RE.match(line):
            continue
        if re.match(r'^\{.*\}$', line):
            continue
        out.append(line)
    return ' '.join(out)


def strip_vocab_markers(text):
    """Remove |...| stress markers and {...} vocabulary highlights."""
    text = re.sub(r'\|([^|]*)\|', r'\1', text)
    text = re.sub(r'\{([^{}]*)\}', r'\1', text)
    return text


def key_position(options):
    """Return the index of the `key:` marker in an options array, or None."""
    for i, o in enumerate(options):
        if isinstance(o, str) and re.match(r'^key:', o.strip(), re.I):
            return i
    return None


def split_question_blocks(hint):
    """Split a parts 3-4 hint into (transcript, [question_blocks]).

    Handles three formats:
    - canonical:  <hr/> separates transcript from question blocks
    - brbr:       <hr/> separates transcript from questions, <br/><br/> between questions
    - hacker:     hint is transcript only, questions live in the questions[] array
    """
    blocks = hint.split('<hr/>')
    transcript = blocks[0] if blocks else ''
    question_blocks = []
    for block in blocks[1:]:
        for sub in block.split('<br/><br/>'):
            sub = sub.strip()
            if sub:
                question_blocks.append(sub)
    return transcript, question_blocks


def split_en_blocks(hint):
    """Split an EN hint into explanation blocks for parts 6-7.

    Canonical: <hr/> separates blocks (each has options + <br/><br/> + explanation).
    brbr/hacker: <br/><br/> separates blocks (each is one explanation).
    """
    if '<hr/>' in hint:
        return [b.strip() for b in hint.split('<hr/>') if b.strip()]
    return [b.strip() for b in hint.split('<br/><br/>') if b.strip()]


def split_ko_blocks(hint_ko, num_questions):
    """Split a KO hint into (passage, [per_question_blocks]).

    Handles passage at start (brbr format) or end (canonical format).
    KO blocks use single <br/> within, so further <br/><br/> split is safe.
    """
    if '<hr/>' in hint_ko:
        raw_blocks = hint_ko.split('<hr/>')
    else:
        raw_blocks = hint_ko.split('<br/><br/>')
    blocks = []
    for block in raw_blocks:
        for sub in block.split('<br/><br/>'):
            sub = sub.strip()
            if sub:
                blocks.append(sub)
    ko_passage = ''
    # Passage at start: first block without a question number
    if blocks and not re.match(r'^\s*\d{3}', strip_tags(blocks[0])):
        ko_passage = strip_tags(blocks[0])
        blocks = blocks[1:]
    # Passage at end: extra blocks after the questions
    if len(blocks) > num_questions:
        extra = strip_tags(' '.join(blocks[num_questions:]))
        ko_passage = ko_passage or extra
        blocks = blocks[:num_questions]
    return ko_passage, blocks


def explanation_from_block(block):
    """Extract EN explanation from a hint block.

    Canonical: text after <br/><br/> within the block (separates options from explanation).
    brbr/hacker: the whole block is the explanation (no <br/><br/> within).
    new_economy p7: no <br/><br/> — explanation follows the answer on the next line.
    """
    exp = explanation_after_options(block)
    if exp:
        return exp
    # Fallback: take everything after the first <br/> (strips the <b>N. answer</b> header).
    idx = block.find('<br/>')
    if idx != -1:
        return strip_tags(block[idx + len('<br/>'):])
    return strip_tags(block)


def ko_explanation_from_block(block):
    """Extract KO explanation from a hint block.

    Handles => separator (hacker format separates EN ref from KO translation).
    Drops option lines, answer headers, and {...} markers.
    """
    if '=>' in block:
        block = block.split('=>', 1)[1]
    exp = ko_explanation_block(block)
    if exp:
        return exp
    return strip_tags(block)


def parse_part2(item):
    hint = item.get('hint', '') or ''
    lines = [l.strip() for l in hint.split('<br/>') if l.strip()]
    if not lines:
        return None
    question = NUM_PREFIX_RE.sub('', strip_tags(lines[0])).strip()
    question = strip_vocab_markers(question)
    options = []
    correct = [None]
    for line in lines[1:]:
        add_option(options, correct, line)
    # Clean inline {...} vocabulary highlights from option text (hacker format)
    options = [re.sub(r'\{([^{}]*)\}', r'\1', o) for o in options]
    if correct[0]:
        correct[0] = re.sub(r'\{([^{}]*)\}', r'\1', correct[0])
    if not question or not options:
        return None
    # If the hint did not provide a {...} answer marker (hacker format marks
    # vocabulary with {...} instead), fall back to the key: position in the
    # questions[] array.
    if correct[0] is None:
        qarr = item.get('questions', [])
        if qarr:
            kpos = key_position(qarr[0].get('options', []))
            if kpos is not None and 0 <= kpos < len(options):
                correct[0] = options[kpos]
    if correct[0] is None:
        return None
    # KO: the hint is EN content, then `<br/><br/>`, then the KO translation.
    hint_ko = item.get('hintKo', '') or ''
    idx = hint_ko.find('<br/><br/>')
    ko = strip_tags(hint_ko[idx + len('<br/><br/>'):]) if idx != -1 else strip_tags(hint_ko)
    return {
        'audio': question,
        'questions': [{
            'question': question,
            'options': options,
            'correct': correct[0],
            'explanation': {'en': '', 'ko': ko},
        }],
    }


def parse_part34(item):
    hint = item.get('hint', '') or ''
    transcript, question_blocks = split_question_blocks(hint)
    transcript = clean_transcript(transcript)
    questions = []
    for block in question_blocks:
        q = parse_question_block(block)
        if q:
            questions.append(q)
    # Hacker format: hint is transcript only — questions live in the questions[]
    # array with key: markers on the correct option.
    if not questions:
        qarr = item.get('questions', [])
        for q in qarr:
            stem = NUM_PREFIX_RE.sub('', strip_tags(q.get('question', ''))).strip()
            stem = strip_vocab_markers(stem)
            options = []
            correct = [None]
            for o in q.get('options', []):
                add_option(options, correct, o)
            options = [re.sub(r'\{([^{}]*)\}', r'\1', o) for o in options]
            if correct[0]:
                correct[0] = re.sub(r'\{([^{}]*)\}', r'\1', correct[0])
            if not stem or not options:
                continue
            questions.append({
                'question': stem,
                'options': options,
                'correct': correct[0],
                'explanation': {'en': '', 'ko': ''},
            })
    if not transcript or not questions:
        return None
    # KO: split hintKo into blocks and assign per-question KO explanations.
    hint_ko = item.get('hintKo', '') or ''
    ko_blocks = hint_ko.split('<hr/>') if '<hr/>' in hint_ko else hint_ko.split('<br/><br/>')
    ko_blocks = [b.strip() for b in ko_blocks if b.strip()]
    # Find the first KO question block (contains Hangul and a question number)
    ko_start = next(
        (i for i, b in enumerate(ko_blocks)
         if re.search(r'[가-힣]', b) and re.match(r'^\s*\d{2,3}\s*[-.]', strip_tags(b))),
        len(ko_blocks),
    )
    for i, q in enumerate(questions):
        ko_idx = ko_start + i
        if ko_idx < len(ko_blocks):
            q['explanation']['ko'] = strip_tags(ko_blocks[ko_idx])
    return {'audio': transcript, 'questions': questions}


def parse_part5(item):
    q = item['questions'][0]
    stem = NUM_PREFIX_RE.sub('', strip_tags(q.get('question', ''))).strip()
    stem = strip_vocab_markers(stem)
    options = []
    correct = [None]
    for o in q.get('options', []):
        add_option(options, correct, o)
    options = [re.sub(r'\{([^{}]*)\}', r'\1', o) for o in options]
    if correct[0]:
        correct[0] = re.sub(r'\{([^{}]*)\}', r'\1', correct[0])
    if not stem or not options:
        return None
    tip = item.get('tip', '') or ''
    tip_ko = item.get('tipKo', '') or ''
    has_en = bool(strip_tags(tip).strip())
    return {
        'hasEnExplanation': has_en,
        'questions': [{
            'question': stem,
            'options': options,
            'correct': correct[0],
            'explanation': {'en': strip_tags(tip), 'ko': strip_tags(tip_ko)},
        }],
    }


BLANK_SPAN_RE = re.compile(r'\((\d{3})\)[-\s]*-{2,}|-{2,}\(?(\d{3})\.?\)?(-{2,})?|(\d{3})\s*_{2,}')


def parse_part6(item):
    description = item.get('description', '') or ''
    # Wrap every blank in a span so the app can highlight the current one.
    # Supports both (131) ------ and ---(131.)--- formats.
    _g = lambda m: m.group(1) or m.group(2) or m.group(4)
    description = BLANK_SPAN_RE.sub(
        lambda m: f'<span class="toeic-blank" data-blank="{_g(m)}">({_g(m)}) ------</span>',
        description,
    )
    hint = item.get('hint', '') or ''
    hint_ko = item.get('hintKo', '') or ''
    en_blocks = split_en_blocks(hint)
    questions = []
    for j, q in enumerate(item.get('questions', [])):
        n = q.get('question', '').strip().rstrip('.')
        options = []
        correct = [None]
        for o in q.get('options', []):
            add_option(options, correct, o)
        options = [re.sub(r'\{([^{}]*)\}', r'\1', o) for o in options]
        if correct[0]:
            correct[0] = re.sub(r'\{([^{}]*)\}', r'\1', correct[0])
        if not options:
            continue
        exp_en = ''
        if j < len(en_blocks):
            exp_en = explanation_from_block(en_blocks[j])
        questions.append({
            'question': f'{n}. ____',
            'options': options,
            'correct': correct[0],
            'explanation': {'en': exp_en, 'ko': ''},
        })
    if not questions:
        return None
    # KO: split hintKo and assign per-question KO explanations + KO passage.
    ko_passage, ko_blocks = split_ko_blocks(hint_ko, len(questions))
    for j, q in enumerate(questions):
        if j < len(ko_blocks):
            q['explanation']['ko'] = ko_explanation_from_block(ko_blocks[j])
    has_en = sum(1 for q in questions if q['explanation']['en'].strip()) == len(questions)
    return {'description': description, 'descriptionKo': ko_passage, 'hasKoPassage': bool(ko_passage), 'hasEnExplanation': has_en, 'questions': questions}


def parse_part7(item):
    description = item.get('description', '') or ''
    hint = item.get('hint', '') or ''
    hint_ko = item.get('hintKo', '') or ''
    en_blocks = split_en_blocks(hint)
    questions = []
    for j, q in enumerate(item.get('questions', [])):
        stem = NUM_PREFIX_RE.sub('', strip_tags(q.get('question', ''))).strip()
        stem = strip_vocab_markers(stem)
        options = []
        correct = [None]
        for o in q.get('options', []):
            add_option(options, correct, o)
        options = [re.sub(r'\{([^{}]*)\}', r'\1', o) for o in options]
        if correct[0]:
            correct[0] = re.sub(r'\{([^{}]*)\}', r'\1', correct[0])
        if not stem or not options:
            continue
        exp_en = ''
        if j < len(en_blocks):
            exp_en = explanation_from_block(en_blocks[j])
        questions.append({
            'question': stem,
            'options': options,
            'correct': correct[0],
            'explanation': {'en': exp_en, 'ko': ''},
        })
    if not questions:
        return None
    # KO: split hintKo and assign per-question KO explanations + KO passage.
    ko_passage, ko_blocks = split_ko_blocks(hint_ko, len(questions))
    for j, q in enumerate(questions):
        if j < len(ko_blocks):
            q['explanation']['ko'] = ko_explanation_from_block(ko_blocks[j])
    has_en = sum(1 for q in questions if q['explanation']['en'].strip()) == len(questions)
    return {'description': description, 'descriptionKo': ko_passage, 'hasKoPassage': bool(ko_passage), 'hasEnExplanation': has_en, 'questions': questions}


PARSERS = {2: parse_part2, 3: parse_part34, 4: parse_part34, 5: parse_part5, 6: parse_part6, 7: parse_part7}


def convert_test(data):
    test = {
        'id': data.get('testName', '').lower().replace(' ', '_').replace('-', '_'),
        'name': data.get('testName', 'Untitled'),
        'targetScore': data.get('targetScore', ''),
        'parts': [],
        'hasKo': bool(re.search(r'[가-힣]', json.dumps(data, ensure_ascii=False))),
    }
    warnings = []
    for part_no in EXPECTED_PARTS:
        raw_items = data.get(f'part{part_no}', [])
        if not raw_items:
            warnings.append(f'{test["id"]} part {part_no}: no items')
            continue
        part = {'part': part_no, 'type': 'listening' if part_no <= 4 else 'reading', 'items': []}
        for idx, item in enumerate(raw_items):
            parsed = PARSERS[part_no](item)
            if parsed is None:
                warnings.append(f'{test["id"]} part {part_no} item {idx}: unparseable')
                continue
            parsed['itemIndex'] = idx
            part['items'].append(parsed)
        test['parts'].append(part)
    return test, warnings


def count_questions(test):
    return sum(len(it.get('questions', [])) for p in test['parts'] for it in p['items'])


def validate(test, warnings):
    for p in test['parts']:
        for it in p['items']:
            for q in it.get('questions', []):
                if not q.get('question', '').strip():
                    warnings.append(f'{test["id"]} p{p["part"]}: empty question')
                if not q.get('options'):
                    warnings.append(f'{test["id"]} p{p["part"]}: no options')
                if q.get('correct') not in q.get('options', []):
                    warnings.append(f'{test["id"]} p{p["part"]}: correct answer missing from options')
                if len([o for o in q.get('options', []) if o == q.get('correct')]) != 1:
                    warnings.append(f'{test["id"]} p{p["part"]}: ambiguous key')
    n = count_questions(test)
    if n != EXPECTED_QUESTIONS:
        warnings.append(f'{test["id"]}: {n} questions (expected {EXPECTED_QUESTIONS})')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', metavar='FILE', help='convert a single source file (stem)')
    ap.add_argument('--all', action='store_true', help='convert every source file')
    args = ap.parse_args()

    if args.only:
        files = [SOURCE_DIR / f'{args.only}.json']
        if not files[0].exists():
            print(f'Source file not found: {files[0]}', file=sys.stderr)
            return 1
    elif args.all:
        files = sorted(SOURCE_DIR.glob('*.json'))
    else:
        ap.error('specify --only FILE or --all')

    tests = []
    all_warnings = []
    for path in files:
        with open(path, encoding='utf-8') as f:
            data = json.load(f)
        test, warnings = convert_test(data)
        validate(test, warnings)
        test['id'] = path.stem  # stable id from the filename
        tests.append(test)
        all_warnings.extend(warnings)
        print(f'{path.name}: {test["name"]} — {count_questions(test)} questions')

    if all_warnings:
        print('\nWARNINGS:', file=sys.stderr)
        for w in all_warnings:
            print(f'  - {w}', file=sys.stderr)

    out = {'tests': tests}
    OUT_PATH.write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'\nWrote {OUT_PATH} ({OUT_PATH.stat().st_size / 1024:.1f} KB, {len(tests)} test(s))')
    if all_warnings:
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
