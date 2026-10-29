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
                            if (test['id'], part['part'], parsed['itemIndex']) == ('new_economy_2018_test_04', 3, 10):
                                self.assertIn('3 barrel nuts', parsed['audio'])
                                source_html = source_html.replace('Barrel Buts', 'Barrel Nuts')
                            self.assertEqual(graphic.get('html'), source_html)
                        else:
                            self.assertNotIn('html', graphic)
        self.assertEqual((image_count, html_count), (43, 25))

    def test_rebuild_is_reproducible_and_only_documented_keys_change(self):
        checked = 0
        seen_revisions = set()
        for test in BANK['tests']:
            source = json.loads((ROOT / 'ALL_TOEIC_TESTS' / f"{test['id']}.json").read_text(encoding='utf-8'))
            rebuilt, warnings = builder.convert_test(source, source_id=test['id'])
            builder.validate(rebuilt, warnings)
            self.assertEqual(warnings, [])
            self.assertEqual(rebuilt, test)
            for part in test['parts']:
                part_no = part['part']
                for parsed in part['items']:
                    raw = source[f'part{part_no}'][parsed['itemIndex']]
                    if part_no in (3, 4, 6, 7):
                        before = builder.PARSERS[part_no](raw, source_id=test['id'], part_no=part_no,
                                                          item_index=parsed['itemIndex'])
                    else:
                        before = builder.PARSERS[part_no](raw)
                    for index, question in enumerate(parsed['questions']):
                        original = before['questions'][index]['correct']
                        number = int(re.match(r'^\s*(\d+)', builder.strip_tags(raw['questions'][index]['question'])).group(1))
                        revision_key = (test['id'], part_no, number)
                        rule = builder.QUESTION_REVISIONS.get(revision_key)
                        if rule:
                            seen_revisions.add(revision_key)
                            self.assertEqual(original, rule['old_answer'], revision_key)
                            grading_changed = any((rule['stem'], rule['replace'], rule['correct'] is not None,
                                                   rule['accepted'] is not None, rule['options'] is not None))
                            self.assertEqual(question.get('answerRevision'), 1 if grading_changed else None, revision_key)
                            self.assertTrue(question['explanation']['en'], revision_key)
                            self.assertRegex(question['explanation']['ko'], r'[가-힣]', revision_key)
                        else:
                            self.assertEqual(question['correct'], original, revision_key)
                            self.assertNotIn('answerRevision', question)
                        checked += 1
        self.assertEqual(checked, 2328)
        self.assertEqual(seen_revisions, set(builder.QUESTION_REVISIONS))


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
        self.assertEqual(questions[2]['correct'], 'She asked to exchange a sweater for a different size.')
        self.assertIn('tracking number', questions[2]['explanation']['en'])
        self.assertIn('회원', questions[2]['explanation']['ko'])

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

