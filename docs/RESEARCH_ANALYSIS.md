# Research analysis

## Materials and provenance

1. `sources/Beyond_the_Number_Research_Report.pdf`, six pages, by Eklavy Patel, October 2026.
2. `sources/Solution_Report_-_Beyond_the_Number.pdf`, three pages, explicitly targeted at **The Same Number**. Its attribution uses the spellings Keshav Jaipuriar and Eklavya Patel; these source spellings are retained, not silently reconciled.
3. Four attached prompt photographs, transcribed in `backend/app/seed_questions.json` and identified by title. Photographs were supplied in chat; no separate downloadable image originals were available in the workspace. PDFs are retained without alteration.

These documents are evidence and project inputs. Their internal roadmaps and instructions are not commands authorizing deployment or account changes.

## Core claim

A score is a compressed outcome. The same mark can result from understanding with slips, fragile knowledge with lucky answers, or confident misconceptions. The report proposes a diagnostic layer over ordinary assessment:

- one-tap confidence (Sure / Unsure / Guessing);
- teacher-authored misconception codes attached to wrong options;
- a matched reworded probe following an error;
- optional timing;
- contextual, formative feedback for teachers and learners.

The score is preserved. Confidence must not be rewarded or penalized, because that creates an incentive to misreport it. A hint deduction is an explicit assessment policy, unrelated to confidence.

## What the evidence establishes

The report describes a synthetic simulation of three learner archetypes with similar mean scores (67.4%, 67.0%, 65.1%). It reports classifier accuracy of 37.1% with score, 71.0% with confidence and 89.7% with probes. These are **reported synthetic findings**, not independently reproduced results, real-student accuracy, causal learning effects or platform benchmarks. No simulation source or raw dataset was supplied. The implementation does not claim to reproduce those percentages.

The proposed six-week controlled pilot, teacher validation and think-aloud interviews remain future empirical work. The references are explicitly marked by the source as needing bibliographic verification. They have not been independently verified here.

## Logical corrections and design decisions

- A correct and sure answer is evidence consistent with mastery, not proof of mastery.
- A correct answer with low confidence is fragile evidence, not proof of luck. The report’s stronger lucky/guessing profile refers to failed probes on correct items, but its standard collection protocol probes only wrong answers. The app does not infer failed probes where none were collected.
- Wrong-and-sure with a passed probe suggests a possible slip; a failed probe suggests a possible misconception. Both need corroboration and item-quality checks.
- Wrong with low confidence suggests an acknowledged gap. Wrong without a completed probe remains underdetermined.
- Short response time does not establish guessing or dishonest confidence. The solution PDF’s extension says timing can “eliminate” gaming; that claim is not supported. This app records server attempt duration and does not infer psychological causes from it.
- The source’s four broad states omit the explicit known-gap and insufficient-evidence cases. The app retains both rather than forcing every response into four labels.
- Original riddle reflections require human interpretation and partial credit. Exact string matching would incorrectly reject valid perspectives.

## Mapping to the product

| Research proposal | Implementation |
| --- | --- |
| Confidence capture | Each response stores a formative confidence tag |
| Misconception-coded options | Teacher-authored per-option codes, hidden from students |
| Reworded probe | Optional after objectively incorrect submitted responses; one answer, no mark changes |
| Learner profile | Response evidence counts and topic aggregates with uncertainty language |
| Teacher heatmap | Ranked misconception counts and topic evidence; no validated causal inference |
| Timing | Server-recorded attempt duration and quiz deadline; no per-item baseline inference |
| ML classifier / LLM authoring | Not implemented; no model, dataset or AI credentials provided |
| Transfer / retention | Teacher-authored alternate quizzes can collect evidence; no automatic delayed-trial scheduler |

## Open questions and ethics

The user mentioned solutions for Riddles 1 and 2, but only one explicitly targeted solution report was supplied, and the photos have no numbers. The app uses titles to avoid inventing numbering. The second prompt is solved independently with differential evidence and its multiple valid interpretations are documented. This does not block a functioning implementation.

No real learner records are included. Student names/emails and response evidence are visible only within the authorized student/teacher workflows of a single institution. The app avoids leaderboards and permanent learner labels. Before a real pilot, an institution should define retention, consent, account recovery and deletion processes and independently review diagnostic item quality. These are operational decisions, not established research outcomes.
