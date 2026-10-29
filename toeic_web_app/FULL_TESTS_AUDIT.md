# Full-test audit

This audit concerns `toeic_full_tests.json` and the 12 files in
`ALL_TOEIC_TESTS/`, not the separate Part 5 practice bank in `BANK_AUDIT.md`.
The local source files match the copies in the supplied `base.apk`; their
independent provenance, accuracy and redistribution rights have not been
verified. The raw sources are unchanged. `build_toeic_full.py` and
`toeic_full_corrections.py` record the guarded changes applied to the generated
web bank.

## Semantic review and answer corrections

A manual pass examined the available compact listings of all 12 tests, Parts
2–7: listening transcripts, reading passages, question stems, choices and
source keys, together with all 43 image graphics and the HTML graphics. The
source's original audio and an independent official answer key were not
available. This is a broad review of the available material, **not independent
certification that all 2,328 questions, interpretations or translations are
error-free**. Structural tests and source-key agreement cannot establish that.

The question-specific registry `toeic_full_corrections.py` identifies each
revision by source file, part and original question number, records the old key
and explanation/evidence, and describes the supported revision. There are 94
question-level revisions: some correct source keys, others repair ambiguous or
unsupported wording, replace a faulty question, or correct the explanation.
The builder checks the old key and, where used, the exact stem, options and
supporting source fragments before applying a revision. Six questions whose
original options could not be graded from the available context were replaced
with new passage-based questions and distractors; they are adaptations, not
recovered original exam questions.

Examples (question numbers are the original source numbers; the app shuffles
groups and choices):

| Source | Issue | Generated behavior |
| --- | --- | --- |
| New Economy 2018 Test 06 (`test_21`), Part 2 #17 | The source keys an invitation response to a question about Mary's baby. | Accept the expected-time response, “Sometime next month, I think.” |
| New Economy 2018 Test 05, Part 4 #87 | A speaker suggests delaying exercise until after the hot water returns at noon. | Accept coming in the afternoon, not avoiding the center altogether. |
| New Economy 2018 Test 07 (`test_20`), Part 3 #67 | The dialogue explicitly recommends a bus, but the source keys the subway. | Accept “Take a bus.” |
| New Economy 2018 Test 09, Part 6 #140 | Mandatory submission instructions are keyed as “would be.” | Use “must be.” |
| New Economy 2018 Test 09, Part 7 #195 | The source keys “CFO” for a person handling a complaint and exchange. | Use the supported customer-service role. |
| New Economy 2018 Test 04, Part 3 #63 | The woman lacks both barrel nuts and the Allen key, which are separate choices. | Accept either answer and repair the HTML graphic's “Barrel Buts” typo. |
| New Economy 2018 Test 04, Part 6 #142 | All four sentences can coherently close the reply; the source gives no unique basis for selecting one. | Show the ambiguity before answering and exclude the question from accuracy, mistakes and XP. |
| New Economy 2018 Test 09, Part 7 #199 | The total cost cannot be calculated without the staff's work duration. | Replace the unsupported question with one asking for the stated $25-per-person budget. |

Eighteen revised questions have multiple supported choices, including the
one unscored question. For the other 17, each supported choice counts toward
the score and XP and is highlighted after the response; an incorrect response
shows all supported choices in the results. For the unscored item, the selected
choice is shown neutrally, the result counts it separately, and even skipping
it has no effect. Previously stored mistake counts for the 92 questions whose
stem, options or grading changed are cleared once when the bank first loads;
the old records contain only counts, not the selected choices, so they cannot
be regraded. Explanation-only revisions and unrelated mistake records are kept.

## Listening and source conversion corrections

- Part 2, New Economy 2018 Test 05, #11, #16 and #19: stop at the source's
  `<hr/>`; the Vietnamese translation/vocabulary after it is not an answer
  choice. The three English responses and the source key are preserved.
- Parts 3–4: strip the source's bold parenthesized question references and
  pronunciation/highlight markup from the spoken transcript. Only question
  references for the item, plus two specifically documented misnumbered
  references, are removed; ordinary dates, times, amounts and room numbers are
  retained. Braced recording-type headings are not spoken. Sentence splitting
  keeps prices such as `$25.50` and times such as `6:00 P.M.` together.
- Preserve speaker identities as structured turns. New Economy 2018 Test 05
  #70 attributes the shop assistant's suggestion to the woman; Test 08 #58
  attributes the delivery agent's request for a phone number to the woman.
  Both source transcripts label those lines as male even though the questions,
  answers and context identify the woman. The Test 08 excerpt remains abrupt:
  it does not contain an answer to the preceding delivery-time question, and
  no missing speech has been invented.
