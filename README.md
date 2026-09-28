# warp-sys-one: Jev Experiment Lab

A local workbench for experimenting with [TypeSafe](https://docs.typesafe.ai/introduction)'s System One model **Jev**.

An experiment is a JSON file: a piece of **state** (the text or data to judge) plus a set of **questions** about it.
Jev answers every question with calibrated probabilities instead of free text. The lab lets you organise
experiments in projects, edit them with live validation, paste inputs, run them, and compare past runs,
from a Matrix-style SvelteKit UI or from the terminal.

- [Setup](#setup)
- [Using the UI](#using-the-ui)
- [Experiment format](#experiment-format)
  - [Question types and answers](#question-types-and-answers)
  - [Inputs: `${name}`](#inputs-name)
  - [File variables: `#{name}`](#file-variables-name)
  - [Views: ranked summaries](#views-ranked-summaries)
  - [Cases](#cases)
  - [Validation rules](#validation-rules)
  - [Full example](#full-example)
- [CLI](#cli)
- [Private experiments](#private-experiments)
- [Files and layout](#files-and-layout)
- [HTTP API](#http-api)

## Setup

Requires Node 22+.

```sh
npm install
cp .env.example .env    # then set JEV_API_KEY=...
npm run dev             # http://127.0.0.1:5173
```

| Variable            | Required | Purpose                                                         |
| ------------------- | -------- | --------------------------------------------------------------- |
| `JEV_API_KEY`       | yes      | TypeSafe API key. Read server-side only; never sent to the browser. |
| `TYPESAFE_BASE_URL` | no       | Override the API host (default `https://api.typesafe.ai`).      |

Production build: `npm run build && npm start` (runs `node build`, reads `.env`). Type check: `npm run check`.

## Using the UI

The screen has three columns.

**Left sidebar**

- **Projects**: one folder per project, one entry per experiment. Filter with the search box. Hover an item
  to duplicate (⧉), rename/move (✎) or delete (✕); `+` on a folder creates a new experiment from a template
  with one question of each type; `+ PROJECT` creates a folder.
- **Inputs**: shown when the selected experiment contains `${…}` placeholders. One textarea per placeholder,
  and a dropdown of the project's saved input sets. `+` new set, ✎ rename, ✕ delete, **Save** writes the
  current values (● marks unsaved changes). The last used set is remembered per project.

Both sections scroll independently.

**Center: editor**

- JSON editor with live validation; the status line shows the first problem, or `valid · N question(s) · N input(s)`.
- Model picker (lists the models your key can use).
- `Ctrl/⌘+S` save · `Ctrl/⌘+Enter` run · `Ctrl/⌘+Shift+F` format. **Revert** discards unsaved edits.
- Runs use the editor's *current* contents, saved or not, so you can tweak and re-run freely.
  Run is disabled while the JSON is invalid or an input is empty.

**Right: output**

- Summary line: cases, duration, tokens in/out.
- **Views** (if the experiment defines `views`): compact ranked lists across many questions.
- One card per question: yes/no split, choice distribution, or score scale with per-level probabilities.
  Instructions are folded behind `▸ instructions`; hover a bar to see its criterion text.
- **raw** toggles the full JSON result. The history dropdown lists past runs (with the input set used);
  "load this run's input" restores the JSON and input values a past run used.

## Experiment format

```jsonc
{
  "name": "Ticket triage",          // display only
  "description": "notes",           // display only
  "model": "jev-latest",            // optional; the API default otherwise
  "vars":  { … },                   // optional: #{name} text snippets reused in this file
  "state": { "body": "${body}" },   // what Jev judges: string, object or array (may use ${inputs})
  "views": [ … ],                   // optional, display only: ranked summaries
  "questions": { "<id>": { … } },   // one or more questions, keyed by id
  "cases": [ … ]                    // optional: several states, one API call each
}
```

Only `model`, `state` and `questions` are sent to Jev, after `#{…}` and `${…}` have been filled in.
Everything else is for you and the UI.

### Question types and answers

Every question has a `type`, `instructions` (text, or any JSON) and usually `criteria`. Refer to parts of
the state by name in the instructions, e.g. ``"Is `body` about billing?"``.

| type     | criteria                                                                     | answer                                                                 |
| -------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `noul`   | optional `{ "true": "…", "false": "…" }`                                     | `noul`: p(yes), 0–1                                                    |
| `choice` | object `label → description` (or `null`), 2–255 options                      | `choice` (best label), `confidence`, `probabilities` per label         |
| `score`  | array of 2–10 level descriptions, index = score (0, 1, 2, …); `null` allowed | `score` (expected value, may fall between levels), `confidence`, `legend`, `probabilities` per level |

```json
"questions": {
  "isBilling": {
    "type": "noul",
    "instructions": "Is `body` about billing or payments?",
    "criteria": { "true": "Mentions charges, invoices or refunds.", "false": "Anything else." }
  },
  "tone": {
    "type": "choice",
    "instructions": "What is the tone of `body`?",
    "criteria": { "calm": null, "frustrated": "Annoyed but polite.", "angry": null }
  },
  "urgency": {
    "type": "score",
    "instructions": "How urgently does `body` need a response?",
    "criteria": ["Can wait a week", "This week", "Today", "Right now"]
  }
}
```

Tips:

- **noul** questions are independent: several can be "yes" at once. **choice** spreads one unit of
  probability over the options: exactly one best answer. Use both when you want "which fits best" *and*
  "does each one fit".
- **score** gives a graded answer. Start each level text with a short name and a colon
  (`"Core: the main subject …"`); views show that name as the level.
- Criteria text can be any language; Jev matches it against the state.

### Inputs: `${name}`

Write `${name}` in any string in `state`, `questions` or `cases` to fill it at run time:

```json
"state": { "title": "${title}", "body": "${body}" }
```

- The sidebar shows one textarea per placeholder, so long text is pasted raw, with no JSON escaping.
- Values are saved as named **input sets** in `experiments/<project>/_inputs/<set>.json`
  (`{ "title": "…", "body": "…" }`), shared by every experiment in the project.
- Substitution happens server-side just before the call. An empty input blocks the run.
- Each saved run stores the template JSON plus the input set name and the exact values sent.
- Names: letters, digits, `_` and `-`, starting with a letter or `_`. `name` and `description` are not templated.

### File variables: `#{name}`

`vars` holds text you would otherwise repeat. Reference it as `#{name}` in `state`, `questions` or `cases`:

```json
"vars": {
  "billing_scope": "Charges, invoices, refunds, payment methods and subscription plans."
},
"questions": {
  "team":    { "type": "choice", "criteria": { "billing": "#{billing_scope}", … } },
  "billing": { "type": "noul",   "instructions": "Should the billing team handle this ticket? Billing covers: #{billing_scope}" }
}
```

- Vars are plain strings and are expanded **before** inputs, so a var may contain `${title}`.
- An undefined `#{name}` is a validation error.
- Saved runs keep the unexpanded file; the output cards show the expanded instructions.

`${…}` = text that changes per run (pasted in the sidebar). `#{…}` = text that is fixed but reused (lives in the file).

### Views: ranked summaries

With many similar questions (one per team, per category, …) the individual cards get long. A view collects
matching answers into one compact list, sorted best first, shown above the cards:

```json
"views": [
  { "title": "Team fit (score)",  "match": "*Score", "type": "score" },
  { "title": "Team fit (yes/no)", "type": "noul" }
]
```

| field   | required | meaning                                                                                       |
| ------- | -------- | --------------------------------------------------------------------------------------------- |
| `title` | yes      | Card heading.                                                                                 |
| `match` | no       | Question id pattern; `*` matches anything and becomes the row label (`*Score` turns `billingScore` into `billing`). Default: all questions. |
| `type`  | no       | Only questions of this type (`noul`, `choice`, `score`).                                      |

Rows are ranked by p(yes) for noul, by confidence for choice, and by expected score / max for score.
Score rows also show the most likely level name (the level text before its first `:`, e.g. `Core`).
Views are display only; they never change what is sent. The CLI prints the same lists.

### Cases

To run the same questions over several fixed states, add `cases`. The top-level `state` is then ignored
and each case is its own API call (4 in parallel); the output has a tab per case.

```json
"cases": [
  { "name": "double charge", "state": { "body": "I was charged twice…" } },
  { "name": "feature request", "state": { "body": "Could you add dark mode?" } }
]
```

For ad-hoc text, prefer `${…}` inputs; cases suit fixed regression sets.

### Validation rules

Checked live in the editor and again before sending:

- `questions` has at least one question, each with `instructions` and a known `type`.
- choice: 2–255 options; score: 2–10 levels; noul `criteria`, if present, is an object.
- `state` is present (or `cases` is a non-empty array whose entries all have `state`).
- `vars` values are strings, and every `#{name}` is defined.
- `views` entries have a `title`; `match` is a string; `type` is a question type.
- Project, experiment and input set names: letters, digits, `.`, `_`, `-`; max 64 characters.

### Full example

A routing experiment that uses every feature: one ticket, several teams, each described once.

```jsonc
{
  "name": "Ticket routing",
  "vars": {
    "billing": "Billing: charges, invoices, refunds, payment methods.",
    "tech": "Technical: bugs, errors, outages, login problems.",
    "sales": "Sales: pricing questions, upgrades, new accounts."
  },
  "state": { "subject": "${subject}", "body": "${body}" },
  "views": [
    { "title": "Team fit (score)", "match": "*Score", "type": "score" },
    { "title": "Team fit (yes/no)", "type": "noul" }
  ],
  "questions": {
    "team": {
      "type": "choice",
      "instructions": "Which team should handle this ticket (`subject`, `body`)?",
      "criteria": { "billing": "#{billing}", "tech": "#{tech}", "sales": "#{sales}" }
    },
    "billing": { "type": "noul", "instructions": "Should this team handle the ticket? #{billing}" },
    "billingScore": {
      "type": "score",
      "instructions": "How well does the ticket fit this team? #{billing}",
      "criteria": ["None: unrelated", "Partial: touches on it", "Core: squarely this team's job"]
    }
    // … the same noul + score pair for tech and sales
  }
}
```

- `vars`: one description per team, reused by the choice and by each team's questions.
- `state`: `${subject}` and `${body}` inputs, filled from an input set in `_inputs/`.
- `team` (choice): the single best team.
- One `noul` and one `<team>Score` question per team; the two views rank all teams by score and by p(yes).

## CLI

```sh
npm run run-exp                                                       # list experiments
npm run run-exp -- support-tickets/routing-cases                      # run and pretty-print
npm run run-exp -- support-tickets/routing-cases --raw                # print the full result JSON
npm run run-exp -- support-tickets/triage --input double-charge       # fill ${…} from an input set
```

An experiment with `${…}` placeholders needs `--input <set>`; without it the CLI lists the available sets.
Every CLI run is saved to `results/` like UI runs, so it appears in the UI history. Exit code is 1 if any case failed.

## Private experiments

Experiments you don't want in git go in `experiments_private/`, next to `experiments/`, with the same layout:

```
experiments_private/<project>/<experiment>.json
experiments_private/<project>/_inputs/<set>.json
```

- The folder is gitignored, so nothing in it is ever committed. Their runs go to `results/`, which is gitignored too.
- The UI lists private projects with a 🔒 and an amber name; the CLI list marks them `(private)`.
  Otherwise they work like any other project: edit, run, input sets, history.
- **+ PROJECT** asks whether the new project is public or private.
- The app never moves or copies experiments between the two folders; moving or duplicating across them is
  refused. Do it by hand: `mv experiments/foo experiments_private/` to make a project private, and the reverse
  to publish it.
- Project names are unique across both folders. If the same name exists in both, the private one is shown.
- Moving a project that was already committed does not remove it from git history.

## Files and layout

```
experiments/<project>/<experiment>.json    # experiments (one folder level = one project)
experiments/<project>/_inputs/<set>.json   # input sets for ${…} placeholders, shared by the project
experiments_private/<project>/…            # same layout, gitignored (see Private experiments)
results/<project>/<experiment>/<run>.json  # every run, saved automatically (gitignored)
scripts/run-exp.ts                         # CLI runner
src/lib/inputs.ts                          # ${…} inputs and #{…} vars (shared by UI, server, CLI)
src/lib/views.ts                           # view matching and ranking (shared by UI and CLI)
src/lib/validate.ts                        # experiment validation
src/lib/server/                            # store (filesystem CRUD), runner (SDK calls), client
src/lib/components/                        # project tree, inputs, JSON editor, results, answer cards
src/routes/api/                            # JSON API used by the UI
```

A saved run contains the template JSON (`input`), the input set and values (`inputs`), and one entry per case
with `answers`, `model`, `usage`, `latencyMs`, or an `error` (message, HTTP status, request id).

## HTTP API

Used by the UI; handy for scripting. All JSON.

| Method & path                                       | Purpose                                          |
| --------------------------------------------------- | ------------------------------------------------ |
| `GET /api/tree`                                     | Projects and their experiments                   |
| `POST /api/projects` · `DELETE /api/projects/:p`    | Create (`{ "project", "private"? }`) / delete a project |
| `GET·PUT·DELETE /api/experiments/:p/:name`          | Read / save / delete an experiment               |
| `POST /api/experiments/:p/:name/duplicate`, `/rename` | Copy, or rename/move (`{ "toProject"?, "toName"? }`) |
| `GET /api/inputs/:p`                                | List input sets                                  |
| `GET·PUT·DELETE /api/inputs/:p/:set` (`PUT ?create=1` fails if it exists) | Read / save / delete an input set |
| `POST /api/inputs/:p/:set/rename`                   | Rename an input set (`{ "toSet": "…" }`)         |
| `POST /api/run`                                     | Run `{ experiment, project?, name?, inputs?: { set?, values } }` |
| `GET /api/results/:p/:name` · `/:id`                | Run history / one run                            |
| `GET /api/models`                                   | Models available to the key                      |
