# Four riddles: solutions, reasoning and assessment

The source photographs contain titles rather than numbers. The ordering below follows a conceptual progression and is an editorial index, not an original source numbering. Full transcriptions are preserved in `backend/app/seed_questions.json`. These are open-ended design questions. The solutions below are defensible arguments; alternate reasoned answers should receive rubric credit.

## 1. The Same Number

**Question:** What does a learner understand that a number cannot show, and who is let down when the number is all we look at?

**Provided solution, independently checked:** collect confidence, misconception-coded options and a matched reworded probe, then provide targeted formative feedback alongside the mark. The PDF solution directly addresses this title.

**Reasoning:** a scoring function maps many response histories to one scalar. This map is not injective. For example, knowledge plus a misread and a guessed answer can generate the same correctness vector. Correctness alone cannot uniquely recover the hidden cause. Confidence, explanation and probes add evidence that separates some hypotheses. A student with slips needs different support from a student with fragile knowledge; a teacher seeing only the mean cannot select either intervention reliably.

**Verification:** the non-identifiability claim follows from constructing two different causal histories with the same observed score. Additional signals are useful only when their likelihoods differ between histories. They never guarantee identification: self-report is noisy and a probe can also be guessed.

**Rubric / 10:** 2 equal marks versus unequal understanding; 3 distinct processes; 3 additional evidence and uncertainty; 2 affected learners/teachers. Seeded reflection is teacher graded.

## 2. One Error, Several Stories

**Question:** A mistaken rule, missed condition and lack of time yield the same wrong answer. What evidence is needed before choosing a story?

**Independent solution:** keep a small differential diagnosis rather than a verdict. Ask for one reasoning step or a restatement of the condition. Offer a matched reworded item, potentially without time pressure. Inspect whether the original item was reached and how timing was recorded. Invite the learner to challenge the interpretation.

| Hypothesis | Discriminating observation | Interpretation and remaining ambiguity |
| --- | --- | --- |
| Mistaken rule | Same systematic reasoning recurs across equivalent items | Supports a misconception; could still reflect poor instruction or a flawed item |
| Missed condition | Restates the missing condition and solves a parallel task | Supports a reading/execution slip; chance and item difficulty remain alternatives |
| Out of time | Original work incomplete; untimed continuation succeeds | Supports a time constraint; prior exposure can also improve performance |

**Algorithm:** enumerate hypotheses; predict different observations; gather the cheapest useful evidence with consent; update confidence in each; take a reversible teaching action or collect more evidence if needed. Do not assign arbitrary numeric probabilities without a justified model.

**Verification:** no observation in the table logically entails its hypothesis. That is why the answer maintains uncertainty and compares predictions instead of asserting a single cause. Repeating the original wrong answer without new context does not discriminate the three stories.

**Rubric / 10:** 2 three hypotheses; 3 observations; 3 predictions linked to causes; 2 uncertainty/agency. The app can collect confidence and a probe; assessing time-pressure versus misreading more deeply requires teacher review.

## 3. The Question That Separates

**Question:** With one extra interaction, what should be asked, offered or observed, considering burden and learner agency?

**Independent solution:** select the probe whose plausible outcomes most separate the currently live explanations, at acceptable cost. There is no universally optimal extra question: it depends on the candidate hypotheses and the learner’s context. A request to explain one step, restate a condition or try an untimed parallel task can be more informative than another full test.

**Algorithm:** for candidate action q and hypothesis H, consider the expected uncertainty reduction

`IG(q) = entropy(H) − Σ_r P(r | q) × entropy(H | r, q)`.

If calibrated probabilities are unavailable, use a qualitative prediction table rather than fabricated entropy values. Weigh information against time, fatigue and the chance that feeling tested damages honest responses. A practical decision is the smallest acceptable probe with meaningfully different predictions. Offer a choice or abstention, explain why evidence is useful, and stop when it supports a reversible next step. Learner and teacher decide together; a tool recommends.

**Verification:** an action with the same response distribution under every hypothesis has zero expected information gain. A perfect splitter is still unsuitable if burden or coercion destroys the validity of its answers. Thus information and human constraints both matter. The app offers optional diagnostic probes and explicitly allows leaving them unanswered; it does not claim to optimize information gain automatically.

**Rubric / 10:** 2 hypotheses; 3 discriminating probe/predictions; 2 information versus burden; 3 agency, uncertainty and stopping rule.

## 4. Better Marks, Better Understanding?

**Question:** When the next score rises, how do we distinguish learning from familiarity or tool dependence, and respond when improvement fails to transfer?

**Independent solution:** seek convergent evidence: explanations, unfamiliar but equivalent application, unaided performance and delayed retention. Use alternate forms of comparable difficulty and baseline evidence. Where feasible, compare instructional conditions to assess attribution, and report uncertainty and possible confounds. Do not equate one repeated-item improvement with learning.

**Protocol:** establish a baseline; deliver a targeted intervention; assess a new matched transfer task without the tool; repeat on a delayed alternate form; compare performance and reasoning. If the idea does not transfer, revisit the underlying misconception, vary examples/context, scaffold and then fade support. Reassess on a new item rather than training the exact test.

**Verification:** a learner who memorizes the test pattern can improve on repeated questions while failing new applications. This is a counterexample to “higher score implies general understanding.” Novel, unaided and delayed checks reduce these alternative explanations, but causal certainty still requires careful design. No real pilot has been conducted.

**Rubric / 10:** 3 familiarity versus learning; 3 novel/unaided/delayed checks; 2 fair comparisons/uncertainty; 2 instructional adaptation. The platform supports authoring separate quizzes, not an automated longitudinal experiment.

## Authored practice questions

These were added for software demonstration and are not missing original riddles:

1. **Confidence is not a grade:** “Evidence of knowledge is fragile.” Correct + low confidence cannot prove mastery or luck. Wrong responses offer a matched evidence probe.
2. **Interpret a reworded probe:** “A possible execution slip.” Wrong + sure + passed probe supports investigation, not a permanent label.
3. **Name the missing evidence:** “transfer,” “learning transfer,” or “transfer of learning.” Case, Unicode width and repeated whitespace are normalized; other synonyms must be configured by a teacher.

Automated tests validate all seed schemas, accepted variants, wrong/unanswered outcomes, hint deductions, the diagnostic matrix and manual-review routing. Logical correctness of an open argument is assessed through the explicit reasoning above and a teacher rubric; no automated text classifier claims to certify it.
