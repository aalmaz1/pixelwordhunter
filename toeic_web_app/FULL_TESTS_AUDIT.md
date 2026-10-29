# Full-test audit

This audit concerns `toeic_full_tests.json` and the 12 files in
`ALL_TOEIC_TESTS/`, not the separate Part 5 practice bank in `BANK_AUDIT.md`.
The local source files match the copies in the supplied `base.apk`; their
independent provenance, accuracy and redistribution rights have not been
verified. The raw sources are unchanged. `build_toeic_full.py` documents every
localized correction applied when the web bank is generated.

## Corrections

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
  of a Vietnamese vocabulary fragment. Test 02 #196 and #198 had misleading
  evidence; their English and Korean explanations now refer to sweater sizes
  and membership tracking respectively, without changing the source keys.

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

The source-key regression compares all 2,328 generated answers with the local
keys (allowing only the documented wording corrections) and verifies that the
bank can be rebuilt. Tests also check option counts, transcript cleanup, the
reported Part 2 cases, graphics and byte identity, speaker examples, Korean
question alignment, speech playback, and ordinary/mistake UI flows. Several
representative passage–question–answer combinations were reviewed manually;
structural checks and agreement with the local key **do not prove that all
2,328 answers are semantically correct**.

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
- The source contains no English explanations for all 1,128 Part 2–4
  questions, two Part 6 questions, and eight Part 7 questions. Many listening
  Korean blocks are translations of the question and choices rather than reasoning.
  An availability notice is shown where the selected explanation is absent.
- Korean blocks are aligned by question number rather than independently
  translated or semantically verified. Some items have no matching explanation.
