// The server.
//
// Projects 1 to 4 did not need one. The bot ran on a timer and the website
// only showed what was already saved. Now somebody types into a box and
// wants an answer straight away, so something has to be awake and waiting.
// That is this file.
//
// It does two jobs:
//   1. hands the browser the web page
//   2. when the page sends in a submission, asks the panel of judges and
//      sends back their scores and the verdict
//
// The secret key stays here, on the computer running this file. The browser
// only ever sees the page and the scores.
//
// Run it:  node --env-file=.env scripts/server.mjs
// Then open http://localhost:3000
//
// To use a different topic, add its config file on the end:
//          node --env-file=.env scripts/server.mjs config.another-topic.json

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { runPanel } from './panel.mjs';

const PORT = Number(process.env.PORT || 3000);

// Which topic to run. A file named on the command line wins. Otherwise a
// CONFIG_PATH setting, which is handy on a host where you cannot type the
// command yourself. Otherwise plain config.json.
const CONFIG_PATH = process.argv[2] || process.env.CONFIG_PATH || 'config.json';

// The only files the browser is allowed to have. Anything not on this list,
// including the .env file with the key in it, is never sent out.
const PUBLIC_FILES = {
  '/': { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/index.html': { file: 'index.html', type: 'text/html; charset=utf-8' },
  // Whichever topic is running, the page asks for it by the same name, so
  // the page never needs to know which file it came from.
  '/config.json': { file: CONFIG_PATH, type: 'application/json; charset=utf-8' },
};

// Nobody needs to send more than this. It stops someone from pasting a whole
// book in and keeping the server busy.
const MAX_BODY_BYTES = 20000;

function send(res, status, type, body) {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(body);
}

function sendJSON(res, status, data) {
  send(res, status, 'application/json; charset=utf-8', JSON.stringify(data));
}

async function readBody(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > MAX_BODY_BYTES) throw new Error('That is far too much to send in one go.');
  }
  return body;
}

// The config is read fresh every time, so a learner who changes config.json
// sees the change on the next button press without restarting anything.
async function loadConfig() {
  return JSON.parse(await readFile(CONFIG_PATH, 'utf8'));
}

const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;

  if (req.method === 'POST' && path === '/api/judge') {
    try {
      const { submission } = JSON.parse(await readBody(req));
      const text = String(submission || '').trim();
      if (!text) return sendJSON(res, 400, { error: 'Type something in the box first.' });
      const result = await runPanel(await loadConfig(), text);
      return sendJSON(res, 200, result);
    } catch (err) {
      // The full detail goes in the terminal for whoever is running the
      // server. The page gets a plain sentence.
      console.error(err);
      return sendJSON(res, 500, { error: err.message });
    }
  }

  const page = PUBLIC_FILES[path];
  if (req.method === 'GET' && page) {
    return send(res, 200, page.type, await readFile(page.file));
  }

  send(res, 404, 'text/plain; charset=utf-8', 'Not found');
});

server.listen(PORT, () => {
  console.log(`The judges are ready at http://localhost:${PORT} (topic file: ${CONFIG_PATH})`);
  if (!process.env.GEMINI_API_KEY) {
    console.log('Warning: no GEMINI_API_KEY found. The page will load, but the judges cannot score anything yet.');
  }
});
