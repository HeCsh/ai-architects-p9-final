// THE ONLY FILE THAT TALKS TO THE AI.
//
// This is the only file that changes if the AI provider or the hosting
// changes. Everything else in the project asks this file for an answer and
// never calls an AI itself.
//
// Why keep it all in one place? The AI needs a secret key, and anyone who
// sees the key can use it and run up the bill. A web page cannot keep a
// secret: every file the browser downloads can be read by whoever opens it.
// So this file only ever runs on the computer doing the hosting, never in
// the browser, and the key stays there.
//
// Today it uses Gemini, the same as Projects 3 and 4. To use something else,
// rewrite the inside of askAI below. Keep the shape the same: a prompt goes
// in, text comes out. Nothing else in the project will notice the change.

const MODEL = process.env.AI_MODEL || 'gemini-3.5-flash-lite';
const GEMINI_URL = process.env.GEMINI_URL || 'https://generativelanguage.googleapis.com/v1beta/models';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Asks once. Returns the answer, or says the AI was too busy to answer.
async function askOnce(prompt, key) {
  const res = await fetch(`${GEMINI_URL}/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    }),
    // An AI that never answers would leave the page spinning for ever.
    // Thirty seconds is plenty for a short answer.
    signal: AbortSignal.timeout(30000),
  });

  // 429 means our key has asked too many questions this minute.
  // 500 and 503 mean the AI company's computers are overloaded. That
  // happens to everyone sometimes, and it usually passes in seconds.
  if (res.status === 429 || res.status === 500 || res.status === 503) {
    console.error(`The AI was busy (error ${res.status}): ${(await res.text()).slice(0, 300)}`);
    return { busy: true };
  }
  if (!res.ok) {
    throw new Error(`The AI answered with error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }

  const data = await res.json();
  const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
  if (!text.trim()) throw new Error('The AI sent back an empty answer.');
  return { text };
}

export async function askAI(prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('The GEMINI_API_KEY secret is missing, so the judges cannot think. See the README.');
  }

  // A busy AI often frees up a moment later, so try three times, waiting
  // a little longer each time, before giving up.
  const waits = [0, 3000, 8000];
  for (const wait of waits) {
    if (wait) await sleep(wait);
    const answer = await askOnce(prompt, key);
    if (!answer.busy) return answer.text;
  }

  const err = new Error('The AI is very busy right now. Wait a minute, then try again.');
  err.busy = true; // lets other code tell "busy" apart from "broken"
  throw err;
}
