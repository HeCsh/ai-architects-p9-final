// The panel.
//
// Asks every judge in config.json, then combines their scores into one
// verdict. Judges have different characters and different rubrics, so they
// often disagree. The verdict is how the panel settles it.

import { judgeIt } from './judge.mjs';

// ---------- Three ways to reach a verdict ----------
//
// Pick one with "verdict" in config.json. They give different answers for
// the same scores, and that is the point: try all three on a submission the
// judges disagree about and see which feels fairest.

// Add them up and share them out. Every judge counts the same.
function average(scores) {
  const total = scores.reduce((sum, s) => sum + s, 0);
  return { score: Math.round((total / scores.length) * 10) / 10, why: 'The average of all the scores.' };
}

// The lowest score wins. To do well, a submission has to convince every
// judge, not just most of them.
function strictest(scores) {
  return { score: Math.min(...scores), why: 'The lowest score. Every judge had to be convinced.' };
}

// Each judge votes high (7 to 10), middle (4 to 6) or low (1 to 3). The
// group with the most votes wins, and the verdict is the average of the
// judges in it. A judge who wildly disagrees with the rest is left out.
function band(score) {
  if (score >= 7) return 'high';
  if (score >= 4) return 'middle';
  return 'low';
}

function majority(scores) {
  const groups = { high: [], middle: [], low: [] };
  for (const s of scores) groups[band(s)].push(s);
  const biggest = Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  const [name, members] = biggest[0];

  // If no group has more votes than every other (three judges, three
  // different groups), nobody has a majority. Take the middle score instead,
  // so the verdict sits between the two extremes.
  if (members.length === biggest[1][1].length) {
    const middle = [...scores].sort((a, b) => a - b)[Math.floor(scores.length / 2)];
    return { score: middle, why: 'No majority, so the middle score.' };
  }

  const { score } = average(members);
  return { score, why: `${members.length} of ${scores.length} judges scored it ${name}.` };
}

const METHODS = { average, strictest, majority };

export function verdict(method, scores) {
  const pick = METHODS[method];
  if (!pick) {
    throw new Error(`"verdict" in config.json is "${method}". It must be "average", "strictest" or "majority".`);
  }
  return { method, ...pick(scores) };
}

// ---------- Awkward input ----------
//
// People type things nobody planned for. Some of it can be spotted without
// asking the AI at all, which is faster, and saves the free key's limited
// questions for things worth judging. Nonsense and questions are harder to
// spot by rule, so the judges handle those themselves (rule 3 in judge.mjs).

// About 100 words. Every submission in the test sets is well under this.
const MAX_CHARACTERS = 600;

function checkFirst(submission) {
  if (!/\p{L}/u.test(submission)) {
    return 'There are no words in that. Tell the judges what you mean, in a sentence.';
  }
  if (submission.split(/\s+/).length === 1) {
    return 'One word is not enough to judge. Say what you mean, and why.';
  }
  if (submission.length > MAX_CHARACTERS) {
    return `That is too long for the judges to read in one go. Cut it down to your main point, under ${MAX_CHARACTERS} characters. It is ${submission.length} now.`;
  }
  return null;
}

// ---------- Run the whole panel ----------

// Every answer comes back with a status, so the page knows what to show:
//   "scored"   the judges scored it and there is a verdict
//   "refused"  a judge turned it down, because of rule 1 or rule 2
//   "more"     there was nothing to judge, so the panel asks for more
export async function runPanel(config, submission) {
  // Check the setting before asking anybody, so a typo in the config file is
  // spotted straight away rather than after waiting for three AI answers.
  verdict(config.verdict, [5]);

  const problem = checkFirst(submission);
  if (problem) {
    return { status: 'more', results: [], verdict: { method: config.verdict, score: null, why: problem } };
  }

  // All judges think at the same time. Asking them one after another would
  // make the page three times slower.
  const results = await Promise.all(
    config.judges.map((judge) => judgeIt(config, judge, submission))
  );

  // One judge refusing is enough to stop the panel. If a judge spotted that
  // this is about a person, the others' scores must not appear either, or
  // the person would get rated anyway.
  const refusals = results.filter((r) => r.refused);
  if (refusals.length) {
    for (const r of results) {
      if (!r.refused) {
        r.refused = true;
        r.score = null;
        r.reason = 'Not scored, because another judge turned this one down.';
      }
    }
    return {
      status: 'refused',
      results,
      verdict: { method: config.verdict, score: null, why: refusals[0].reason },
    };
  }

  // If most judges found nothing to judge, the panel asks for more rather
  // than making up a verdict from the one judge who had a go.
  const askers = results.filter((r) => r.wantsMore);
  if (askers.length * 2 >= results.length) {
    return {
      status: 'more',
      results,
      verdict: { method: config.verdict, score: null, why: askers[0].reason },
    };
  }

  // Otherwise the verdict comes from the judges who did give a score.
  const scored = results.filter((r) => !r.wantsMore);
  const result = verdict(config.verdict, scored.map((r) => r.score));
  if (askers.length) result.why += ` ${askers.length} judge wanted more, so that judge is left out.`;
  return { status: 'scored', results, verdict: result };
}
