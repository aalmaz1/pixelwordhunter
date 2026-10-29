"""Regression tests for the full-test source conversion.

Run with: python3 -m unittest discover -s tests -p 'test_build_toeic_full.py'
"""
import json
import re
import unittest
import zipfile
from pathlib import Path

import build_toeic_full as builder

ROOT = Path(__file__).resolve().parent.parent
BANK = json.loads((ROOT / 'toeic_web_app/toeic_full_tests.json').read_text(encoding='utf-8'))
TESTS = {test['id']: test for test in BANK['tests']}


def item(test_id, part, index):
    test = TESTS[test_id]
    return next(p for p in test['parts'] if p['part'] == part)['items'][index]


class ListeningConversionTests(unittest.TestCase):
    def test_source_markup_is_removed_without_losing_speech_or_numbers(self):
        source = (
            '{conversation}<br/>[M:] <b>(32.) Room 302 costs $32 at 10 A.M.</b>'
            '<br/>{W1:} It holds (50) people and a [projector].'
            '<br/>|W2:-| We should |book it today-|.'
            '<br/>M2: See you in 2026.'
        )
        text, turns = builder.parse_transcript(source, {32})
        self.assertEqual([turn['speaker'] for turn in turns], ['M', 'W1', 'W2', 'M2'])
        self.assertNotIn('(32.)', text)
        self.assertNotIn('conversation', text)
        for phrase in ('Room 302', '$32', '10 A.M.', '(50)', 'projector', 'book it today', '2026'):
            self.assertIn(phrase, text)
        self.assertNotRegex(text, r'[\[\]{}|]')
        self.assertEqual(text, ' '.join(turn['text'] for turn in turns))

    def test_part2_stops_before_vietnamese_for_all_hr_variants(self):
        for separator in ('<hr/>', '<hr />', '<hr>'):
            parsed = builder.parse_part2({
                'hint': 'Can I print?<br/>A. Black<br/>B. Mine<br/>{C. Go ahead.}'
                        + separator + 'Bản dịch<br/>A. Không<br/>B. Có',
            })
            q = parsed['questions'][0]
            self.assertEqual(q['options'], ['Black', 'Mine', 'Go ahead.'])
            self.assertEqual(q['correct'], 'Go ahead.')

    def test_three_reported_questions_have_only_english_options(self):
        expected = {
            11: (['It’s black and white', 'This is not mine', 'No problem. Go ahead.'], 'No problem. Go ahead.'),
            16: (['At the local community center', 'I’ve been assigned the role', 'Oh, so did I'], 'Oh, so did I'),
            19: (['New login information', 'For the corporate function', 'It’s being repaired'], 'It’s being repaired'),
        }
        for number, (options, answer) in expected.items():
            q = item('new_economy_2018_test_05', 2, number - 7)['questions'][0]
            self.assertEqual(q['options'], options)
            self.assertEqual(q['correct'], answer)

    def test_audio_is_clean_and_speaker_turns_are_not_lost(self):
        dialogues = 0
        for test in BANK['tests']:
            for part in test['parts']:
                if part['part'] not in (3, 4):
                    continue
                for parsed in part['items']:
                    with self.subTest(test=test['id'], part=part['part'], item=parsed['itemIndex']):
                        self.assertNotRegex(parsed['audio'], r'\(\s*\d+\s*\.?\s*\)|[\[\]{}|]')
                        self.assertNotRegex(parsed['audio'], r'^(?:conversation|telephone message|announcement)\b')
                        if part['part'] == 3:
                            dialogues += 1
                            self.assertGreaterEqual(len(parsed.get('turns', [])), 2)
                        if parsed.get('turns'):
                            self.assertEqual(parsed['audio'], ' '.join(turn['text'] for turn in parsed['turns']))
                            self.assertTrue(all(turn['speaker'] in {'M', 'W', 'M1', 'M2', 'W1', 'W2'}
                                                for turn in parsed['turns']))
        self.assertEqual(dialogues, 156)

    def test_audited_questions_match_their_dialogues_and_source_graphics(self):
        nutrition = item('new_economy_2018_test_05', 3, 12)
        self.assertEqual(nutrition['questions'][1]['correct'], 'Sugar')
        self.assertIn('Sugar', nutrition['graphic']['html'])
        self.assertIn('sugar', nutrition['turns'][-2]['text'].lower())
        self.assertEqual(nutrition['turns'][-1]['speaker'], 'W')
        self.assertIn('suggest', nutrition['turns'][-1]['text'])
        self.assertEqual(nutrition['questions'][2]['correct'], "Don't drink a lot of caffeine before taking it")

        delivery = item('new_economy_2018_test_08', 3, 8)
        self.assertEqual(delivery['turns'][-1]['speaker'], 'W')
        self.assertIn('cell phone number', delivery['turns'][-1]['text'])
        self.assertEqual(delivery['questions'][2]['correct'], 'His cell phone number')

        facility = item('hacker_new_toeic_test_02', 4, 1)
        self.assertIn('nine months', facility['audio'])
        self.assertIn('nine months', facility['questions'][1]['question'])
        self.assertEqual(facility['questions'][1]['correct'], 'A facility will be completed.')

        bus = item('new_economy_2018_test_02', 4, 2)
        self.assertIn('an hour later', bus['audio'])
        self.assertIn('5:00 P.M.', bus['audio'])
        self.assertIn('expected to arrive', bus['questions'][1]['question'])
        self.assertEqual(bus['questions'][1]['correct'], '6:00 P.M')

        cake = item('actual_test_2026_10', 3, 11)
        self.assertIn('$50', cake['audio'])
        self.assertIn('10 inches', cake['audio'])
        self.assertEqual(cake['graphic']['image'], 'full-toeic-graphics/actual_test_2026_10_67.png')
        self.assertEqual(cake['questions'][2]['correct'], 'Carrot Cake')

    def test_korean_question_explanations_are_matched_by_question_number(self):
        cake = item('actual_test_2026_10', 3, 11)
        for number, question in zip((65, 66, 67), cake['questions']):
            self.assertTrue(question['explanation']['ko'].startswith(f'{number}.'), question)
        # This source's KO questions are from a different set/numbering.
        unrelated = item('hacker_new_toeic_test_02', 3, 11)
        self.assertTrue(all(q['explanation']['ko'] == '' for q in unrelated['questions']))

    def test_every_graphic_matches_its_source_and_apk_asset(self):
        image_count = html_count = 0
        with zipfile.ZipFile(ROOT / 'base.apk') as apk:
            for test in BANK['tests']:
                raw = json.loads((ROOT / 'ALL_TOEIC_TESTS' / f"{test['id']}.json").read_text(encoding='utf-8'))
                for part in test['parts']:
                    if part['part'] not in (3, 4):
                        continue
                    for parsed in part['items']:
                        source = raw[f"part{part['part']}"][parsed['itemIndex']]
                        graphic = parsed.get('graphic', {})
                        source_image = source.get('image') or ''
                        source_html = (source.get('description') or '').strip()
                        if source_image:
                            image_count += 1
                            path = graphic['image']
                            self.assertRegex(path, rf'^full-toeic-graphics/{re.escape(source_image)}\.(jpg|jpeg|png)$')
                            actual = (ROOT / 'public' / path).read_bytes()
                            expected = apk.read('res/drawable-xxxhdpi-v4/' + Path(path).name)
                            self.assertEqual(actual, expected, path)
                        else:
                            self.assertNotIn('image', graphic)
                        if source_html:
                            html_count += 1
                            self.assertEqual(graphic.get('html'), source_html)
                        else:
                            self.assertNotIn('html', graphic)
        self.assertEqual((image_count, html_count), (43, 25))

    def test_rebuild_is_reproducible_and_keeps_every_source_key(self):
        checked = 0
        for test in BANK['tests']:
            source = json.loads((ROOT / 'ALL_TOEIC_TESTS' / f"{test['id']}.json").read_text(encoding='utf-8'))
            rebuilt, warnings = builder.convert_test(source, source_id=test['id'])
            builder.validate(rebuilt, warnings)
            self.assertEqual(warnings, [])
            self.assertEqual(rebuilt, test)
            for part in test['parts']:
                for parsed in part['items']:
                    raw = source[f"part{part['part']}"][parsed['itemIndex']]
                    for index, question in enumerate(parsed['questions']):
                        raw_options = raw['questions'][index]['options']
                        keys = [i for i, opt in enumerate(raw_options) if re.match(r'^key:', opt.strip(), re.I)]
                        self.assertEqual(len(keys), 1)
                        if part['part'] == 2:
                            self.assertEqual(question['correct'], question['options'][keys[0]])
                        else:
                            key = builder.split_correct(raw_options[keys[0]])
                            key = re.sub(r'\{([^{}]*)\}', r'\1', key)
                            source_key = (test['id'], part['part'], parsed['itemIndex'])
                            for old, new in builder.OPTION_CORRECTIONS.get(source_key, []):
                                key = key.replace(old, new)
                            self.assertEqual(question['correct'], key)
                        checked += 1
        self.assertEqual(checked, 2328)


