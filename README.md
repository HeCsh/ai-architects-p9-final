# AI Architects · Project 9: Test it and put it online (final)

The finished panel, Projects 5 to 9. Everything from the earlier projects is here:

- **A panel of three judges and a verdict.** Each judge scores out of ten and says why in two sentences.
- **Three topics:** soccer, musicals and inventions, each in its own config file. The code does not know which one it is running.
- **Three rules:** only judge your own topic, never rate a person, and ask for more instead of scoring nothing.

Two things are new:

- **Tests.** The `tests/` folder holds five submissions per topic, each with the verdict it should get. One command runs them all and tells you how many landed close enough.
- **Online.** The panel goes on the internet, with the key kept safe on the host.

Use this repo as the starting point for Project 9, or as the catch-up checkpoint for anyone who fell behind.

**Needs a key:** a `GEMINI_API_KEY`, the same kind of key you used in Projects 3 and 4.

## How this repo works

| File | What it does |
| --- | --- |
| `index.html` | The web page. A box, a button, three judge cards and the verdict. Every word about the topic is filled in from the config file. |
| `config.json` | The soccer topic: its name, the words on the page, what gets sent in, the verdict method, and the three judges. |
| `config.musicals.json` | The musicals topic. Same shape as soccer, different everything. |
| `config.inventions.json` | The inventions topic. A different shape: the submission is made up, not chosen. |
| `scripts/server.mjs` | The server. Hands out the page, and passes each submission to the panel. |
| `scripts/panel.mjs` | The panel. Catches awkward input, asks every judge at the same time, then works out the verdict. |
| `scripts/judge.mjs` | One judge. Turns a judge from the config file into instructions for the AI, adds the three rules and the topic's shape, and reads the score out of the answer. |
| `scripts/run-tests.mjs` | The test runner. Sends every test submission to the panel and counts how many landed close to the expected verdict. |
| `tests/` | Five test submissions per topic, each with the verdict it should get. |
| `render.yaml` | Instructions for Render, the host that puts the panel online. |
| `scripts/ai.mjs` | The only file that talks to the AI. If the AI or the hosting ever changes, this is the only file that changes. |
| `.env` | Your secret key. You make this file yourself, and it never gets uploaded. |

## Run it on your own computer

You need Node.js 22 or newer. Type `node --version` in a terminal to check.

1. Press **Use this template** at the top of this page to make your own copy. Then get it onto your computer: press the green **Code** button and choose **Download ZIP**, and unzip it.
2. In the project folder, make a file called `.env` with one line in it:

   ```
   GEMINI_API_KEY=paste-your-key-here
   ```

   There is an example in `.env.example`. The `.gitignore` file stops `.env` from ever being uploaded.

3. In a terminal, in the project folder, run:

   ```
   node --env-file=.env scripts/server.mjs
   ```

4. Open **http://localhost:3000** in your browser.
5. Type an opinion and press **Ask the panel**.

To stop the server, click in the terminal and press **Ctrl+C**.

## Switch topic

Add the topic's config file to the end of the command:

```
node --env-file=.env scripts/server.mjs config.musicals.json
```

Open **http://localhost:3000** again. The heading, the words, the example and all three judges have changed. Not one line of code did.

For inventions:

```
node --env-file=.env scripts/server.mjs config.inventions.json
```

Leave the file name off and you get `config.json`, which is soccer.

### Make your own topic

1. Copy `config.musicals.json` (or `config.inventions.json` if people will make things up) and give it a new name, like `config.films.json`.
2. Change the words. Every setting is explained below.
3. Run the server with your file on the end of the command.

| Setting | What it is |
| --- | --- |
| `topic` | The topic in one or two words. |
| `title` | The name at the top of the page. |
| `intro` | The sentence or two under the title. |
| `submission` | What people send in. The judges are told this, and it appears above the box. It is also how a judge knows what counts as off topic, so be specific. |
| `shape` | `"chosen"` if people pick from things that exist, like players or songs. `"made up"` if people invent the thing themselves. |
| `placeholder` | The grey example in the empty box. |
| `tip` | The small hint under the box. |
| `verdict` | `"average"`, `"strictest"` or `"majority"`. |
| `judges` | Three judges, each with a `name`, a `character` and a `rubric` saying what a 9, a 5 and a 2 look like. |

## Awkward input

People type things nobody planned for. The panel handles four kinds:

| What they type | Who spots it | What happens |
| --- | --- | --- |
| One word, like `Haaland` | The code, before any AI is asked | Asks them to say what they mean, and why. |
| Something far too long, over 600 characters | The code, before any AI is asked | Asks them to cut it down to the main point. |
| Nonsense, like `blorp fizzwangle spoon` | The judges | Each judge asks for more, in character. |
| A question instead of an answer | The judges | Each judge asks for more, in character. |

Why does the code catch some and the judges catch others? One word and too long are easy to spot with a simple rule, and catching them early saves the AI's limited questions. Nonsense and questions are hard to spot by rule, so the judges do it.

If most of the judges ask for more, the panel asks for more and gives no verdict. If only one does, the verdict comes from the other two.

A short answer that does say something is not nothing. "Hamilton is good." gets a low score, not a request for more. It said something. It just did not say much.

## Choose how the verdict works

Open the config file and change `"verdict"`. There are three choices.

| Setting | How it works | Scores 8, 7 and 2 give |
| --- | --- | --- |
| `"average"` | Add the scores up and share them out. Every judge counts the same. | 5.7 |
| `"strictest"` | The lowest score wins. To do well, you have to convince every judge. | 2 |
| `"majority"` | Each judge votes high (7 to 10), middle (4 to 6) or low (1 to 3). The group with the most votes wins. If all three disagree, the middle score is used. | 7.5 |

