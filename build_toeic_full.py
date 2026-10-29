#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_toeic_full.py — convert ALL_TOEIC_TESTS/*.json into the app's full-test bank.

Each source file is one full TOEIC test (200 questions, parts 1-7). The bank
keeps parts 2-7 (Part 1 picture questions are not implemented in the app):

- listening parts 2-4 keep a clean transcript (`audio`) for speechSynthesis,
  speaker turns when provided, any accompanying graphic or description, and
  matching Korean question blocks where available;
- reading parts 5-7 keep the passage (`description`, HTML) and match English
  and Korean explanation blocks by question number. The source does not supply
  Russian explanations, and not every question has an EN or KO explanation.

Answer keys are marked in the source as `{...}` (parts 2-4, inside the hints)
or `key:` (parts 5-7, inside the options arrays); both are resolved to a plain
`correct` field.

Usage:
    python3 extract_toeic_graphics.py                        # if assets are missing
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

from toeic_full_corrections import QUESTION_REVISIONS

SOURCE_DIR = Path('ALL_TOEIC_TESTS')
OUT_PATH = Path('toeic_web_app/toeic_full_tests.json')
GRAPHICS_DIR = Path('public/full-toeic-graphics')
SKIP_PARTS = {1}          # Part 1 picture questions are not implemented
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


# Two source annotations have the wrong question number.  They are still
# editorial references, not words in the dialogue.  Scope exceptions by stable
# source filename and item index so real spoken numbers are not discarded.
WRONG_TRANSCRIPT_MARKERS = {
    ('new_economy_2018_test_05', 3, 6): {60},  # question 50
    ('new_economy_2018_test_10', 3, 9): {62},  # questions 59-61
}

# Obvious transcription mistakes, kept separate from the unchanged source JSON.
# The question about the research center itself confirms "nine months".
TRANSCRIPT_CORRECTIONS = {
    ('hacker_new_toeic_test_02', 3, 6): [(
        '<br/><br/><b>*pamphlet:</b> a thin book with only a few pages that gives information or an opinion about something'
        '<br/><b>*handout:</b> a document given to students or reporters that contains information about a particular subject',
        '',
    )],
    ('hacker_new_toeic_test_02', 4, 1): [('mine months', 'nine months')],
    ('new_economy_2018_test_04', 4, 7): [("Now d to ons. than e'll to rs ny sit back", 'Now sit back')],
    ('new_economy_2018_test_02', 3, 7): [('on my way to appointment', 'on my way to an appointment')],
    ('new_economy_2018_test_05', 3, 0): [('marketing W department', 'marketing department')],
    ('new_economy_2018_test_05', 3, 6): [("this it month's", "this month's")],
    ('new_economy_2018_test_08', 3, 0): [('training vidoes', 'training videos')],
    ('new_economy_2018_test_10', 3, 0): [
        ('Are you Ms. Joyce, right?', 'You are Ms. Joyce, right?'),
        ('Is is OK', 'Is it OK'),
    ],
    ('new_economy_2018_test_10', 3, 1): [('Are you still at the office.', 'Are you still at the office?')],
}

# A quoted sentence must stay in sync with the transcript correction above.
QUESTION_CORRECTIONS = {
    ('new_economy_2018_test_02', 3, 7): [('on my way to appointment', 'on my way to an appointment')],
    # The original schedule is 5 P.M.; the delayed *expected* arrival is
    # 6 P.M., which is the source key.  Ask for the latter, not the former.
    ('new_economy_2018_test_02', 4, 2): [
        ('What has caused problem?', 'What has caused the problem?'),
        ('when is the bus scheduled to arrive', 'when is the bus expected to arrive'),
    ],
    ('new_economy_2018_test_04', 4, 8): [('goal for monster telecom', 'goal for Monster Telecom')],
}
OPTION_CORRECTIONS = {
    ('hacker_new_toeic_test_02', 3, 10): [('miss event', 'miss the event')],
    ('new_economy_2018_test_04', 3, 2): [
        ('product in formation', 'product information'),
        ('same department as the women', 'same department as the woman'),
    ],
    ('new_economy_2018_test_04', 4, 8): [('number customer calls', 'number of customer calls')],
}

# In Test 05 #70 the shop assistant suggests limiting caffeine.  In Test 08
# #58 the delivery agent asks for the customer's number.  Both questions name
# the woman, but the corresponding final turns are mistakenly marked as M.
SPEAKER_CORRECTIONS = {
    ('new_economy_2018_test_05', 3, 12): (-1, 'M', 'W', 'Our other products'),
    ('new_economy_2018_test_08', 3, 8): (-1, 'M', 'W', 'delivery man call you'),
}