class ReadingExplanationConversionTests(unittest.TestCase):
    def test_numbered_blocks_keep_internal_paragraphs_and_drop_duplicates(self):
        hint = (
            '<b>131 - first</b><br/>First explanation.<br/><br/>Additional detail.'
            '<hr/>133. third<br/>Third explanation.<hr/><p>한국어 지문</p>'
        )
        blocks, passage = builder.numbered_reading_blocks(hint)
        self.assertEqual(set(blocks), {131, 133})
        self.assertIn('Additional detail', blocks[131])
        self.assertNotIn('Third explanation', blocks[131])
        self.assertEqual(passage, '한국어 지문')
        duplicate, _ = builder.numbered_reading_blocks(
            '<b>131. first</b><br/>One<hr/><b>131. repeated</b><br/>Two'
            '<hr/><b>132. next</b><br/>Three'
        )
        self.assertNotIn(131, duplicate)
        self.assertIn(132, duplicate)

    def test_english_explanation_keeps_internal_paragraphs_not_option_lists(self):
        options = ('<b>131. answer</b><br/>first<br/>{answer}<br/>third<br/>fourth'
                   '<br/><br/>The reason the answer fits.')
        self.assertEqual(builder.explanation_from_block(options), 'The reason the answer fits.')
        paragraphs = ('<b>143 - incurring</b><br/>The sentence needs a gerund.'
                      '<br/><br/>Either A or B is parallel.')
        self.assertEqual(builder.explanation_from_block(paragraphs),
                         'The sentence needs a gerund. Either A or B is parallel.')
        self.assertEqual(builder.explanation_from_block('<b>134 - The security office is open.</b>'), '')
        source = item('new_economy_2018_test_05', 6, 3)['questions'][0]
        self.assertIn('need V-ing', source['explanation']['en'])
        self.assertIn('Either A or B', source['explanation']['en'])

    def test_missing_explanations_do_not_shift_to_another_question(self):
        source = {
            'description': 'A passage.',
            'hint': '<b>148. answer</b><br/>Evidence for 148.<hr/><b>149. answer</b><br/>Evidence for 149.',
            'hintKo': '<b>147. answer</b><br/>147번 설명입니다.<hr/><b>149. answer</b><br/>149번 설명입니다.',
            'questions': [
                {'question': f'{n}. Question {n}?', 'options': ['key:correct', 'wrong']}
                for n in (147, 148, 149)
            ],
        }
        questions = builder.parse_part7(source)['questions']
        self.assertEqual(questions[0]['explanation']['en'], '')
        self.assertEqual(questions[1]['explanation']['en'], 'Evidence for 148.')
        self.assertEqual(questions[2]['explanation']['en'], 'Evidence for 149.')
        self.assertIn('147번', questions[0]['explanation']['ko'])
        self.assertEqual(questions[1]['explanation']['ko'], '')
        self.assertIn('149번', questions[2]['explanation']['ko'])

    def test_real_english_and_korean_blocks_follow_source_numbers(self):
        reading = item('new_economy_2018_test_02', 6, 0)['questions']
        self.assertIn('Incorporate sth into sth', reading[1]['explanation']['ko'])
        self.assertIn('교육 주제', reading[2]['explanation']['ko'])
        self.assertNotIn('Incorporate sth into sth', reading[2]['explanation']['ko'])
        self.assertFalse(item('new_economy_2018_test_02', 6, 0)['hasKoPassage'])

        hospital = item('hacker_new_toeic_test_02', 7, 0)['questions']
        self.assertIn('30만 달러', hospital[0]['explanation']['ko'])
        self.assertIn('티켓 4장 이상', hospital[1]['explanation']['ko'])
        self.assertNotIn('30만 달러', hospital[1]['explanation']['ko'])

        history = item('new_economy_2018_test_02', 7, 11)['questions']
        self.assertEqual(history[0]['explanation']['en'], '')  # 181 is absent from the EN hint
        self.assertIn('introductory history course', history[1]['explanation']['en'])  # 182
        self.assertIn('question- and-answer session', history[4]['explanation']['en'])  # 185

        passage = item('actual_test_2026_10', 7, 0)['descriptionKo']
        self.assertIn('Greenleaf 가든 센터', passage)
        self.assertNotIn('참가자들은 무엇을 받게 됩니까?', passage)

    def test_two_verified_korean_header_typos_are_scoped(self):
        spring = item('new_economy_2018_test_10', 7, 3)['questions']
        self.assertEqual(spring[0]['correct'], 'A business park')
        self.assertIn('비즈니스 파크', spring[0]['explanation']['ko'])  # 152 -> 153
        self.assertNotIn('비즈니스 파크', spring[1]['explanation']['ko'])
        hosing = item('new_economy_2018_test_09', 7, 13)['questions']
        self.assertEqual(hosing[2]['correct'], '2,500 yards')
        self.assertIn('2,500야드', hosing[2]['explanation']['ko'])  # 93 -> 193

    def test_misleading_source_evidence_is_corrected_without_changing_keys(self):
        dyer = item('new_economy_2018_test_05', 7, 10)['questions'][3]
        self.assertEqual(dyer['correct'], 'In San Francisco')
        self.assertIn('same department', dyer['explanation']['en'])
        self.assertIn('San Francisco', dyer['explanation']['en'])
        self.assertIn('샌프란시스코', dyer['explanation']['ko'])

        questions = item('new_economy_2018_test_02', 7, 14)['questions']
        self.assertEqual(questions[0]['correct'], 'It does not fit')
        self.assertIn('medium-sized', questions[0]['explanation']['en'])
        self.assertIn('스몰', questions[0]['explanation']['ko'])
        self.assertIn('official members', questions[2]['explanation']['en'])
        self.assertIn('tracking number', questions[2]['explanation']['en'])
        self.assertIn('공식 회원', questions[2]['explanation']['ko'])

    def test_language_fields_do_not_put_korean_in_the_english_explanation(self):
        for test in BANK['tests']:
            for part in test['parts']:
                for parsed in part['items']:
                    for question in parsed['questions']:
                        en = question['explanation'].get('en', '')
                        ko = question['explanation'].get('ko', '')
                        self.assertNotRegex(en, r'[가-힣]', (test['id'], part['part'], question['question']))
                        if part['part'] == 2:
                            self.assertNotRegex(ko, r'[{}|]', (test['id'], question['question']))
                        if part['part'] in (6, 7) and ko:
                            self.assertRegex(ko, r'[가-힣]', (test['id'], part['part'], question['question']))


if __name__ == '__main__':
    unittest.main()