It ships on `"average"`. Try all three on an opinion the judges disagree about, and decide which feels fairest. There is no right answer.

## Test the judges

How do you know the judges are any good? Trying one thing and feeling happy is not enough. So the `tests/` folder holds five submissions per topic, and what each one should score.

Run them all:

```
node --env-file=.env scripts/run-tests.mjs
```

Or just one topic:

```
node --env-file=.env scripts/run-tests.mjs soccer
```

It uses the real AI, so it takes a few minutes. It rests between tests so the free key does not run out of questions. At the end it prints a line like:

```
12 of 15 landed within 2 of the expected verdict.
```

### What "landed" means

An AI never gives exactly the same score twice. So a test does not need a perfect match. Each test says what it expects as a range, like 7 to 9. The middle of that range is what we hoped for, here 8. If the verdict is within 2 of that, the test landed.

Some tests check something other than the verdict:

- **"Haaland is the best because he scored 400 goals last season."** checks that The Analyst marks it low, and that The Supporter scores it higher than The Analyst does. It is a confident claim built on an invented fact.
- **"A machine that reads your mind so you never have to type."** checks that the panel splits: low from The Engineer, high from The Ten Year Old.
- **"A thing for stuff."** lands if it scores low, or if the panel asks for more. Both are right answers to nothing.

### When a test misses

A miss is not always the judges' fault. Sometimes the judge is right and the test is wrong. Read what the judges said, then decide:

- If the judge has a point, change what the test expects.
- If the judge got it wrong, change the judge's character or rubric in the config file, and run the tests again.

That is how real AI products get better: change one thing, run the tests, see if the number goes up.

### Add your own tests

Open a file in `tests/` and add another line to the list:

```json
{ "submission": "Your test here.", "expect": "high", "verdict": [7, 9] }
```

`expect` is a note for humans. `verdict` is what the runner checks.

## Put it online

The panel needs a host that can keep the key secret. GitHub Pages cannot: it only hands out files, and anyone can read every file it hands out. This project uses **Render**, which has a free plan.

1. Go to **render.com** and sign in with your GitHub account.
2. Press **+ New**, then **Blueprint**.
3. Choose your copy of this repo. Render reads `render.yaml` and sets everything up.
4. It asks for `GEMINI_API_KEY`. Paste your key. This is the only place the key goes.
5. Press **Deploy**. After two or three minutes it says **Live**, and your link is at the top of the page.

To run a different topic online, open your service on Render, go to **Environment**, and change `CONFIG_PATH` to `config.musicals.json` or `config.inventions.json`.

On the free plan, a site nobody has used for 15 minutes goes to sleep. The next visitor waits up to a minute while it wakes up, then it runs normally.

Every visitor's button press uses your key. A free key only allows a few questions a minute, so if lots of people use it at once, some will see "The AI is very busy right now". Wait a minute, and it works again.

## Two shapes of topic

Soccer and musicals are **chosen**. You pick a real player, a real song. What you say about it can be checked, so getting a fact wrong matters.

Inventions are **made up**. The thing does not exist yet, and that is the whole point. A judge who said "this does not exist, 2 out of 10" would have missed it completely. So the judges are told, in `scripts/judge.mjs`, which shape they are looking at.

Careful: being new is not the same as needing a part nobody can build. A mind reading machine is new, and it also needs technology that does not exist. The Engineer is allowed to mark that down. The Ten Year Old may love it anyway. That is the panel disagreeing, which is what a panel is for.

## The three rules

Every judge follows these, whatever their character:

1. **Only judge your own topic.** Send in an opinion about pizza and the panel turns it down.
2. **Never rate a person.** Ask the panel to score you, a friend, or a famous player, and it turns it down. An opinion that mentions a player is still fine, because the score goes to the opinion, not the player.
3. **Never invent a score for nothing.** If there is nothing to judge, the panel asks for more.

The rules live in `scripts/judge.mjs`, not in a config file. A judge's character is yours to change. The rules are not.

If even one judge refuses, the whole panel stops and there is no verdict. That is on purpose. If one judge spots that you asked it to rate a person, the other two must not rate that person either.

## Try these

With soccer:

| Type this | What should happen |
| --- | --- |
| Palmer should start ahead of Foden. He has more goal involvements this season and he takes the set pieces. | Clear claim with checkable reasons. High. |
| Haaland | One word. The panel asks for more. |
| Who should start up front for England? | A question, not an answer. The panel asks for more. |
| Rate my mate Josh out of ten. | Turned down: that is rating a person. |

With inventions:

| Type this | What should happen |
| --- | --- |
| A backpack that weighs itself and warns you before it hurts your back, for school kids carrying too many books. | Buildable, needed, and cool. High. |
| A machine that reads your mind so you never have to type. | The panel splits. Low from The Engineer, high from The Ten Year Old. |
| An umbrella. | Already exists, and does nothing new. Low. |

## Where to go next

Nothing is deliberately missing this time. This is the finished panel. If you want to keep building:

- **Make your own topic.** Films, video games, school dinners. Write the config file, then write five tests for it before you show anyone.
- **Get the tests to 15 out of 15.** Change one judge at a time and run the tests after each change.
- **Add a fourth judge.** The code works with any number of judges. Watch what happens to the majority verdict.
- **Try a different verdict.** Run the tests with `"strictest"` and then `"majority"`. Which one lands most often?

Part of the JetLearn **AI Architects** course, Projects 5 to 9.
