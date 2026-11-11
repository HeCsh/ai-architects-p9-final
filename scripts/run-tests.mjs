// The test runner.
//
// How do you know the judges are any good? You cannot just try one thing and
// feel happy. So the tests/ folder holds five submissions per topic, and the
// verdict each one should get. This file sends every one of them to the
// panel and counts how many landed close to where they should.
//
// Run it:          node --env-file=.env scripts/run-tests.mjs
// Just one topic:  node --env-file=.env scripts/run-tests.mjs soccer
//
// It uses the real AI, so it takes a few minutes and uses up some of your
// key's questions. That is the price of checking.

import { readFile, readdir } from 'node:fs/promises';
import { runPanel } from './panel.mjs';

// An AI does not give exactly the same score twice. Asking for a perfect
// match would fail even a good panel, so a test counts as landed if the
// score is within two of what we expected.
const CLOSE_ENOUGH = 2;

// A free key only allows a few questions a minute, and each test asks three
// judges. A short rest between tests keeps us under the limit.
const PAUSE_MS = Number(process.env.TEST_PAUSE_MS ?? 20000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The expected score is written as a range, like [7, 9]. Its middle is the
// score we hoped for, so that is what we measure from.
function middle([low, high]) {
  return (low + high) / 2;
}

function close(score, range) {
  return score !== null && Math.abs(score - middle(range)) <= CLOSE_ENOUGH;
}

// Asks the panel, and if the AI is too busy, waits a minute and tries again.
// A busy AI is not a failed test, so it should not count as one.
async function askPanel(config, submission) {
  for (let tries = 1; ; tries++) {
    try {
      return await runPanel(config, submission);
    } catch (err) {
      if (!err.busy || tries === 3) throw err;
      console.log('   The AI is busy. Waiting a minute, then trying again...');
      await sleep(60000);
    }
  }
}

// Works out whether one test landed, and says why in plain words.
function check(test, answer) {
  const scoreOf = (name) => answer.results.find((r) => r.judge === name)?.score ?? null;

  // Some tests are allowed to make the panel ask for more. That is the
  // right answer to "A thing for stuff." just as much as a low score is.
  if (answer.status === 'more') {
    return test.moreIsFine
      ? { landed: true, why: 'asked for more, which is allowed for this one' }
      : { landed: false, why: `asked for more: "${answer.verdict.why}"` };
  }
  if (answer.status === 'refused') {
    return { landed: false, why: `turned it down: "${answer.verdict.why}"` };
  }

  const misses = [];
  if (test.verdict && !close(answer.verdict.score, test.verdict)) {
    misses.push(`verdict ${answer.verdict.score}, expected about ${middle(test.verdict)}`);
  }
  for (const [name, range] of Object.entries(test.judges || {})) {
    if (!close(scoreOf(name), range)) misses.push(`${name} gave ${scoreOf(name)}, expected about ${middle(range)}`);
  }
  // Tests built to split the panel: one judge should score above another.
  if (test.higher) {
    const [high, low] = test.higher;
    if (!(scoreOf(high) > scoreOf(low))) misses.push(`${high} (${scoreOf(high)}) should be above ${low} (${scoreOf(low)})`);
  }
  return misses.length ? { landed: false, why: misses.join('; ') } : { landed: true, why: 'close enough' };
}

async function main() {
  const only = process.argv[2];
  const files = (await readdir('tests')).filter((f) => f.endsWith('.json') && (!only || f === `${only}.json`));
  if (!files.length) {
    console.error(`No test file found${only ? ` called tests/${only}.json` : ' in tests/'}.`);
    process.exit(1);
  }

  let landed = 0;
  let total = 0;
  let first = true;

  for (const file of files) {
    const set = JSON.parse(await readFile(`tests/${file}`, 'utf8'));
    const config = JSON.parse(await readFile(set.config, 'utf8'));
    console.log(`\n${config.topic} (${set.config})`);

    for (const test of set.tests) {
      if (!first) await sleep(PAUSE_MS);
      first = false;
      total++;

      let line;
      try {
        const answer = await askPanel(config, test.submission);
        const result = check(test, answer);
        if (result.landed) landed++;
        const scores = answer.results.map((r) => `${r.judge} ${r.score ?? '-'}`).join(', ');
        line = `${result.landed ? 'LANDED' : 'MISSED'}  ${test.submission}\n`
          + `        verdict ${answer.verdict.score ?? 'none'} (${scores || 'no judges asked'})\n`
          + `        ${result.why}`;
      } catch (err) {
        line = `ERROR   ${test.submission}\n        ${err.message}`;
      }
      console.log(line);
    }
  }

  console.log(`\n${landed} of ${total} landed within ${CLOSE_ENOUGH} of the expected verdict.`);
}

await main();