# These two reading questions contain duplicate options in the supplied source.
# The missing original distractors cannot be recovered; do not invent them.
# Keep the build usable but only exempt these exact, documented source defects.
KNOWN_INCOMPLETE_OPTIONS = {
    ('new_economy_2018_test_10', 5, 0, 0): 3,
    ('new_economy_2018_test_10', 6, 3, 1): 3,
}

SPEAKER_RE = re.compile(
    r'(?im)\[\s*([MW]\d?)\s*:\s*\]'
    r'|\{\s*([MW]\d?)\s*:\s*\}'
    r'|\|\s*([MW]\d?)\s*:?\s*-?\s*\|'
    r'|^\s*([MW]\d?)\s*:\s*'
)
BOLD_RE = re.compile(r'(<b\b[^>]*>)(.*?)(</b\s*>)', re.I | re.S)


def remove_question_markers(transcript, numbers):
    """Remove source question references, not dates, prices or room numbers.

    The source marks these references inside bold spans.  Matching both that
    context and the item's question numbers avoids deleting ordinary numbers.
    """
    if not numbers:
        return transcript
    pattern = re.compile(r'\(\s*(?:' + '|'.join(map(str, sorted(numbers))) + r')\s*\.?\s*\)')
    return BOLD_RE.sub(
        lambda m: m.group(1) + pattern.sub('', m.group(2)) + m.group(3),
        transcript,
    )


def clean_transcript_segment(text):
    """Keep highlighted words but discard the source's pronunciation markup."""
    # A final hyphen inside |...-| marks intonation, not a spoken hyphen.
    text = re.sub(r'\|([^|]*)\|', lambda m: m.group(1).removesuffix('-').strip(), text)
    text = re.sub(r'[\[\]{}]', '', text)
    return re.sub(r'\s+', ' ', text).strip()


def parse_transcript(transcript, question_numbers):
    """Return clean speech and structured speaker turns, without raw markers."""
    transcript = remove_question_markers(transcript or '', question_numbers)
    # Braced genre headings describe the recording; they are not spoken lines.
    transcript = re.sub(
        r'^\s*\{(?:conversation|telephone message|announcement|excerpt from a meeting|'
        r'tour guide|speech|introduction|advertisement)\}\s*<br\s*/?>',
        '', transcript, count=1, flags=re.I,
    )
    # Line breaks identify the plain M:/W: labels in some source files.
    transcript = re.sub(r'<br\s*/?>', '\n', transcript, flags=re.I)
    transcript = html.unescape(TAG_RE.sub('', transcript))
    markers = list(SPEAKER_RE.finditer(transcript))
    if not markers:
        return clean_transcript_segment(transcript), []

    turns = []
    prefix = clean_transcript_segment(transcript[:markers[0].start()])
    if prefix:
        turns.append({'speaker': None, 'text': prefix})
    for i, marker in enumerate(markers):
        speaker = next(group.upper() for group in marker.groups() if group)
        end = markers[i + 1].start() if i + 1 < len(markers) else len(transcript)
        text = clean_transcript_segment(transcript[marker.end():end])
        if text:
            turns.append({'speaker': speaker, 'text': text})
    return ' '.join(turn['text'] for turn in turns), turns


def listening_graphic(item):
    """Keep source graphics and fail rather than generating broken image URLs."""
    graphic = {}
    name = (item.get('image') or '').strip()
    if name:
        if not re.fullmatch(r'[A-Za-z0-9_-]+', name):
            raise ValueError(f'Unexpected listening graphic name: {name!r}')
        matches = [GRAPHICS_DIR / f'{name}{ext}' for ext in ('.jpg', '.jpeg', '.png')]
        matches = [path for path in matches if path.is_file()]
        if len(matches) != 1:
            raise FileNotFoundError(
                f'Expected one listening graphic for {name}; run python3 extract_toeic_graphics.py'
            )
        graphic['image'] = f'full-toeic-graphics/{matches[0].name}'
    description = (item.get('description') or '').strip()
    if description:
        graphic['html'] = description
    return graphic


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


def ko_explanation_block(block):
    """KO explanation: drop the answer header, option lines, and {...} markers."""
    out = []
    for line in (block or '').split('<br/>'):
        line = strip_tags(line)
        if not line:
            continue
        if line == '=>' or line == '==':
            continue
        # Keep option lines when they also contain the source's reasoning;
        # dropping the whole line would discard e.g. "(D) ... → most likely".
        if re.match(r'^\s*(?:\([A-D]\)|[A-D]\.)', line) or re.match(r'^\{.*\}$', line):
            if re.search(r'→|->|=>', line):
                out.append(line)
            continue
        if re.match(r'^\s*\d{2,3}\s*[.\-]', line):
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


