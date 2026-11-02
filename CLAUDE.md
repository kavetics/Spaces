# Spaces

Your home, understood by Muse. Scan a room with your phone, and Spaces builds an inventory of what's there. Then ask Muse about your things, with answers that cite the photo each item was seen in.

Built solo for the Meta Global AI Developer Hackathon (Indie track, "Build for Your World"). **Submission deadline: Wed Nov 4, 2026, 6:00 PM CST** (hard deadline 8:00 PM CST).

The repo and hosted service are still named `room-rush`, from an earlier idea. The last version of that party game is at the git tag `room-rush-games`.

## What it does
1. **Name a Space:** living room, backyard, or anything else.
2. **Scan:** 8 guided photos taken automatically when the phone is lined up and still.
3. **Build the inventory:** Muse Spark names the items in each photo, SAM 3.1 outlines them, and Muse Spark merges repeats across photos. Plain code checks merges, counts quantities and picks each item's crop.
4. **Sort it:** items go into 8 categories. Things outside the Space go under "Also spotted nearby". People add or remove items.
5. **Ask Muse:** chat about one Space or all of them. Answers cite items, and a citation opens the scan photo with the item outlined.

Planned: sell listings, memories on items, correcting items, shared voting, and a connection to the Muse app. See `docs/TODO.md`.

## Code map
- `server/src/inventory.js`: scan to inventory
- `server/src/ask.js`: Ask Muse answers and citation checks
- `server/src/meta.js`: Meta Model API client
- `web/src/App.jsx`: screens and the recognition run
- `web/src/spaceGraph.js`: links Space, area, category, item and photo; Ask Muse's context
- `web/src/savedSpaces.js`: Spaces and chats on the phone (IndexedDB)
- `server/scripts/test-inventory.js`: run recognition on saved photos, with `npm run test:inventory`

## Stack
- **Frontend:** React (Vite), mobile-first web app, in-browser camera. UI uses the Astryx design system; its rules are in `web/AGENTS.md`.
- **Backend:** Node.js (Express). Holds API keys and runs all AI calls.
- **Data:** on the phone for now. Supabase is planned for anything shared.
- **AI:** Meta Model API, OpenAI-compatible, base URL `https://api.meta.ai/v1`
  - `muse-spark-1.3`: naming items, merging, checking crops, answering questions
  - `sam-3.1`: finding item outlines from text prompts
  - `muse-image-1.0`, `muse-wonder-1.0`: not used yet; test before relying on them
- **Hosting:** Render, one service for the server and built web app (`render.yaml`). `main` deploys.

## Hard rules
- **Never use `-contributor` model variants** (photos can contain people).
- **Never commit secrets.** Keys live in `.env` only (git-ignored). Read config from env vars.
- **Photos of homes are private.** Never commit them; `test-photos/` is git-ignored. Tell people what is shared and saved, and say plainly when something is development only. Saving scan photos happens in development only.
- **People are added, never detected.** Don't identify anyone from a scan. People and pets are never inventory items.
- **Demo shows only real usage.** No AI-generated people or fake footage. Anything generated, like a redesign preview, is labeled.
- **Use plain code for math; use AI for judgment.** Measure and validate AI output; don't trust it blindly. Muse never cites an item that plain code can't find in the inventory.
- **Never lose an item silently.** When recognition is unsure, keep the item, mark it "Not sure" and let the person decide.
- **Avoid looking like a "simple image analyzer"** (banned project type). What Muse does with the inventory is the hero.

## Process
- **Per feature:** Context → Plan → Build → Verify. Propose a short plan before large changes.
- **Verify before saying "done":** run it, test it, show the result. Say what wasn't tested, especially on a real iPhone.
- **Small, working steps.** Every session ends with something that runs.
- **Measure:** recognition against a hand-written item list, per room; time per scan; cost. Don't overstate small samples.
- **If time is short, cut scope, not quality.** Protect: working demo → accuracy numbers → video → docs.
- **Dev log:** at the end of each session, add a short entry to `docs/DEVLOG.md` (done, decisions with the reason, learned, next). Keep it to a few lines. No chat transcripts, no secrets, no personal job-search notes.

## Working with the owner
- The owner directs and reviews; the AI writes the code. Explain every change in a few short lines: **what changed and why.**
- Keep explanations short and simple. Tables and bullets over long prose.
- Be blunt about problems and risks.

## Judging (for prioritizing)
Impact 30% · Use of Meta AI tooling 25% · Technical depth 20% · Demo 25%. 3-minute demo video; judges also review the code and the live app.