- Correct obvious source transcription errors, including the research center's
  “nine months” (also confirmed by the corresponding question). A quoted
  appointment sentence and a few misspelled answer options are corrected in
  both locations where needed, without changing the answer's meaning. In New
  Economy 2018 Test 02 Part 4, the bus's original scheduled arrival is 5 P.M.,
  but the source key is 6 P.M. after a one-hour delay. The question now asks for
  the expected arrival, making the passage and preserved key consistent.
- Restore all 43 referenced image files and 25 HTML graphics/descriptions to
  their listening items. The 43 images are byte-for-byte copies of the
  corresponding drawables in `base.apk`. Graphics are available in regular and
  mistake-review runs and are precached for offline use.
- Strip source vocabulary/key markers from Part 2 Korean text. Match listening
  Korean question blocks by their actual source question number and a Korean
  question header; do not attach a different question's translation merely
  because of its position. Some mismatched blocks are omitted.
- Match Part 6–7 English and Korean explanations by numbered headers rather than
  their position. Internal blank lines and missing source blocks no longer shift
  subsequent explanations. Two verified Korean header typos are corrected by
  source item: New Economy Test 09 #193 (`93`) and Test 10 #153 (`152`).
  Preserve English explanatory paragraphs even when they contain blank lines.
  New Economy Test 05 #179 now retains the relevant English evidence instead
  of a Vietnamese vocabulary fragment. Test 02 #196 had misleading evidence;
  #198 is now reworded around the supported sweater-size exchange rather than
  assuming that a tracking number proves membership.
- Remove an appended glossary from Hacker Test 02 #50–52 speech and OCR garbage
  after New Economy Test 04 #92–94; repair locally supported reading defects,
  such as the broken Hacker museum/rail sentence, reversed email headers and a
  repeated schedule row in New Economy Test 02, stray numbered markers, and
  “access the situation” → “assess the situation.”

## Usability and verification

Dialogues use spoken role names because browser synthesis may only have one
voice; the recorded dialogue itself is not available. The displayed transcript
can be hidden or shown, and replay is explicit. A dialogue is not automatically
repeated for each successive question in its group. Part 2 reads its three
response choices in the same order as the displayed buttons. Images can be
opened at full size. The full-test screen scrolls on small viewports. After an
answer, Korean interface users see an available Korean explanation; all other
interface languages see the English explanation. If Korean is unavailable,
English is used with a notice. Missing explanations are reported explicitly,
including in mistake review; no reasoning has been fabricated. Part 5 displays
the question-specific source explanation instead of a generic template. The
bundled Mulmaru font now includes all modern Hangul syllables: the former subset
omitted characters in many Korean explanations on devices without fallback fonts.

The source-key regression compares all 2,328 generated primary answers with
the local keys, except for explicitly registered changes. Additional tests
cover revision evidence and mutation guards, validity of accepted alternatives,
source warnings, neutral unscored items, score/XP, result highlighting and
mistake migration. They also check option counts, transcript cleanup, graphics
and byte identity, speaker examples, Korean question alignment, speech playback
and ordinary/mistake UI flows. These tests guard the implemented decisions;
they are not an external answer key or a proof of semantic correctness.

Remaining limitations:

- Part 1 is not implemented: each test has 194 questions, not 200. The browser
  voice is synthetic, depends on installed voices, and is not an original TOEIC
  recording. Part 3–4 questions are displayed rather than separately voiced.
- Image graphics have a generic accessible label and can be enlarged, but do
  not yet have complete text alternatives for screen readers.
- New Economy 2018 Test 10 #101 and #144 each contain a duplicate choice in
  the supplied source, so each still has only three distinct options. Their
  missing original distractors cannot be recovered from the available files;
  they were not fabricated. These are the only option-count exceptions allowed
  by the bank checks.
- The original source contains no English explanations for its 1,128 Part 2–4
  questions. After adding explanations for reviewed corrections, 1,103
  listening questions, two Part 6 questions and six Part 7 questions still lack
  English explanations. Many listening Korean blocks are translations of the
  question and choices rather than reasoning. An availability notice is shown
  where the selected explanation is absent.
- Korean blocks are aligned by question number rather than independently
  translated or semantically verified. Some items have no matching explanation.
- Localized source notes flag the unresolvable Houston/Denver location, two
  inconsistent invoice totals, an unreadable delivery-guarantee deadline,
  conflicting interview dates, the Actual 2026-12 #67 discount arithmetic,
  nutrient weights exceeding a serving size and two ambiguous time labels in
  images. The two duplicate-choice cases above are flagged too. The original
  correct numbers or missing choices were not reconstructed by guesswork.