# Question headers in reading hints.  A double <br/> may occur *inside* an
# explanation as well as between questions, so only split at numbered headers.
READING_HEADER_RE = re.compile(
    r'(?:^|<hr\s*/?>|(?:<br\s*/?>\s*){2,})\s*'
    r'(?P<header>(?:<b\b[^>]*>\s*)?(?P<number>\d{2,3})\s*[.\-]\s*)',
    re.I,
)

# Two Korean headers have a typo, but their answer text and surrounding
# questions confirm the intended numbers.  Never infer a correction by position.
KO_READING_NUMBER_CORRECTIONS = {
    ('new_economy_2018_test_09', 7, 13): {93: 193},   # 2,500 yards
    ('new_economy_2018_test_10', 7, 3): {152: 153},  # A business park
}

# Scoped fixes for a non-English fragment and misleading source snippets.  The
# replacement texts are grounded in the same passages and do not change keys.
READING_EXPLANATION_CORRECTIONS = {
    # The source appends Vietnamese vocabulary after the English evidence.
    ('new_economy_2018_test_05', 7, 10, 179): {
        'correct': 'In San Francisco',
        'evidence': ('Esta Resources in San Francisco', 'we worked in the same department at Esta Resources'),
        'en': 'Cross worked at Esta Resources in San Francisco, and Dyer says they worked in the same department there.',
        'ko': '크로스는 샌프란시스코의 Esta Resources에서 근무했고, 다이어는 같은 부서에서 함께 일했다고 말합니다.',
    },
    ('new_economy_2018_test_02', 7, 14, 196): {
        'correct': 'It does not fit',
        'evidence': ('medium-sized', 'small-sized'),
        'en': 'She ordered a medium-sized sweater but received a small-sized one.',
        'ko': '그녀는 미디엄 사이즈 스웨터를 주문했지만 스몰 사이즈를 받았습니다.',
    },
    ('new_economy_2018_test_02', 7, 14, 198): {
        'correct': 'She has a Four Seasons Apprarel Outlet membership.',
        'evidence': ('Individuals with official memberships', 'Your shipment can be tracked'),
        'en': 'Shipment tracking is available to official members, and the email provides her with a tracking number.',
        'ko': '배송 추적 서비스는 공식 회원이 이용할 수 있으며, 이메일은 그녀에게 추적 번호를 제공합니다.',
    },
}


def numbered_reading_blocks(hint):
    """Return numbered hint blocks and any separate passage, not positional slices.

    A missing or duplicate number must not shift another question's explanation.
    Passage text can occur before the first header or after the last <hr/>.
    """
    hint = hint or ''
    matches = list(READING_HEADER_RE.finditer(hint))
    if not matches:
        return {}, ''
    blocks, duplicates = {}, set()
    passage = strip_tags(hint[:matches[0].start()])
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(hint)
        # An unnumbered <hr/> after the block starts a separate passage.
        separator = re.search(r'<hr\s*/?>', hint[match.end():end], re.I)
        if separator:
            split = match.end() + separator.start()
            passage = passage or strip_tags(hint[split + len(separator.group()):end])
            end = split
        number = int(match.group('number'))
        if number in blocks:
            blocks.pop(number)
            duplicates.add(number)
        elif number not in duplicates:
            blocks[number] = hint[match.start('header'):end].strip()
    return blocks, passage


def reading_explanation_blocks(item, source_key):
    en_blocks, _ = numbered_reading_blocks(item.get('hint', ''))
    ko_blocks, ko_passage = numbered_reading_blocks(item.get('hintKo', ''))
    numbers = set()
    for question in item.get('questions', []):
        match = re.match(r'^\s*(\d+)\b', strip_tags(question.get('question', '')))
        if match:
            numbers.add(int(match.group(1)))
    for wrong, right in KO_READING_NUMBER_CORRECTIONS.get(source_key, {}).items():
        if wrong not in ko_blocks or right in ko_blocks or right not in numbers:
            raise ValueError(f'Korean header correction no longer matches {source_key}: {wrong} -> {right}')
        ko_blocks[right] = ko_blocks.pop(wrong)
    # A passage before the questions can itself be English, not a translation.
    if not re.search(r'[가-힣]', ko_passage):
        ko_passage = ''
    return en_blocks, ko_blocks, ko_passage