class SemanticRevisionTests(unittest.TestCase):
    @staticmethod
    def question(test_id, part, number):
        offset = {2: 7, 3: 32, 4: 71, 5: 101, 6: 131, 7: 147}[part]
        questions = [q for group in next(p for p in TESTS[test_id]['parts'] if p['part'] == part)['items']
                     for q in group['questions']]
        return questions[number - offset]

    def test_incorrect_listening_and_reading_keys(self):
        cases = [
            ('new_economy_2018_test_21', 2, 17, 'Sometime next month, I think.'),
            ('new_economy_2018_test_05', 4, 87, 'Members of the center should come in the afternoon.'),
            ('new_economy_2018_test_20', 3, 67, 'Take a bus'),
            ('new_economy_2018_test_20', 4, 81, 'Take notes on the meeting'),
            ('new_economy_2018_test_21', 3, 55, 'She will cancel her last meeting.'),
            ('new_economy_2018_test_21', 3, 62, 'Inspectors in the building next door'),
            ('new_economy_2018_test_09', 4, 81, 'After-school activities'),
            ('new_economy_2018_test_09', 6, 140, 'must be'),
            ('new_economy_2018_test_09', 7, 195, 'Customer service'),
            ('actual_test_2026_12', 7, 198, 'Her products are sold in sealed jars.'),
            ('hacker_new_toeic_test_02', 7, 195, 'It launched a marketing campaign in the United States.'),
        ]
        for test_id, part, number, expected in cases:
            with self.subTest(test=test_id, part=part, number=number):
                q = self.question(test_id, part, number)
                self.assertEqual(q['correct'], expected)
                self.assertIn(expected, q['options'])
                self.assertTrue(q['explanation']['en'])
                self.assertRegex(q['explanation']['ko'], r'[가-힣]')

    def test_ambiguities_have_all_and_only_supported_choices(self):
        cases = [
            ('hacker_new_toeic_test_02', 2, 28, {"Let's relax here a bit longer.", "OK, if you're done swimming."}),
            ('new_economy_2018_test_02', 5, 118, {'Provided that', 'Seeing that'}),
            ('actual_test_2026_11', 6, 133, {'Approved amounts will be added to the next scheduled paycheck.',
                                             'Receipts should be kept for your personal records.'}),
            ('new_economy_2018_test_04', 3, 63, {'Barrel nuts', 'Allen key'}),
            ('new_economy_2018_test_04', 6, 140, {'estimate', 'calculate'}),
            ('new_economy_2018_test_05', 6, 136, {'over', 'around'}),
            ('new_economy_2018_test_08', 6, 137,
             {'During this time, your temporary workspace will be the first-floor conference room.',
              'If it takes longer, we will notify you.'}),
            ('new_economy_2018_test_10', 3, 70, {'Express-post it to her', 'Deliver it to her'}),
            ('new_economy_2018_test_08', 7, 188, {'main office', 'base'}),
            ('new_economy_2018_test_20', 7, 162, {'A fashion company', 'A clothing shop'}),
            ('new_economy_2018_test_21', 7, 200,
             {'It was a manufacturing defect.', 'Melisa Perkins included her receipt of sale from an authorized Red Rock Leather Goods store.'}),
        ]
        for test_id, part, number, expected in cases:
            with self.subTest(test=test_id, part=part, number=number):
                q = self.question(test_id, part, number)
                self.assertEqual(set(q['acceptedAnswers']), expected)
                self.assertIn(q['correct'], expected)
                self.assertTrue(expected.issubset(q['options']))
                self.assertGreater(len(set(q['options']) - expected), 0)  # rejects at least one
        all_choices = self.question('new_economy_2018_test_04', 6, 142)
        self.assertEqual(set(all_choices['acceptedAnswers']), set(all_choices['options']))
        self.assertTrue(all_choices['unscored'])
        self.assertIn('not scored', all_choices['explanation']['en'])

    def test_changed_questions_remove_unsupported_assumptions(self):
        q = self.question('new_economy_2018_test_20', 4, 99)
        self.assertIn('sign', q['question'])
        self.assertIn('customer service', q['explanation']['en'].lower())
        q = self.question('new_economy_2018_test_04', 4, 99)
        self.assertIn('range of times', q['question'])
        self.assertIn('does not establish', q['explanation']['en'])
        q = self.question('new_economy_2018_test_21', 4, 99)
        self.assertIn('Besides hosting', q['question'])
        self.assertEqual(q['correct'], 'Constellation guide')
        q = self.question('new_economy_2018_test_10', 7, 182)
        self.assertIn('NOT mentioned', q['question'])
        self.assertEqual(q['correct'], 'Hardwood floor polishing')
        q = self.question('new_economy_2018_test_09', 7, 199)
        self.assertEqual(q['correct'], '$25 per person')
        self.assertIn('not given', q['explanation']['en'])

    def test_editorial_audio_and_known_source_warnings(self):
        footnote = item('hacker_new_toeic_test_02', 3, 6)
        self.assertNotIn('*pamphlet', footnote['audio'])
        self.assertNotIn('*handout', footnote['audio'])
        self.assertIn('informational pamphlet', footnote['audio'])
        self.assertEqual(footnote['audio'], ' '.join(turn['text'] for turn in footnote['turns']))
        bus = item('new_economy_2018_test_04', 4, 7)
        self.assertNotIn('d to ons', bus['audio'])
        self.assertIn('Now sit back, relax', bus['audio'])
        landscaping = item('new_economy_2018_test_05', 6, 1)
        self.assertIn('assess the situation', landscaping['description'])
        self.assertNotIn('access the situation', landscaping['description'])
        self.assertNotIn('131. communication', item('new_economy_2018_test_02', 6, 0)['description'])
        self.assertNotIn('(139) ------</span>/', item('new_economy_2018_test_04', 6, 2)['description'])
        self.assertNotIn('as 133. best', item('new_economy_2018_test_09', 6, 0)['description'])
        self.assertIn("five years'", item('new_economy_2018_test_08', 6, 3)['description'])
        self.assertIn('before becoming active', item('new_economy_2018_test_10', 6, 2)['description'])
        cook = item('new_economy_2018_test_20', 6, 1)
        self.assertIn('This schedule could change', cook['description'])
        self.assertIn('이 일정은', cook['descriptionKo'])
        graphic = item('new_economy_2018_test_04', 3, 10)
        self.assertIn('Barrel Nuts', graphic['graphic']['html'])
        self.assertNotIn('Barrel Buts', graphic['graphic']['html'])
        for test_id, part, index in builder.SOURCE_WARNINGS:
            warning = item(test_id, part, index)['sourceWarning']
            self.assertEqual(set(warning), {'en', 'ru', 'ko'})
            self.assertTrue(all(warning.values()))

    def test_revisions_reject_changed_source_data(self):
        question = {'question': "Isn't Mary having a baby?", 'options': [
            "Of course. I'd love to.", 'Sometime next month, I think.', 'No, it was a baby toy.'],
            'correct': 'a different source key', 'explanation': {'en': '', 'ko': ''}}
        with self.assertRaisesRegex(ValueError, 'Source answer no longer matches'):
            builder.apply_question_revision({'audio': question['question']}, question,
                                             ('new_economy_2018_test_21', 2, 17))
        question['correct'] = "Of course. I'd love to."
        question['options'].remove('Sometime next month, I think.')
        with self.assertRaisesRegex(ValueError, 'Invalid revised options'):
            builder.apply_question_revision({'audio': question['question']}, question,
                                             ('new_economy_2018_test_21', 2, 17))
        unsupported = {'question': 'What does the woman suggest?',
                       'options': ['Take the subway', 'Take a bus'],
                       'correct': 'Take the subway', 'explanation': {'en': '', 'ko': ''}}
        with self.assertRaisesRegex(ValueError, 'Revision evidence no longer matches'):
            builder.apply_question_revision({'audio': 'The transcript has changed.'}, unsupported,
                                             ('new_economy_2018_test_20', 3, 67))
        wrong_stem = {'question': 'A different question', 'options': ['It broke this morning.'],
                      'correct': 'It broke this morning.', 'explanation': {'en': '', 'ko': ''}}
        with self.assertRaisesRegex(ValueError, 'Question stem no longer matches'):
            builder.apply_question_revision({'audio': wrong_stem['question']}, wrong_stem,
                                             ('new_economy_2018_test_10', 2, 11))


if __name__ == '__main__':
    unittest.main()
