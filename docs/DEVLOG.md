# Room Rush: Dev Log

A short daily record of what was built and decided during the Meta Global AI Developer Hackathon (Oct 27 – Nov 4, 2026). All work in this repository was created during the hackathon.

Format: what got done, key decisions (with the reason), what we learned, what's next.

---

## Tue Oct 27: Kickoff and planning
**Done**
- Reviewed the hackathon rules, judging rubric and resources
- Set up accounts: Meta Model API, Supabase, GitHub

**Decisions**
- **Indie track, "Build for Your World" theme.** Solo build.
- **Initial idea: "Mystery Quest,"** an AI planner that turns group-chat plans into a mystery outing with verified photo challenges.

---

## Wed Oct 28: Pivot to Room Rush, project setup
**Done**
- Verified the Meta API key; confirmed available models (`muse-spark-1.3`, `sam-3.1`, `muse-image-1.0`, `muse-wonder-1.0`, `muse-voice-transcribe-1.0`)
- Verified the Supabase connection
- Created the Git repo, `.gitignore`, `.env.example`, `CLAUDE.md` (project rules for AI coding agents)

**Decisions**
- **Pivoted from Mystery Quest to Room Rush:** an AI party-game producer that reads the room from one photo, designs a safe game from what's there, runs it, referees results, and makes a highlight reel.
  - *Why:* Mystery Quest was two products glued together (planner + scavenger hunt); date matching added nothing to the demo; bookings couldn't be delivered; city-quest apps already exist. Room Rush is one focused product with a smaller scope and a stronger demo.
- **Single phone, no accounts** for the MVP. *Why:* multi-device sync is the biggest time and bug risk. Revisit at the Sat Oct 31 checkpoint.
- **Regular `muse-spark-1.3`, never `-contributor` variants.** *Why:* photos contain people.
- **Safety is a product feature:** no alcohol, heights, stunts or physical risk in generated games, enforced in prompts and in code.
- **Referee challenges must be judgeable from a single photo** (count, height, presence, pose). *Why:* video judging is too unreliable for this timeline.
- **Real footage only in the demo video.** *Why:* the rules require showing the real product; faked usage risks disqualification.

**Learned**
- Judging weights: Impact 30%, Meta tooling 25%, Technical depth 20%, Demo 25%. Impact will be our weakest category, so we win on Demo and Tooling.
- Several other projects use SAM + Muse Spark with verification steps; verification alone won't stand out. The read-the-room game design is our differentiator.

**Done (evening build session)**
- Node/Express server + Meta API client (Muse Spark structured JSON, SAM 3.1 segmentation)
- **Space report:** Muse Spark lists props, fixtures (with allowed actions), hazards (with a fix), space size and notes on people who shouldn't be asked to play; SAM 3.1 verifies and counts every item
- **Location safety check** (~3 s): go / caution / move. Streets, railroads, parking lots, water edges and rooftops are always "move", enforced in code.
- **Latency-hiding flow:** safety check → head-count question right away → report and game cards in the background → instant filter by the host's answer → rounds written while the host reads the cards
- **Mobile web app** (React): snap, verdict, head count with seated roles, game cards, rounds, and a "What the AI saw" overlay (people/props/fixtures/hazards)
- Referee pipeline (SAM measures, code computes, Muse Spark rules) built and smoke-tested; not yet in the app

**Decisions**
- **Host confirms the player count; the AI never decides who plays.** It flags people who probably shouldn't (a baby, someone asleep) and asks. *Why:* the host isn't in the photo, and judging people from a photo is unreliable and intrusive.
- **Hazards are called out with a fix, not silently dropped.** *Why:* some things need to be moved before playing.
- **Indoor and outdoor** spaces supported. *Why:* backyard parties are a core use case.
- **Safety rules live in code as well as prompts:** seats only for sitting; no touching windows, glass, stairs, pools or grills; banned-content check on every game; never cover faces or pile people; crowd limits by space size.
- **Muse Spark reasoning effort "low":** halved report time (16 s → 8 s) with equal quality.
- **Game cards first, rounds on demand:** host wait after answering fell from 8.6 s to ~0.1 s; after tapping a game, ~0 s.
- **SAM requests use `store: false`** so photos of people aren't retained.
- **Mobile web app, not a native iOS app.** *Why:* judges need a link; no Xcode time.

**Learned**
- SAM 3.1 works best with simple nouns ("pillow"), not descriptions ("blue striped throw pillow").
- The two-model check catches hallucinations: Muse Spark "saw" a pillow that SAM couldn't find, and it was dropped.
- Over-strict safety prompts starve the game designer; separating props (handle) from fixtures (use as zones) fixed it.
- A web page can't force the iPhone's 1× lens through the native camera; an in-app camera needs HTTPS.