def reading_explanations(number, correct, en_blocks, ko_blocks, item, source_key):
    en = explanation_from_block(en_blocks[number]) if number in en_blocks else ''
    ko = ko_explanation_from_block(ko_blocks[number]) if number in ko_blocks else ''
    if not re.search(r'[가-힣]', ko):
        ko = ''
    correction = READING_EXPLANATION_CORRECTIONS.get((*source_key, number))
    if correction:
        description = strip_tags(item.get('description', ''))
        if correct != correction['correct'] or not all(s in description for s in correction['evidence']):
            raise ValueError(f'Reading explanation correction no longer matches {source_key}, question {number}')
        en, ko = correction['en'], correction['ko']
    return {'en': en, 'ko': ko}


def explanation_from_block(block):
    """Extract EN text without mistaking an internal paragraph for options.

    Some headers are followed by four answer choices before the explanation;
    others begin explaining immediately and use blank lines within that text.
    """
    first_break = re.search(r'<br\s*/?>', block, re.I)
    if not first_break:
        return ''  # A header containing only the answer is not an explanation.
    body = block[first_break.end():]
    paragraph_break = re.search(r'(?:<br\s*/?>\s*){2,}', body, re.I)
    if paragraph_break:
        first_paragraph = body[:paragraph_break.start()]
        lines = [strip_tags(line) for line in re.split(r'<br\s*/?>', first_paragraph, flags=re.I)]
        lines = [line for line in lines if line]
        marked_choice = any(re.fullmatch(r'(?:[A-D]\.\s*)?\{.*\}', line) for line in lines)
        lettered_choices = sum(bool(re.match(r'^\s*[A-D]\.\s*', line)) for line in lines)
        if len(lines) >= 2 and (marked_choice or lettered_choices >= 2):
            body = body[paragraph_break.end():]
    return strip_tags(body)


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
    # The English question and options precede <hr/>.  In three source items
    # everything after it is Vietnamese translation/vocabulary, not choices.
    hint = re.split(r'<hr\s*/?>', hint, maxsplit=1, flags=re.I)[0]
    lines = [line.strip() for line in re.split(r'<br\s*/?>', hint, flags=re.I) if line.strip()]
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
    ko = strip_vocab_markers(ko)
    return {
        'audio': question,
        'questions': [{
            'question': question,
            'options': options,
            'correct': correct[0],
            'explanation': {'en': '', 'ko': ko},
        }],
    }


def korean_listening_blocks(hint):
    """Index only Korean question blocks by their own source question number.

    Some hints contain the English questions followed by a Korean transcript;
    others contain unrelated/misnumbered translations.  Positional assignment
    can show a different question as the explanation, so omit uncertain blocks.
    """
    blocks = re.split(r'<hr\s*/?>|(?:<br\s*/?>\s*){2,}', hint or '', flags=re.I)
    results = {}
    for block in blocks:
        first_line = re.split(r'<br\s*/?>', block, maxsplit=1, flags=re.I)[0]
        header = strip_tags(first_line)
        match = re.match(r'^(\d{2,3})\s*[.\-]\s*(.*)', header)
        if match and re.search(r'[가-힣]', match.group(2)):
            results.setdefault(int(match.group(1)), strip_vocab_markers(strip_tags(block)))
    return results


def parse_part34(item, source_id='', part_no=0, item_index=-1):
    hint = item.get('hint', '') or ''
    transcript, question_blocks = split_question_blocks(hint)
    source_key = (source_id, part_no, item_index)
    for original, replacement in TRANSCRIPT_CORRECTIONS.get(source_key, []):
        if original not in transcript:
            raise ValueError(f'Transcript correction no longer matches {source_key}: {original!r}')
        transcript = transcript.replace(original, replacement)
    question_numbers = set()
    for raw_question in item.get('questions', []):
        match = re.match(r'^\s*(\d+)\.', strip_tags(raw_question.get('question', '')))
        if match:
            question_numbers.add(int(match.group(1)))
    question_numbers.update(WRONG_TRANSCRIPT_MARKERS.get(source_key, set()))
    transcript, turns = parse_transcript(transcript, question_numbers)
    if source_key in SPEAKER_CORRECTIONS:
        index, original, replacement, evidence = SPEAKER_CORRECTIONS[source_key]
        if not turns or turns[index]['speaker'] != original or evidence not in turns[index]['text']:
            raise ValueError(f'Speaker correction no longer matches {source_key}')
        turns[index]['speaker'] = replacement
        # A correction can turn two adjacent source fragments into one turn.
        merged = []
        for turn in turns:
            if merged and turn['speaker'] and merged[-1]['speaker'] == turn['speaker']:
                merged[-1]['text'] += ' ' + turn['text']
            else:
                merged.append(turn)
        turns = merged
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
    for original, replacement in QUESTION_CORRECTIONS.get(source_key, []):
        if not any(original in q['question'] for q in questions):
            raise ValueError(f'Question correction no longer matches {source_key}: {original!r}')
        for q in questions:
            q['question'] = q['question'].replace(original, replacement)
    for original, replacement in OPTION_CORRECTIONS.get(source_key, []):
        if not any(original in option for q in questions for option in q['options']):
            raise ValueError(f'Option correction no longer matches {source_key}: {original!r}')
        for q in questions:
            q['options'] = [option.replace(original, replacement) for option in q['options']]
            if q['correct']:
                q['correct'] = q['correct'].replace(original, replacement)
    if not transcript or not questions:
        return None
    # Match Korean question blocks by number, never by their position among
    # English questions and translated transcripts.
    ko_blocks = korean_listening_blocks(item.get('hintKo', ''))
    for raw_question, q in zip(item.get('questions', []), questions):
        match = re.match(r'^\s*(\d+)\.', strip_tags(raw_question.get('question', '')))
        if match:
            q['explanation']['ko'] = ko_blocks.get(int(match.group(1)), '')
    parsed = {'audio': transcript, 'questions': questions}
    if turns:
        parsed['turns'] = turns
    graphic = listening_graphic(item)
    if graphic:
        parsed['graphic'] = graphic
    return parsed


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


def parse_part6(item, source_id='', part_no=6, item_index=-1):
    description = item.get('description', '') or ''
    # Wrap every blank in a span so the app can highlight the current one.
    # Supports both (131) ------ and ---(131.)--- formats.
    _g = lambda m: m.group(1) or m.group(2) or m.group(4)
    description = BLANK_SPAN_RE.sub(
        lambda m: f'<span class="toeic-blank" data-blank="{_g(m)}">({_g(m)}) ------</span>',
        description,
    )
    source_key = (source_id, part_no, item_index)
    en_blocks, ko_blocks, ko_passage = reading_explanation_blocks(item, source_key)
    questions = []
    for q in item.get('questions', []):
        n = q.get('question', '').strip().rstrip('.')
        number = int(n) if n.isdigit() else None
        options = []
        correct = [None]
        for o in q.get('options', []):
            add_option(options, correct, o)
        options = [re.sub(r'\{([^{}]*)\}', r'\1', o) for o in options]
        if correct[0]:
            correct[0] = re.sub(r'\{([^{}]*)\}', r'\1', correct[0])
        if not options:
            continue
        questions.append({
            'question': f'{n}. ____',
            'options': options,
            'correct': correct[0],
            'explanation': reading_explanations(number, correct[0], en_blocks, ko_blocks, item, source_key),
        })
    if not questions:
        return None
    has_en = sum(1 for q in questions if q['explanation']['en'].strip()) == len(questions)
    return {'description': description, 'descriptionKo': ko_passage, 'hasKoPassage': bool(ko_passage), 'hasEnExplanation': has_en, 'questions': questions}


def parse_part7(item, source_id='', part_no=7, item_index=-1):
    description = item.get('description', '') or ''
    source_key = (source_id, part_no, item_index)
    en_blocks, ko_blocks, ko_passage = reading_explanation_blocks(item, source_key)
    questions = []
    for q in item.get('questions', []):
        raw_stem = strip_tags(q.get('question', ''))
        match = re.match(r'^\s*(\d+)\.', raw_stem)
        number = int(match.group(1)) if match else None
        stem = NUM_PREFIX_RE.sub('', raw_stem).strip()
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
            'explanation': reading_explanations(number, correct[0], en_blocks, ko_blocks, item, source_key),
        })
    if not questions:
        return None
    has_en = sum(1 for q in questions if q['explanation']['en'].strip()) == len(questions)
    return {'description': description, 'descriptionKo': ko_passage, 'hasKoPassage': bool(ko_passage), 'hasEnExplanation': has_en, 'questions': questions}


PARSERS = {2: parse_part2, 3: parse_part34, 4: parse_part34, 5: parse_part5, 6: parse_part6, 7: parse_part7}