**Late decisions**
- **Video referee:** every round is a 5–15 s clip; the referee judges from frames (last frame for results, ~2/sec for what happened). *Why:* we record the action anyway, so one capture serves both refereeing and the reel, and short rounds give games a clear structure. Both SAM 3.1 and Muse Spark accept video; limits are undocumented, so test first.
- **Highlight reel deferred** until the referee works.
- Fixed: overlay boxes now line up (drawn on the same shrunk image the AI analyzes); people in paintings, photos and screens are no longer counted (Muse Spark sorts SAM's person boxes).

**Next**
- Test clip: 5–10 s, everyone freezes and one person moves slightly → test SAM tracking vs. frames → Muse Spark
- Recording screen in the app (record a round → referee result with outlines)

---

## Thu Oct 29: Classics library and AI experiments
**Done**
- **Curated classics:** Freeze Dance, Hot Potato, Tower Stack, Scavenger Rush. Rules, player ranges, round lengths and referee checks are fixed and vetted; Muse Spark only adapts them to the room (which prop, where to play, home base, setup line).
- **AI Experiments section:** games invented for the room, tagged "AI-invented · untested" with a note that the referee may be less reliable.
- **docs/ROADMAP.md:** pitch-only items (community library, multi-phone, group chats, glasses, reel export, connectors, accessibility).

**Decisions**
- **Classics first, AI experiments second.** *Why:* proven games are more fun, safer and easier to referee accurately; AI still adapts and referees them, and the experiments keep the creative side, clearly labeled.
- **Community library is roadmap only.** *Why:* no users yet (never fake popularity), and user-submitted challenges need moderation before launch.
- **Code verifies the AI's prop choice** against SAM's counts: Tower Stack is skipped when there are fewer than 3 stackable items.

**Learned**
- Letting the model type a prop name failed on small spelling differences; giving it the verified list as choices (an enum) fixed it.

### Video referee test (Freeze Dance, 10 s clip, 1 player)
Ground truth (checked frame by frame): dancing 1.0–5.5 s, frozen 6.0–8.0 s, moved at 8.5 s.

| Method | Result | Time |
|---|---|---|
| **A. Muse Spark watches the whole video** | Correct both ways (moved at 8.5 s; held still when the buzzer was at 8.0 s) | 10–14 s |
| **B. SAM 3.1 tracks the person through the video** | Clear numbers: outline shift ≤2% while frozen, jumps to 14% at 8.5 s | 28 s (all 302 frames) |
| **C. Frames (2/sec) from the freeze window → Muse Spark** | **6/6 correct** (3 held-still, 3 moved, all at 8.5 s) | **3–5 s** |

**Decision:** referee = frames → Muse Spark for the call, plus SAM on the same frames (in parallel) for a measured "movement meter" as evidence. Whole-video calls are too slow for a party.
**Untested:** several players at once, a hand-held (shaky) camera, music playing.

### Recording screen + round referee
**Done**
- Round screen: instructions → record the round with the phone camera → frames pulled out on the phone (2/sec) → referee verdict, evidence frame with outlines, and a SAM "movement meter"
- **Freeze is detected automatically:** the iPhone camera covers the app while recording, so the app can't mark when the music stopped. The referee finds the moment the group goes still (SAM movement below 6%) and judges only after that.
- Last-frame games (Hot Potato, Tower Stack, Scavenger Rush, AI experiments) use the photo referee on the final frame
- Full flow tested against the live server: scan → head count → Freeze Dance → upload frames → "froze at 6 s, P1 moved at 8.5 s" (6 s referee time)

**Bug found and fixed:** framed photos on the wall were tracked as players P2 and P3 ("held perfectly still"), which also broke freeze detection. Players must now be at least 20% of the frame height.

**Decision:** keep the standard (non-contributor) models and pay usage directly. *Why:* hackathon credits only cover contributor models, whose inputs (including users' photos) may be used for training.
- Referee needs distance measurements ("closest pillow to the sofa")
- Games must respect prop counts (2 pillows can't serve 4 players)
- Test photos with people, outdoors, and unsafe locations

---

## Fri Oct 30: New plan, in-app camera
**Decisions**
- **One game first: Clap Catch.** New UI flow from the owner's sketches: consent → scan → reading → confirm → games → rules → referee mode (player x of y) → podium → share. Freeze Dance stays as the backup.
- **Own in-app camera** instead of the iPhone camera app. *Why:* we control the lens and zoom, and later get the audio and video as they're recorded (no slow frame pulling).
- **Room scan is a hold-to-record sweep** (owner's call). The phone compass tracks coverage and keeps one frame per 45° of turning (max 8); the video is kept for the reel. *Why one frame per direction:* a sweep shows the same couch many times, so each item's count is its highest count in any single frame, never the sum.

**Done**
- HTTPS on the LAN link (self-signed, `@vitejs/plugin-basic-ssl`); the iPhone camera requires it
- Camera: picks the 1× "Back Camera" lens, zoom limited to 1–2× (lens zoom if supported, else center crop), 4:3, grid, preview matches the photo exactly
- Screen ① consent + play safe, screen ② scan; capture feeds the existing read-the-room pipeline
- Hold-to-scan: coverage ring, "slow down" warning, min 2 s / max 30 s, timer fallback without a compass
- Server reads the room from 1–8 frames: Muse Spark lists which frames each item is in, SAM counts it only there (3 frames: report in 16 s vs ~8 s for one photo, hidden behind the head-count question)
- Verified in headless Chrome with a fake camera and a simulated 360° turn (8 frames, 100% coverage, end to end); iPhone test pending
- **Live labels while scanning:** each sweep frame gets a quick SAM 3.1 look for 10 party-relevant things (person, ball, pillow, couch, chair, table, lamp, TV, ceiling fan, staircase), all in parallel (~1.5–2 s per frame). Labels pop up as the host turns; hazards in yellow. *Why a fixed list:* SAM finds what you name but can't name things itself; Muse Spark's report stays the source of truth.
- Camera is now full screen and always 1× (zoom buttons removed).

**Learned**
- SAM prompt wording matters: "stairs" scored 0.55 on a clear staircase, "staircase" 0.70.

### Guided scan (replaces the hold-to-record sweep)
- **Decision (owner's design):** no video. The host stands in the middle of the room, taps Start, and is guided to 8 directions (every 45°, turning right) plus one ceiling shot. *Why:* photos taken while still are sharp, coverage is predictable, and the ceiling shot catches overhead hazards (fans, chandeliers) that matter for throwing games.
- Photos are taken automatically when the phone is lined up (compass) and still for 0.4 s: a target dot and ring show where to turn; timed prompts if there's no compass. "Done turning" after 4 shots, "Skip ceiling".
- Scanner look: corner brackets, moving mesh, sweeping scan line, progress pips, "Got it ✓ 3 of 8".
- Muse Spark is told how the photos relate (one spot, turning right, frame 8 = ceiling) and to check overhead hazards.
- Verified with a simulated phone turning through the real room photos: 8 sides + ceiling captured, live labels (couch ×2, lamp, stairs, ball, pillow ×2, table), full flow to the head-count question. iPhone test pending.
- **Ceiling guide fixed** (owner report: "doesn't really work"). Two bugs: the dot sat *below* the ring (following it meant tilting down), and the "hold still" check counted compass swings, which jump around when the phone points up, so the photo never fired. Now: dot above the ring with a bouncing ↑, only tilt counts for the ceiling, 30° up is enough, and "still" = moved less than 5° over the last 0.3 s (robust to sensor jitter). Simulated with hand wobble: fires 0.5–1.3 s after lining up.

### Clap Catch: record a turn + catch referee + test mode
**Decisions**
- **Caught or dropped only for now; no scores or winner.** Clap counting is in the backlog (owner's call).
- **No "hold the pose" rule, so the referee follows the ball through the whole clip:** SAM on every frame (4/sec), code finds the throw's peak and where the ball ended, Muse Spark rules caught, dropped or unclear from up to 12 frames after the peak.
- **Accuracy test is voice-guided (owner's idea):** one continuous recording, the phone calls out catch or drop, so every turn is labeled automatically and can be re-run as the referee changes.

**Done**
- Turn screen: player x of y, hold to film or solo (3-2-1, 10 s), review, redo or submit, verdict
- `?test=catch` (20 throws) saves labeled turns to git-ignored `test-photos/catch-runs`; `npm run test:catch` reports accuracy

**Verified:** full flow with a fake camera; one synthetic falling ball (real ball pasted on a person frame) called "dropped" in 7.3 s. **Not yet tested on any real throw; accuracy unknown.**

**Learned:** SAM ignored a flat painted circle but found the real ball at 0.78 confidence even at about 20 px.

### Clap counting
- **Back in scope (owner's call):** clap counts decide the winner. Plain code finds sudden loud spikes in the sound and counts those between the throw (from SAM's ball path) and the catch; the spike at the catch is the ball landing. A drop scores 0.
- `?test=claps`: 13 on-screen-guided turns with the mic on, labeled with the expected count. `npm run test:catch` reports clap accuracy.
- Verified with math checks and a fake mic. **Not yet tested on real claps or the iPhone mic.**

### "What the AI saw" for Clap Catch
- **Live while judging:** the referee streams each step (one JSON line each), so the phone shows every frame with SAM's ball box, then the throw, then Muse Spark's call.
- **Replay after:** the video with the ball outlined, a trail, and throw/clap/catch markers appearing on time; tap a marker to jump. Each player's report stays available at game over.
- *Why:* it makes the AI's work visible, which serves both the demo and trust in the referee's calls.
- Report also shows an audio map: the clip's sound with every spike marked, counted as a clap (green) or not (grey), so a clap count can be checked by eye.

### Test menu, camera retry
- `?test=menu`: direct links to a real turn and both accuracy tests, no scan needed. *Why:* testing kept requiring the whole flow.
- **Phone reports camera steps to the Mac in dev** (we can't see its screen). It showed iPhone Chrome refusing the camera on page load (NotAllowedError) three times, then allowing it. Added a "Turn on camera" button that asks again from a tap.
- Tests and Solo use the front camera, so the player can read the screen and see the shot. Hold-to-film stays on the back camera. Voice in the catch test is now pre-recorded clips; browser speech was silent on iPhone.
- **Test rhythm rebuilt (owner feedback: the pacing was off):** each turn is now task → 3-2-1 → GO with a 6 s timer → the referee checks it live → correct or missed → get the ball → next. Each turn records its own clip, so sound timing matches a real game. Score shows as you go.

### Catch accuracy: first real result
20 of 20 correct (10 catches, 10 drops), front camera, one player, one room: one hand, against the chest, drop then pick up. Median about 8–9 s per turn; 36 SAM calls and 12 Muse Spark frames per turn. Target was at least 90%, but 20 turns from one person is a small sample, and these were deliberate catches and drops.

### Clap accuracy: first real result
Exact clap count on 10 of 11 caught turns (1, 2, 3 claps; claps after the catch ignored); all 13 catch calls right, making 33 of 33 across both tests. The one miss: a single quiet clap removed as the sound of the catch. Left untuned: one miss isn't enough to tune on, and the same rule correctly removed a real catch sound in another turn. Quiet room, one player; noise is untested.


### Multiple players and rounds
- Setup screen (1–8 players, names, 1/3/5 rounds), turn order, scoreboard between rounds, final standings with every turn's report, Play again. Total claps with clean catches decides; catches break ties. Turn-based, so the player cap is about patience, not technology.
- Muse Spark now judges only the person throwing, since others may be in the shot at a party.
- Hosting: one Render service serves both the API and the built app (`render.yaml`).

### Meta API 404 on hosted servers
Render gets 404 model_not_found from Muse Spark while the same key works from the Mac. Per the hackathon Discord, Meta confirmed it isn't caused by builders and is investigating a likely entitlement caching issue. Added retries (3, with growing pauses) for 404s only, because the error can clear up on its own. This won't fix Render if every call fails; open a support ticket and report it in the partner feedback.

### Voice and hands-free Solo
- Owner feedback: the game was too quiet. The phone now speaks: the task, 3-2-1-Go, and the verdict with the clap count (pre-recorded clips, shared with the tests).
- Solo is hands-free after the first START: turns submit, advance and restart by themselves, with a "tap to stay here" escape.
- "Load failed" on a turn: not reproduced from the Mac (4 of 4 saved turns fine), so likely the phone's connection. The phone now resends up to 3 times, since the frames are still in memory. Each judged turn reports its numbers to the Mac in dev.
- Noticed: a replayed turn counted 2 claps, then 1 on another run, because Muse Spark's catch time varies. Worth a stabler catch time.
- Game voice was silent on iPhone with the mic open all game. The mic now opens only while a turn records. Big instruction cards added to the game, with a voice test on setup. Phone reports also go to a git-ignored log file.

### Mic fix and test recording
- Owner saw a mic prompt mid-game: that caused the freeze. The mic is now requested once when the host taps Start game, and each turn waits for the mic before saying Go.
- Test recording (dev Mac only): each game's timeline, video, frames, sound map and referee result go to the git-ignored `test-photos/sessions`. `npm run review` shows stalls, failures and suspicious calls; `--rerun` replays turns through the current referee. Consent updated to say footage is saved and reviewed; saving stays off in the hosted app.

### First reviewed game: billing error hidden as a referee call
Session recording found it right away. Meta's API started answering 402 "Billing verification failed" on every call. The referee swallowed SAM errors, saw no ball, and told the player "I couldn't see the ball". Now, if most SAM looks fail, the real error is shown. The timeline also lost about 4 minutes of events to a dropped connection; unsent events are now kept and resent.

- Owner's call: Clap Catch is the only game for now. Classics and AI-invented games stay in the code but aren't generated or shown, which saves API calls and wait time after the scan.

### Turns without interruptions
- Owner's call: no verdict or AI screen between turns. Turns run back to back, the referee works through a background queue, and "Getting the results…" finishes what's left after the last turn of each round. The AI analysis still shows on that screen, and the replay stays in the final report.
- Since nobody sees a verdict during play, the results screen offers a Retake for turns the referee couldn't call, that lost their clap count, or that failed.

### Voice test result, flow fixes
- Voice test on iPhone (Chrome, Safari): no clip stuck in any logged run; both playback methods sound alike; the mic opens in about 0.9 s; the owner heard better sound with the mic closed, and tapping noises with it open. Decision: mic closed except during a turn.
- The last game's 24 s countdown and stuck timer came from clips that hung while the flow waited on them. Timing no longer waits on voice; clips load into memory up front and fall back to Web Audio. Nothing speaks until a turn starts; Go and Time mark each turn. One camera + mic prompt on the first tap.
- Clap count no longer goes blank when SAM misses the throw: everything up to the catch counts (a missed throw lost 4 correctly heard claps).


### Referee fixes from the first reviewed game with players
Two of three real turns came back "couldn't tell". SAM not finding the small ball no longer skips Muse Spark; frames are chosen from the first clap or the throw, whichever is earlier (16 frames, up from 12); Muse Spark is told it won't see every moment. Spikes in the first 0.25 s are ignored (the mic opening).
- Clap counting now follows the claps' rhythm (a long gap ends the burst; a late last spike near the catch is the ball landing), because Muse Spark's catch time shifts between runs. Reran saved turns: catch 33 of 33, exact claps 11 of 11. Those turns also guided the tuning, so this needs fresh turns to confirm. Turns from other players aren't labeled yet.

### Post-scan flow, resume, shorter turns
- "How many players?" appears as soon as the scan finishes; the room check runs behind it. Games talk is gone: Clap Catch opens next. One player is allowed, with a note. Clearly unsafe locations and rooms rated small are blocked, with a rescan; hazards are warnings.
- Turns are 6 s: catches so far came by about 4 s, and it means 40% fewer frames. The mic opens after "1", which caused a blip in the voice.
- A game survives a page reload: progress and clips are stored on the phone (IndexedDB), with a "Resume your game?" prompt. A turn mid-recording is lost, so that player goes again; unchecked turns get checked on resume.

### Recording started too late
Two of three players had thrown before recording began (first frame already mid-play; no claps recorded), because the mic opened after "1", leaving about 2 s before recording. The mic now opens before the countdown, and recording starts as "1" ends, on "Go". Sounds in the first 0.45 s are ignored as the word "Go".

### High throws leaving the frame
Owner's point: the highest throws earn the most claps, so a ball leaving the frame must never count against the player. Muse Spark is told it's normal, and what matters is the ball being in the hands afterwards. Code now detects a rising ball that disappears, as a throw, and passes when it left and came back. `?test=high` added: 10 labeled high throws.

### Hung test: the phone dropping off Wi-Fi
A test froze with about 2 minutes of silence, then a burst of logs and "Load failed", like the earlier 4-minute stall. From the Mac, pings to the router were 15 of 15, and to the phone 19 of 30 ("No route to host"). Requests could wait indefinitely. Added time limits with retries: referee (30 s of silence, 4 tries), test saves, session saves and logs.
- Scan upload had no time limit: in a new location, the phone lost its link to the Mac and the room check waited forever. It now gives up after 30 s, tries once more, then says what to check. Some networks may also block devices from reaching each other, so the hosted link matters.

### Party feedback: a start signal for everyone
- First real group game (5 players, hand-held, hotspot): finished with no errors logged in about 80 s; the owner's count matched the app on 3 of 4 catches. People threw as soon as they got the ball, because hold-to-record gave them no start signal.
- Someone films is now the default: tap Start, 3-2-1-Go, 6 s or tap Done. A spoken rule at game start says to wait for Go. Solo moved to setup, and stays hands-free.
- Clap bar fix: a loud pop in the ignored start set the bar so high that one player's 4 claps counted as 0.
- Party footage reviewed. Clap counts still depend on Muse Spark's rough catch time: one saved turn gave 1, 2 and 1 across three runs. When SAM misses the throw, sounds before it can count. Both are next on the list.

### Referee rebuilt around phases (owner's design), and VAR
- A turn is now ready → throw → in the air → caught or dropped. Muse Spark names the player and object from the first frames, SAM 3.1 outlines them once, then Muse Spark labels what the ball is doing in each frame. Plain code reads the labels and finds the phases; only sounds while the ball is in the air count. Picking up a dropped ball can't change a drop, and only the first throw counts. If no catch or drop is seen, the call is "couldn't tell".
- SAM calls per turn: about 36 down to 2. Spark frames: 16 up to 24 plus a short identify call.
- VAR (owner's idea): on the final results, a player can request a review. SAM follows the ball through every frame, Muse Spark looks harder, and the new call replaces the old one.
- On saved footage, each party turn repeated its call and clap count across 4 runs (one drop's clap reading varied, but drops score 0). Labeled tests: catch calls 33 of 33; claps 11 of 11 offline after a rhythm rule for the catch sound. Those turns guided the tuning, so fresh turns are needed. Average 18 s per turn in that run (three test suites at once), up from about 10 s, but it runs in the background now.

### Room Scavenger (second game)
Makes the scan matter: Muse Spark writes clues from what the scan verified in this room; the player walks, finds it, and shows it to the camera; SAM checks the last frame and Muse Spark judges. Plain code blocks unsafe clues and items, swaps in safe backup clues, and scores (one point per second left, at least one). The two games share the camera, turns, queue, results and resume through a small game definition.

### Direction: seniors, standing or seated
Owner's direction, personal to them: Room Rush for group activity time in senior communities, for camaraderie and entertainment. No health claims. Setup now asks Standing/Walking or Seated. Seated Clap Catch uses a balloon with an 8 s turn; seated Scavenger clues are solved with what's worn or within reach (15 s). Standing modes are unchanged, for active players. Not yet tested with a balloon or with seniors; talk to an activities director first.

- Senior communities moved to a future application, after the owner spoke with someone who has volunteered extensively at one. Seated modes stay in the app.

## 2026-11-01: Pivot to Spaces, recognition
- **Done:** Astryx design system, welcome screen with consent, simplified scanner (8 photos, no ceiling), inventory from a scan.
- **Decisions:** Spark points at each item and SAM only sharpens the outline, because SAM finds every match for a word and gave "10× wall art". Plain code does matching, merge rules and quantities. Doubtful items stay, marked "Not sure", because the crop check also failed real small items.
- **Learned:** results vary between runs on the same photos, and small, distant items are the weak spot. Merging worked on overlapping crops; not yet tried on a real 8-photo scan.
- **Next:** scan real rooms, score against an answer key, then save and correct items.

## 2026-11-01: Recognition fixes from the first real scan
- **Done:** latest scan stays on the phone; clutter skipped in prompt and code; repeats fixed; every item has a picture.
- **Decisions:** neighbouring photos barely overlap, so big items are cut in half with different names. Code now flags items cut at touching edges as hints for Spark, and allows merges along a chain of photos.
- **Learned:** rug and all three sofas came out right in 2 of 2 reruns on the same scan (these fixes were tuned on it, so a fresh room still needs testing). A scan takes about 90 to 110 s, and merging is over half of that.
- **Next:** score a fresh scan; speed up merging.

## 2026-11-01: Spaces have names and boundaries
- **Done:** name the Space before scanning; Spark marks what's in it and which area everything else is in; "Also spotted nearby" with add or leave out, saved on the phone.
- **Decisions:** labels instead of an entrance photo, because an open plan has no doorway to mark the edge. The person has the final say, and nothing nearby silently disappears.
- **Next:** test on a fresh room; speed up merging.

## 2026-11-01: Categories
- **Done:** 8 categories with one-line rules; results grouped with counts, "Not sure" last in each. Older saved scans still sort correctly.
- **Learned:** a shorter list with rules stopped items like dumbbells changing category between runs. Item counts still vary (44 and 54 on one scan) because the mantel's small statues sometimes split up.
- **Next:** make small-item grouping steadier; test on a fresh room.

## 2026-11-01: Your Spaces page
- **Done:** one record per Space on the phone, a page listing them, scan another room, rescan, delete. Existing scans convert automatically. Per-item add and leave out.
- **Decisions:** recognition runs outside the results screen so it continues while people look elsewhere, one Space at a time because each run costs money.
- **Next:** test on a phone; item corrections.

## 2026-11-01: Cleaner item lists
- **Done:** removed items are deleted right away with a few seconds of Undo; categories and the nearby section collapse and stay as left.
- **Next:** a rescan can bring removed items back, since matching items between scans isn't built.

## 2026-11-02: Ask Muse
- **Done:** Digital inventory section; Ask Muse page for one Space or all Spaces; inventory sent as a linked structure (Space, area, category, item, photo); citations open the scan photo with the item outlined.
- **Decisions:** the phone sends the inventory with each question, so nothing has to be stored on the server. Plain code drops citations that weren't in what was sent.
- **Learned:** answers took about 2 to 5 s on a small test inventory. The graph's value so far is citations and scope; a speedup is unmeasured.
- **Next:** test on a real inventory and iPhone, including the keyboard.

## 2026-11-02: Removed the game code
- **Done:** game screens, routes and scripts removed (old version at tag `room-rush-games`); `CLAUDE.md` and `AGENTS.md` now describe Spaces.
- **Measured:** first fresh room: 13 of 13 items correct, none missed, 12 of 13 quantities right (a sconce counted 1, should be 2). One small room, counted by the owner.
- **Next:** Muse app connection if available; otherwise sell listing.

## 2026-11-02: Muse connector test
- **Done:** connector live with the key active; Muse can create a custom connector from a key-based API.
- **Learned:** the first Muse test failed because it was given the wrong host (room-rush.onrender.com, which isn't ours). The live address is room-rush-0ivl.onrender.com. Muse refused to guess when the call timed out.
- **Decisions:** focus the story on decluttering with family decisions; real data for Muse comes from a per-Space "Share with Muse" with an owner key.
- **Next:** retest Muse on the right host; Share with Muse on Supabase; decisions and progress.

## 2026-11-02: Share with Muse
- **Done:** per-Space "Share with Muse" switch; shared Spaces go to Supabase as item text, never photos; the Muse connector now reads only shared Spaces instead of sample data. Changes, rescans, unsharing and deleting keep Muse's copy current.
- **Decisions:** without accounts, an owner key (separate from the connector key) is needed to share. The table has row level security and no policies, so only the server's secret key can reach it.
- **Learned:** Supabase answers a minimal write with an empty body, which first looked like a failure.
- **Next:** set Render keys, retest Muse with real data; decisions and progress.

## 2026-11-02: Item details and decisions
- **Done:** item page with keep, sell, donate or toss; progress per Space. Choosing sell asks for more photos, then AI fills listing details (brand only when readable, size, condition, rough dimensions, estimated value), all labeled as AI estimates. Private fields (purchase price and date, serial number) stay on the phone.
- **Decisions:** details are only asked for items marked to sell, not during the scan, so scans stay fast. A field the person edits stops being labeled AI.
- **Learned:** on real sofa photos the AI left brand empty (nothing readable) and estimated $350; it takes about 10 s.
- **Next:** hide the Share with Muse switch for judges; listing draft; voice voting.

## 2026-11-02: Declutter
- **Done:** Declutter from Your Spaces: pick Spaces, then one item at a time with Keep, Sell or Let go, progress, Undo and Skip; Sell opens the sale form on the card. A summary lists what to sell (flagging items that still need photos) and what to let go. Let go replaces Donate and Toss. Items have a Save button.
- **Decisions:** buttons, not swipes, so three choices are hard to get wrong. Every decision saves as it's made, so stopping partway loses nothing. Nearby items stay out of the stack.
- **Next:** test on a phone; README and demo video.

## 2026-11-02: Reliable pictures, Declutter resume
- **Done:** item pictures and a Space cover are made once after a scan and saved, instead of cropping full photos every time a screen opens. Photos are stored as bytes. Declutter saves its place, and Your Spaces offers to resume.
- **Learned:** pictures failed on the phone but not on the Mac. The likely causes are memory (one full-photo decode per picture, all at once) and iPhone browsers losing Blobs saved in IndexedDB; both are now avoided. Not yet confirmed on the phone.
- **Next:** confirm pictures on the phone; README and demo video.

## 2026-11-02: Add more to a Space
- **Done:** Add more on a Space: scan from another spot or add photos. Only the new photos are recognized; Spark compares new items with the existing ones by picture, and likely repeats wait in "Possible repeats" for the person to confirm. Decisions and sale details are kept.
- **Decisions:** never merge silently: a confirmed repeat is removed, a "different" one is kept. If the check fails, new items are just added.
- **Learned:** on real photos, Spark matched the same sofa from a different angle and kept a similar loveseat separate (about 10 to 16 s).
- **Next:** test on the backyard; README and demo video.

## 2026-11-02: Scanning guide and multi-part scans
- **Done:** a guide (open room vs L-shaped Space) before every scan or rescan, with a Scanning tips link on the scanner. After each part, "Is there more?" offers another part, photos, or Done, while earlier parts process in the background.
- **Fixed:** a finished recognition run only started the next queued one if something else on the page changed; now it always checks again.
- **Decisions:** the backyard test of Add more found repeats well enough, so multiple scans is the approach for irregular Spaces. A block map and true spatial mapping (native app with Apple's RoomPlan, or matching items between scans) go on the roadmap.
- **Next:** README, Meta feedback report, demo video.

## 2026-11-02: Fix items, listings drafted by Muse
- **Done:** scanner text sits on dark pills and the aiming dot has a dark edge, for bright rooms. Items can be edited (name, category, quantity) and added by hand with an optional photo, marked "Edited by you" or "Added by you". On a sold item, Muse drafts a listing: title, description and a price range, editable and copyable, never posted. In Ask Muse, "help me sell the lamp" brings a card that marks it Sell and drafts its listing.
- **Decisions:** a rescan keeps hand-added items but replaces edits to scanned ones, and the dialog says so. Listings use only listing-safe fields, picked on the phone and again on the server, so private details never reach the model. Muse's action is checked like a citation: only a known kind, on an item really in the inventory.
- **Learned:** a draft takes about 4 s and an answer with a card about 2 s. Spark mentioned listed defects and stayed modest on price.
- **Next:** iPhone check, README, accuracy numbers, Meta feedback report, video.

## 2026-11-02: Share to WhatsApp and Marketplace
- **Done:** "Ask family" on an item sends its photo and "Keep, sell or let go?" through the phone's share sheet (WhatsApp, Messages). "Share listing" sends the drafted listing with its photo and also copies the text for Marketplace. Without a share sheet, WhatsApp opens with the text filled in. Renamed "Fitness & hobbies" to "Hobbies & gear".
- **Decisions:** no WhatsApp Cloud API or Marketplace API: Marketplace has no public listing API, and the Cloud API needs business approval and templates. Votes come back as WhatsApp replies for now; a vote link needs items on a server, so it stays on the roadmap. Spaces is upstream of Marketplace: it finds what to sell and hands it off, rather than competing with Meta's own listing tools.
- **Learned:** iPhones only open the share sheet straight after a tap, so the photo is prepared when the page opens.
- **Next:** iPhone check of sharing, README, accuracy numbers, Meta feedback report, video.

## 2026-11-02: Declutter one Space at a time
- **Done:** Declutter starts from a Space's page ("Declutter this Space") and goes straight to its first item. Each Space keeps its own place to resume, and Your Spaces shows "N left to decide" or "All decided" per Space. The Spaces picker is gone.
- **Decisions:** one room at a time is easier to follow and to finish than one session across Spaces. The family vote link will follow it: one Space per link. A rescan or delete forgets that Space's place, since item ids start over.
- **Next:** People (household list), then the family vote link.

## 2026-11-02: One Ask Muse, Add next to the inventory
- **Done:** removed Ask Muse from each Space's page; the chat on Your Spaces covers every Space. Declutter this Space is now the Space page's main button. "Add an item" sits on the Digital inventory heading row.
- **Decisions:** one chat is simpler, and Muse already sees every Space in it, so a question about one room still works ("in the living room, ...").

## 2026-11-02: People at home
- **Done:** a People page from Your Spaces: add people by hand (name, relationship, phone, the Spaces they use), edit or remove them. Each Space shows "Used by ...". Where the browser has the Contact Picker (Chrome on Android), "Import from contacts" adds picked people and skips repeats; elsewhere a note says how to turn it on in Safari.
- **Decisions:** people are added, never detected. The list stays on the phone: names, phones and relationships are never sent anywhere. Stored in the existing key-value store, so no database upgrade.
- **Learned:** the Contact Picker isn't in any iPhone browser by default, so the demo adds people by hand.
- **Next:** the family vote link, one Space per link.

## 2026-11-02: Family vote links
- **Done:** "Ask family to vote" on a Space, an item or the end of Declutter. Choose items (up to 25) and voters (people on the list), see what's shared, and send the link by the share sheet, WhatsApp to a saved number, or copy. Family open `/vote/<id>`, pick their name, vote Keep, Sell, Let go or Unsure, and can come back to change. The owner sees "Voted / Waiting for" on the Space and a tally on each item and Declutter card. A newer link replaces the older one; Stop deletes it.
- **Decisions:** one link per Space. The server keeps only item names, 320 px pictures, asking prices and voters' names, in two Supabase tables with no public access, deleted after 14 days. The owner's token stays on the phone; the server keeps its hash. Voters never see others' votes or the owner's decisions. Plain code checks every link and vote (known items, known choices, voters on the list, size limits, per-address request limits). "Not sure" became "Unsure" so all four choices fit a phone screen.
- **Learned:** pictures for a link are about 20 to 35 KB each. Local tests keep votes in memory (`VOTES_STORE=memory`); the real tables need `server/sql/vote_links.sql` run in Supabase.
- **Next:** run the SQL, try a link with family on their own phones, then README and the video.

## 2026-11-02: Phone numbers in full international form
- **Done:** the person form checks phone numbers and shows "For WhatsApp: +1 512 555 0101" as you type. A number that can't be a full one (like "555 0101") is refused with an example. Contact imports and the WhatsApp button use the same rules.
- **Decisions:** numbers are saved as + country code + digits, the form WhatsApp links need. One assumption only: a 10-digit number without a country code is a US number. Older saved numbers that aren't full get no WhatsApp button, rather than a link to the wrong person.

## 2026-11-02: Votes are Keep, Sell or Let go
- **Done:** removed "Unsure" from family votes. Voters skip an item instead; skipped items count no vote. The server no longer accepts it.
- **Decisions:** it added a tap without telling the owner anything a skip doesn't.

## 2026-11-02: For sale & letting go
- **Done:** one page for everything marked Sell or Let go, across Spaces, with a Space filter. To sell: price, listing status, missing photos and family votes on each row, not-listed items first, an asking total, and a Sold section with the total so far. To let go: Mark gone moves an item to Done. Opened from Your Spaces (with a count), "See list" on a Space (filtered to it) and the Declutter summary; items open with Back to the page.
- **Decisions:** across Spaces, unlike Declutter: it's a to-do list for selling and giving away, not a room-by-room pass. The only new field is `goneAt` on let-go items; the rest reuses decisions and listing status.
- **Next:** iPhone run-through, README, accuracy numbers, video.

## 2026-11-03: Shorter Sell form; end a vote and use the results
- **Done:** the Sell form shows what Marketplace needs: photos, asking price, condition, listing status and the listing draft. Brand, model, size, defects, dimensions and the rest moved into a closed "More details". The private fields (purchase date and price, serial number) are gone. A family vote can now be ended: the latest votes are kept on the phone, the link is deleted from the server, and a results screen shows each item's top pick with "Use" buttons and "Use all top picks" for undecided items. Clear removes the kept votes.
- **Decisions:** Marketplace's required fields set what's visible; the rest stays because it makes Muse's listings and answers better. Nothing used the private fields, so they went rather than being hidden. Votes stay advice: "Use all" only fills undecided items with a clear winner, and ties are left to the owner.
- **Next:** iPhone run-through, README, accuracy numbers, video.

## 2026-11-03: Simpler family vote controls
- **Done:** the Space page has one Family vote card with one button: Ask family to vote, See votes, or See results. Everything else is on one vote screen: votes so far, Send link again, and "End vote and use top picks", which closes voting, deletes the link and gives each undecided item the family's top pick. The results screen marks the picks it used, each with Undo, and offers Start a new vote. Items in an open vote show "In the family vote" with their tally instead of an Ask family button. Clear is gone.
- **Decisions:** five buttons that changed by state were confusing, so the card has one and the screen holds the rest. Ending and applying became one tap, at the owner's request; it never overrides a decision already made, skips ties, and every pick it used can be undone.

## 2026-11-03: Muse can list Sell items on Marketplace
- **Done:** in a shared Space, items marked Sell now send their listing draft and up to 3 small sale photos (about 640 px, 50 to 80 KB each; the scan picture if there are none). The connector gives each one a Marketplace-ready `listing`: title, description, price, condition in Marketplace's values, category, photos as JPEG data, and `missing` for what's still needed. A new `/listings` endpoint returns only items for sale.
- **Decisions:** photos travel inside the connector's answer, because Muse's Marketplace tool takes files and can turn image data into one, but can't take a link. Only Sell items carry photos, and room photos never leave the phone; the Share with Muse note says so. The server keeps photos only on Sell items, at most 3, JPEG, under a size cap. Location stays with the owner, told to Muse directly.
- **Learned:** tested against the real shared table with test-only keys (`.env.test`, git-ignored, and a `share-test` launch config); the test Space is removed afterwards.
- **Next:** owner tests Muse creating a listing; mockups of every screen for the redesign.

## 2026-11-03: Redesign around Things, People, Decisions and Muse
- **Done:** five screens follow the product model. Welcome says what Spaces does and shows the four parts. Home ("Your home") has Spaces, People, Decisions and Muse sections, with Ask Muse as the one main button. The Space page has the same four sections, Declutter as its one main button, and a "..." menu where Scan again offers "Add to this Space" or "Start over", plus Delete Space. The item page reads Thing, then Decision with the family vote, then selling, and ends with Done instead of a Save that needed explaining. "Items" became "things" on screen.
- **Decisions:** mockups of every screen were approved before building. Back from People and Ask Muse returns to where they were opened. The design rules live in the spaces-design skill, with a script that screenshots the main screens.
- **Next:** light-touch "tunnel of light" theme in warm white for the demo; README; video.

## 2026-11-03: Tunnel of light (warm white, light touch)
- **Done:** the welcome screen is a tunnel toward a warm light, made with Meta's `muse-image-1.0` (generated, then edited to remove a path and darken the floor) and credited "Art made with Muse Image". It doubles as the loading screen while the scanner loads; the light breathes and the image drifts slowly, both off with Reduce Motion. Main buttons are warm white through a small Spaces theme that extends Astryx's neutral one. Finding things shows rings pulsing toward the light instead of a spinner.
- **Decisions:** a generated image over hand-drawn art, since it matched the reference far better and uses Meta's image model; the stock reference itself is never used. A code fade keeps the text on near-black whatever the image does. Only one theme color changed, so every screen still has one bright main action.
- **Learned:** muse-image-1.0 answers in about 20 s (generate) and 13 s (edit) with WebP output, about 20,000 tokens a generation. The image is 70 KB in the app.

## 2026-11-03: Gold line tunnel, opening fade, people as initials
- **Done:** the welcome art is now a gold line tunnel with a glowing gold opening (Muse Image: a line-art redraw of the earlier tunnel, then an edit to fill the opening and clear the floor). Each load with Spaces saved opens with the same art for 2.4 s: it fades in, SPACES fades in as it rises, then it fades into the app (tap skips; off with Reduce Motion). The first-time welcome screen opens the same way. Home's Spaces list is a dropdown that remembers if it's closed. People show as initials (first letter of the first word) on home, on each Space row and on the Space page, with a count. The Things lists have more room between categories and rows. Ask Muse on a Space page is full width.
- **Decisions:** the line drawing was chosen over the shaded tunnel and over an animated draw-in; a plain fade and rise felt calmer. The Remove button stays on rows as the fastest way to clean up a list.

## 2026-11-03: UI kit review and polish
- **Done:** a UI kit page listed every element with its measured colours, sizes and behaviour, and the owner decided nine points from it. The app is now always dark, whatever the phone is set to, and main buttons are the gold of the tunnel lines. Photo crops and chat photos have rounded corners and the Ask Muse question bubble has a visible fill (both used theme names that don't exist). Remove on each Thing is grey. "Fill in details with AI" says to add a photo first. Ask Muse shows the gold rings while thinking. Every button is one height (32 px).
- **Learned:** measuring the built app found bugs that screenshots hid: in Light mode the app turned grey with black buttons, and two CSS sizes silently fell back to nothing. The flagged "Things (3) is smaller" was a measuring mistake (an inner span), so it stayed as is.

## 2026-11-03: Share with Muse, decision tags, My home
- **Done:** each Space has a **Share with Muse** switch, off for new Spaces. Turning it on first explains what leaves the phone, then puts the Space in Ask Muse's context. Ask Muse on My home uses only shared Spaces, and with none it links to each Space to share it. On the owner's phone (owner key entered, now under the Space's ··· menu), shared Spaces also go to the Spaces server for Muse in the Meta AI app, as before. Thing rows show the decision as a coloured tag (Keep green, Sell yellow, Let go blue). The opening has a bigger SPACES at the middle, with "Spaces, Things, People, and Decisions, ready for Muse" under it and the tunnel in the top half. "Your home" is "My home"; its People and Decisions buttons sit level with their headings. The phone hint on Add a person stays one line. Dropdown headings no longer show a tap highlight, which lingered on iPhone and ran under Add.
- **Decisions:** one switch for both Muses, because it's one Muse to the person. Off by default: people choose what's shared. The owner key no longer sits in the switch's path, so anyone can share with Ask Muse; only the owner's phone sends to the server.
- **Follow-up:** Keep is a grey pill, Let go matches Delete's red, and Sell carries its price ("Sell · $120") with "Asking price" or "AI estimate" beside it. The opening went back to the full-screen tunnel with the name low, keeping the bigger name and the new line.
- **Follow-up:** the scanner uses the Spaces theme: gold buttons, gold dot and hold-still arc, a ring that turns gold once lined up, and a gold flash on each photo.
- **Follow-up:** Add a person is its own page. On iPhone the Phone field's cursor drew a line too low; a cursor nudge and the move out of a pop-up didn't help. Moving the hint from above the field to below it, with the page scrolling the document, fixed it (tested on the owner's iPhone). The Family vote button sits on its title row, so a long "waiting for" list can't squeeze it.
- **Learned:** in iPhone Safari, a field with a hint between its label and its box can get a misplaced cursor. Keep hints under the field.

## 2026-11-03: Scans failing with "Couldn't reach the app"
- **Done:** found why big scans failed. The phone gives up after 90 s without hearing from the server, and merging repeats (one Muse call) took 89 s on a 56-sighting living room scan, with nothing sent meanwhile. The server now sends a "still working" line every 15 s; the phone ignores it for the on-screen step. If the server does go quiet after answering, the message now says it lost touch, instead of blaming the connection.
- **Measured:** the same 8 photos rerun through the server: merging 77 s, longest silence 15 s, 49 things, 130 s in all.
- **Next:** merging is the slowest step of a scan (about 60% of the time); worth trimming after the hackathon.

## 2026-11-03: Tasks
- **Done:** each Space has **Tasks**: chores with how often (once, weekly, every 2 weeks, monthly), the next due date, who does it, and any number of its Things. "Suggest tasks with Muse" sends the Things' names and who uses the Space; Muse suggests 3 to 5 tasks with who might do each, labelled "Suggested by Muse", and the person adds or skips each. Marking a task done moves a repeating one to its next date, or puts a one-time one under Done, with Undo. My home lists what's late or due this week across Spaces. Ask Muse and the connector's new `/tasks` route see the tasks of shared Spaces.
- **Decisions:** one task covers every Thing cared for the same way ("Water the plants" with all the plants), not one task per plant: Muse is asked to group, and plain code merges suggestions with the same name and schedule. Plain code also drops unknown Things, people and schedules, skips tasks already listed, and sets every date. Suggest is gold only while a Space has no tasks, so Declutter stays the main button after. A rescan keeps tasks and links them to the new Things by name.
- **Measured:** on the saved backyard scan (34 things), Muse grouped 15 plants into one weekly watering task on both of 2 runs, with 4 tasks in 13–16 s.
- **Follow-up:** Tasks is a dropdown on a Space and on My home, starting open and remembered. A task's page lists only its own Things, each with Remove, and "Add a thing" opens a pop-up of the Space's other Things by category (no search field, to avoid the iPhone cursor problem in pop-ups). Then a rule for every dropdown in the app: it's a dropdown only when there's something in it. Tasks on a Space is a plain heading with Add until it has a task (an all-done Space keeps the dropdown for its Done list), and Tasks on My home is plain until something is due this week. Every other dropdown already only showed with items; the Sell form's "More details" stays, since it holds fields, not a list. Tasks moved below Decisions on a Space and on My home, so the order is Things, People, Decisions, Tasks, Muse.

## 2026-11-03: Tidier Space and My home
- **Done:** picked direction A of three mockups (tidy, cards, Muse first). On a Space, who shares it is one line under its name; Things is a row of category chips, and tapping one lists that category below it (one at a time); Decisions has a progress bar; task rows are one line with the due date at the end ("Today", "Fri", "Nov 10"); Share with Muse is just the switch. On My home, People is one row of initials, and Muse says which Spaces it sees on its heading row. A description that only repeats an item's name is hidden.
- **Decisions:** chips open in place rather than on a new page, so Back keeps working as before. All open tasks show, since rows are one line now. Cards (B) and a Muse dock (C) were left for after the deadline: more new screens and iPhone keyboard risk. The 2-second opening on every reload is gone, since judges and people reopening the app saw it each time; the Welcome screen and its animation stay for the first visit.
- **Then:** Edit people is a gold underlined link. Decisions hides its bar once everything is decided and says "Decluttered on Nov 3" (the end of a Declutter run, saved as `declutteredAt`, or the last decision by hand) with a grey "Declutter again". Ask family (See votes, See results) and "Sell & let go (N)" sit side by side, with the vote's status under them. Task rows have more room. My home lists every open task from every Space, soonest first: it had shown only the next 6 days, so a new weekly task (first due in exactly 7) never appeared.
- **And:** Share with Muse is a pill at the top of a Space ("Share with Muse", or gold "Sharing with Muse" with a tick); turning it on still asks first. On My home, who shares the home is one line under its name with a gold Edit people link, Scan a Space sits on the Spaces heading row, and Decisions has a full-width "Sell & let go (N)" (or "See sold and gone").
- **Last:** the Share with Muse pill sits level with the Space's name, with More above it. Tasks on a Space is a plain section (it's the last one), with only Done folded; My home's Tasks stays a dropdown.
- **Muse dock:** My home's Muse section became a dock fixed to the bottom (from mockup C): "What could I sell?" and "What's due this week?" ask at once, and the "Ask Muse about your home" bar opens Ask Muse with the cursor in the box. The bar only looks like a text box, because a typed box fixed to the bottom misplaces the cursor on iPhone. With nothing shared it says "Share a Space to ask Muse" and shows no starters. My home only, for now. Ask Muse's own question box now matches the dock (gold-edged pill, round gold send arrow), so the dock reads as the same box. My home's Tasks heading shows how many are open ("Tasks (5)"). Small cleanups: Suggest tasks is always grey (one gold button per screen); an all-decided Space reads "Decluttered on Nov 3 · 1 to sell" on one line; nobody added reads "No one added yet"; the "Tap a category" hint and the "N not sure" count are gone (unsure Things still say "Not sure." in their row); a one-time task with no one assigned shows no "Once" line. "Scanned Nov 3, 5:57 PM" is back on a Space, as a small line under the Things heading, since the scan is where the Things came from. A Space's row on My home is two lines: its name (with small gold "Sharing with Muse" beside it when Muse can see it, the pill's words) and "34 things · 12 to decide"; no scan date or "Shared with Muse" line there. My home's Decisions line reads just "3 to sell, about $450", using asking prices, else Muse's estimates, as on a Space; let go, sold and gone counts stay on the Sell & let go page. The dollar amount is a green pill in its grey line, on My home and on each Space, and an item's Sell badge is green too: green means money, yellow only means due soon. UI frozen after this for the submission.

## 2026-11-03: Recognition accuracy, three rooms
- **Done:** the owner scanned the foyer, parlor and living room and wrote down what's in each; recognition ran again on the saved photos and was matched line by line, with the owner settling unclear matches. Results in `docs/ACCURACY.md`.
- **Measured:** 45 of 57 things found (79%): living room 25 of 33, foyer 12 of 15, parlor 8 of 9. 3 found but filed as nearby, 3 with the wrong count. About 3 minutes a room; the one Muse merge call is 60 to 66% of it. No failed photos or outlines.
- **Learned:** misses are small things on surfaces (TV stand clutter, a tiny bust), wall fixtures (sconces, a blinds remote), and things hung on a coat rack. Found-nearby items count as found; the owner decided wrong area isn't a miss.
- **Next:** speed up the merge step; video script; README for judges.

## 2026-11-03: Welcome screen
- **Done:** the caption is now "Your home, understood by Muse." over "Scan a room. Decide together. Keep up with the chores." (it left out Tasks before, and matches the README and the video's ending). The breathing is more dramatic: the gold glow swells from almost off to full and grows a third, while the tunnel brightens and leans toward the light, every 5 s.
- **Decisions:** picked from four options shown side by side on the real art. The pulse uses `scale` and `filter`, so it plays on top of the slow drift; it starts dim, so the first breath is the fade-in. Reduced motion still turns it off.
- **Tests:** older suites now open a category chip before looking for an item (`chips.mjs` in the scratchpad). The sell and listing suites' Ask Muse steps still fail: they predate the rule that a Space must be shared before Muse sees it.
- **Setup:** Supabase needs a `tasks` column (`server/sql/shared_spaces.sql`). Until it's added, shared Spaces still save, without their tasks.