# These source defects cannot be resolved safely from the local material. Show
# a notice in the exercise itself instead of silently inventing image values.
SOURCE_WARNINGS = {
    ('actual_test_2026_12', 3, 11): {
        'en': 'Source note: the receipt’s recorded discount does not match the stated promotion. The qualifying service is still identifiable.',
        'ru': 'Примечание: скидка в чеке не совпадает с условиями акции. При этом нужную услугу можно определить.',
        'ko': '원본 주의: 영수증의 할인액이 안내된 할인 조건과 일치하지 않습니다. 해당 서비스는 확인할 수 있습니다.',
    },
    ('new_economy_2018_test_09', 3, 11): {
        'en': 'Source note: the graphic’s nutrient weights exceed the stated serving size; the original values cannot be verified.',
        'ru': 'Примечание: сумма веществ на изображении превышает размер порции. Проверить исходные значения невозможно.',
        'ko': '원본 주의: 그림의 영양소 중량 합계가 1회 제공량보다 큽니다. 원래 수치를 확인할 수 없습니다.',
    },
    ('new_economy_2018_test_21', 3, 10): {
        'en': 'Source note: one time range in the graphic appears to use an inconsistent A.M. label.',
        'ru': 'Примечание: в одном из интервалов изображения обозначение A.M., вероятно, указано ошибочно.',
        'ko': '원본 주의: 그림의 한 시간대에 오전 표기가 잘못된 것으로 보입니다.',
    },
    ('new_economy_2018_test_21', 4, 9): {
        'en': 'Source note: the graphic labels midnight as 12:00 P.M.; interpret the timeline with care.',
        'ru': 'Примечание: на изображении полночь обозначена как 12:00 P.M.; внимательно изучите расписание.',
        'ko': '원본 주의: 그림은 자정을 12:00 P.M.으로 표기하므로 시간표를 주의해서 확인하세요.',
    },
    ('hacker_new_toeic_test_02', 7, 13): {
        'en': 'Source note: the invoice total does not equal the listed charges. The original figures cannot be verified.',
        'ru': 'Примечание: итог в счёте не равен сумме указанных услуг. Исходные числа проверить невозможно.',
        'ko': '원본 주의: 청구서의 합계가 기재된 금액의 합과 다릅니다. 원래 수치를 확인할 수 없습니다.',
    },
    ('new_economy_2018_test_02', 6, 1): {
        'en': 'Source note: the advertisement identifies both Houston and Denver as its location; the intended city cannot be confirmed.',
        'ru': 'Примечание: в объявлении указаны и Хьюстон, и Денвер; установить нужный город нельзя.',
        'ko': '원본 주의: 광고에 휴스턴과 덴버가 모두 등장합니다. 어느 도시가 맞는지 확인할 수 없습니다.',
    },
    ('new_economy_2018_test_02', 7, 10): {
        'en': 'Source note: the invoice total conflicts with its itemized charges, and the delivery-guarantee deadline is unreadable.',
        'ru': 'Примечание: итог счёта расходится с суммой позиций, а срок гарантированной доставки невозможно прочитать.',
        'ko': '원본 주의: 청구서 합계가 세부 금액의 합과 다르고 배송 보장 기한을 읽기 어렵습니다.',
    },
    ('new_economy_2018_test_04', 7, 10): {
        'en': 'Source note: the email is dated after the stated interview date; the intended date cannot be confirmed.',
        'ru': 'Примечание: письмо датировано позже указанного собеседования; правильную дату установить нельзя.',
        'ko': '원본 주의: 이메일 날짜가 명시된 면접일보다 늦습니다. 원래 날짜는 확인할 수 없습니다.',
    },
    ('new_economy_2018_test_10', 5, 0): {
        'en': 'Source note: one answer choice was duplicated in the source; only three distinct choices are available.',
        'ru': 'Примечание: один вариант в источнике повторяется, поэтому доступны только три разных ответа.',
        'ko': '원본 주의: 선택지 하나가 중복되어 서로 다른 선택지가 세 개뿐입니다.',
    },
    ('new_economy_2018_test_10', 6, 3): {
        'en': 'Source note: one answer choice in this passage was duplicated; the original missing choice is unavailable.',
        'ru': 'Примечание: один вариант в этом тексте повторяется; восстановить недостающий вариант нельзя.',
        'ko': '원본 주의: 이 지문의 선택지 하나가 중복되어 빠진 선택지를 복원할 수 없습니다.',
    },
}


def replace_once(value, old, new, key):
    if value.count(old) != 1:
        raise ValueError(f'Source correction no longer matches {key}: {old!r}')
    return value.replace(old, new, 1)


def correct_source_item(parsed, source_key):
    """Repair locally supported source defects under explicit guards."""
    if source_key == ('new_economy_2018_test_05', 6, 1):
        parsed['description'] = replace_once(
            parsed['description'], 'stop by and access the situation',
            'stop by and assess the situation', source_key)
    if source_key == ('new_economy_2018_test_02', 6, 0):
        parsed['description'] = replace_once(
            parsed['description'], 'computer skills, 131. communication strategies',
            'computer skills, communication strategies', source_key)
    if source_key == ('new_economy_2018_test_04', 6, 2):
        parsed['description'] = replace_once(
            parsed['description'], '(139) ------</span>/', '(139) ------</span>', source_key)
    if source_key == ('new_economy_2018_test_09', 6, 0):
        parsed['description'] = replace_once(
            parsed['description'], 'their customers as 133. best they can',
            'their customers as best they can', source_key)
    if source_key == ('new_economy_2018_test_08', 6, 3):
        parsed['description'] = replace_once(
            parsed['description'], "five year's", "five years'", source_key)
    if source_key == ('new_economy_2018_test_10', 6, 2):
        parsed['description'] = replace_once(
            parsed['description'], 'before coming active', 'before becoming active', source_key)
    if source_key == ('new_economy_2018_test_20', 6, 1):
        # The preceding keyed sentence offers weekday shifts and only asks
        # applicants to be willing to work weekends; no weekend schedule exists.
        parsed['description'] = replace_once(
            parsed['description'], 'This weekend schedule could change',
            'This schedule could change', source_key)
        if parsed.get('descriptionKo'):
            parsed['descriptionKo'] = replace_once(
                parsed['descriptionKo'], '이 주말 일정은', '이 일정은', source_key)
    if source_key == ('new_economy_2018_test_04', 3, 10):
        parsed['graphic']['html'] = replace_once(
            parsed['graphic']['html'], 'Barrel Buts', 'Barrel Nuts', source_key)
    if source_key == ('hacker_new_toeic_test_02', 7, 9):
        parsed['description'] = replace_once(
            parsed['description'],
            'The new Sanchez Museum of Iberian Art and its nearby conference facilities to rail services from Valancia to Madrid and Barcelona have reduced travel time significantly.',
            'The new Sanchez Museum of Iberian Art and its nearby conference facilities are among these factors. Improvements to rail services from Valencia to Madrid and Barcelona have reduced travel time significantly.',
            source_key,
        )
    if source_key == ('new_economy_2018_test_02', 7, 12):
        description = parsed['description']
        # The table repeats this exact row verbatim; the reply references the
        # same media lab, identified as room 202 twice in that table.
        rows = re.findall(r'<tr>[^<]*<td[^>]*>April 16 5:00 P\.M\.</td>.*?</tr>', description)
        if len(rows) != 2 or rows[0] != rows[1] or rows[0] + rows[1] not in description:
            raise ValueError(f'Duplicate schedule row no longer matches {source_key}')
        description = description.replace(rows[0] + rows[1], rows[0], 1)
        description = replace_once(description, 'this is room 3A.', 'this is room 202.', source_key)
        old_header = ("<b>To: </b>Richard White &lt;rwhite@newtonlibrary.edu&gt;<br/>"
                      "<b>From: </b>Linda Carter &lt;lcarter121 @seprus.com&gt;<br/>"
                      "<b>Date: </b>April 2")
        new_header = ("<b>To: </b>Linda Carter &lt;lcarter121 @seprus.com&gt;<br/>"
                      "<b>From: </b>Richard White &lt;rwhite@newtonlibrary.edu&gt;<br/>"
                      "<b>Date: </b>April 2")
        parsed['description'] = replace_once(description, old_header, new_header, source_key)
    if source_key == ('new_economy_2018_test_02', 7, 14):
        old_header = ("<b>To: </b>Sally Nelson &lt;snelson@clandon.net&gt;<br/>"
                      "<b>From: </b>Debra Clarke &lt;debraclarke@fourseasons.com&gt;<br/>"
                      "<b>Date: </b>May 4")
        new_header = ("<b>To: </b>Debra Clarke &lt;debraclarke@fourseasons.com&gt;<br/>"
                      "<b>From: </b>Sally Nelson &lt;snelson@clandon.net&gt;<br/>"
                      "<b>Date: </b>May 4")
        parsed['description'] = replace_once(parsed['description'], old_header, new_header, source_key)
    if source_key in SOURCE_WARNINGS:
        parsed['sourceWarning'] = SOURCE_WARNINGS[source_key].copy()


def apply_question_revision(parsed, question, key):
    rule = QUESTION_REVISIONS.get(key)
    if not rule:
        return
    if question['correct'] != rule['old_answer']:
        raise ValueError(f'Source answer no longer matches revision {key}')
    context = ' '.join([
        parsed.get('audio', ''), strip_tags(parsed.get('description', '')),
        strip_tags(parsed.get('graphic', {}).get('html', '')), question['question'],
    ])
    for fragment in rule['evidence']:
        if fragment not in context:
            raise ValueError(f'Revision evidence no longer matches {key}: {fragment!r}')
    if rule['stem']:
        old, new = rule['stem']
        if question['question'] != old:
            raise ValueError(f'Question stem no longer matches revision {key}')
        question['question'] = new
        if parsed.get('audio') == old:  # Part 2 speaks the question itself.
            parsed['audio'] = new
    for old, new in rule['replace'].items():
        if question['options'].count(old) != 1:
            raise ValueError(f'Option no longer matches revision {key}: {old!r}')
        question['options'] = [new if option == old else option for option in question['options']]
        if question['correct'] == old:
            question['correct'] = new
    if rule['options'] is not None:
        question['options'] = rule['options'][:]
    if rule['correct'] is not None:
        question['correct'] = rule['correct']
    if question['correct'] not in question['options'] or len(set(question['options'])) != len(question['options']):
        raise ValueError(f'Invalid revised options or primary answer {key}')
    if rule['accepted'] is not None:
        accepted = rule['accepted'][:]
        if (len(accepted) < 2 or len(set(accepted)) != len(accepted)
                or question['correct'] not in accepted
                or any(answer not in question['options'] for answer in accepted)):
            raise ValueError(f'Invalid accepted answers {key}')
        question['acceptedAnswers'] = accepted
        # If every option works, there is no meaningful single-answer grade.
        if len(accepted) == len(question['options']):
            question['unscored'] = True
    for lang in ('en', 'ko'):
        if rule[lang] is not None:
            question['explanation'][lang] = rule[lang]
    # Older local mistake records contain only counts, not the selected answer.
    # Clear them only when the stem, options or grading changed; explanation-only
    # edits do not invalidate a learner's existing mistake history.
    if any((rule['stem'], rule['replace'], rule['correct'] is not None,
            rule['accepted'] is not None, rule['options'] is not None)):
        question['answerRevision'] = 1


def convert_test(data, source_id=''):
    test = {
        'id': source_id or data.get('testName', '').lower().replace(' ', '_').replace('-', '_'),
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
            if part_no in (3, 4, 6, 7):
                parsed = PARSERS[part_no](item, source_id=source_id, part_no=part_no, item_index=idx)
            else:
                parsed = PARSERS[part_no](item)
            if parsed is None:
                warnings.append(f'{test["id"]} part {part_no} item {idx}: unparseable')
                continue
            source_key = (source_id, part_no, idx)
            correct_source_item(parsed, source_key)
            raw_questions = item.get('questions', [])
            if len(raw_questions) != len(parsed['questions']):
                raise ValueError(f'Question alignment no longer matches {source_key}')
            for raw_question, question in zip(raw_questions, parsed['questions']):
                match = re.match(r'^\s*(\d+)\b', strip_tags(raw_question.get('question', '')))
                if not match:
                    raise ValueError(f'Missing source question number in {source_key}')
                apply_question_revision(parsed, question, (source_id, part_no, int(match.group(1))))
            if 'hasEnExplanation' in parsed:
                parsed['hasEnExplanation'] = all(q['explanation']['en'].strip() for q in parsed['questions'])
            parsed['itemIndex'] = idx
            part['items'].append(parsed)
        test['parts'].append(part)
    return test, warnings


def count_questions(test):
    return sum(len(it.get('questions', [])) for p in test['parts'] for it in p['items'])


def validate(test, warnings):
    for p in test['parts']:
        for it in p['items']:
            for q_index, q in enumerate(it.get('questions', [])):
                if not q.get('question', '').strip():
                    warnings.append(f'{test["id"]} p{p["part"]}: empty question')
                if not q.get('options'):
                    warnings.append(f'{test["id"]} p{p["part"]}: no options')
                expected_options = 3 if p['part'] == 2 else 4
                count = len(q.get('options', []))
                source_key = (test['id'], p['part'], it['itemIndex'], q_index)
                if count != expected_options and KNOWN_INCOMPLETE_OPTIONS.get(source_key) != count:
                    warnings.append(
                        f'{test["id"]} p{p["part"]} item {it["itemIndex"]}: '
                        f'{count} options (expected {expected_options})'
                    )
                if q.get('correct') not in q.get('options', []):
                    warnings.append(f'{test["id"]} p{p["part"]}: correct answer missing from options')
                if len([o for o in q.get('options', []) if o == q.get('correct')]) != 1:
                    warnings.append(f'{test["id"]} p{p["part"]}: ambiguous primary key')
                accepted = q.get('acceptedAnswers')
                if accepted is not None and (
                    len(accepted) < 2 or len(set(accepted)) != len(accepted)
                    or q.get('correct') not in accepted
                    or any(answer not in q.get('options', []) for answer in accepted)
                ):
                    warnings.append(f'{test["id"]} p{p["part"]}: invalid accepted answers')
                if bool(q.get('unscored')) != bool(accepted and set(accepted) == set(q.get('options', []))):
                    warnings.append(f'{test["id"]} p{p["part"]}: inconsistent unscored question')
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
        test, warnings = convert_test(data, source_id=path.stem)
        validate(test, warnings)
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
