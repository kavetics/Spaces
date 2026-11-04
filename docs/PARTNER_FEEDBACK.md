# Spaces: Meta Model API partner feedback

Shashank Kaveti · Nov 3, 2026

Muse Spark and SAM 3.1 together turned 8 phone photos of a room into a usable inventory: 45 of 57 things found across 3 real rooms. The biggest cost was time, since one merge call took 60 to 66% of every scan.

## What we built

Spaces scans a room in 8 guided photos and builds an inventory of what's there. People add who shares the home, decide what to keep, sell or let go, and track chores. A shared Space is then readable by Muse in the Meta AI app. Built solo in 10 days for the Indie track. Design: [DESIGN.md](DESIGN.md).

| Model | Job in Spaces | Calls per room scan |
| --- | --- | --- |
| muse-spark-1.3 | Names items in each photo with a rough location; merges the same item across photos; checks crops | 8 (one per photo) + 1 merge + 1 check |
| sam-3.1 | Outlines each item Spark named; plain code keeps the outline at Spark's spot | 33 to 56 |
| muse-spark-1.3 | Ask Muse answers with item citations; task suggestions; condition and price estimates; listing drafts; repeat checks | 1 per action |
| muse-image-1.0 | Generated and edited the welcome screen art | once, at build time |
| Muse in the Meta AI app | Reads shared Spaces through a key-based custom connector, e.g. to draft a Marketplace listing | per question |

Every call goes through the OpenAI-compatible endpoint from a Node server. Spark uses JSON schema output with `strict: true` and `reasoning_effort: low`; SAM calls send `store: false`.

## What worked well

- **Strict JSON schema output was dependable.** Every Spark call returns a schema with `strict: true`, and plain code only had to check values, not parse prose. Giving the model a fixed list as an enum (instead of letting it type a name) fixed failures from small spelling differences.
- **`reasoning_effort: low` halved latency with no visible quality loss.** A room report went from 16 s to 8 s. Most of our calls run at low.
- **Spark and SAM split the work well.** Spark names an item and points at it; SAM finds every match for that word, and plain code keeps the outline at Spark's point. Neither model alone gave usable crops: SAM on its own returned "10× wall art" for one picture.
- **SAM was fast and never failed.** 3 to 6 s for 33 to 56 outlines per room, with no failed calls in the measured scans.
- **Spark judged sameness well.** It matched the same sofa from another angle and kept a similar loveseat separate.
- **Spark stayed grounded in what it was given.** Listing drafts mentioned listed defects and stayed modest on price; Ask Muse cited only items it was sent (plain code checks this too).
- **Muse in the Meta AI app built a custom connector from a key-based API** with no special SDK, and refused to guess when a call timed out.
- **muse-image-1.0 produced usable art** in about 20 s per generation and 13 s per edit, WebP output.

## Friction, ranked by impact

| # | Issue | What happened | Impact | Our workaround |
| --- | --- | --- | --- | --- |
| 1 | One long call with no progress | The merge call (one Spark call over 33 to 56 crops) took 106 to 133 s, with nothing sent back meanwhile. | 60 to 66% of every scan. The phone gave up after 90 s of silence, so big scans failed with "Couldn't reach the app". | The server sends a "still working" line every 15 s. The call itself is still as slow. |
| 2 | 404 `model_not_found` from a hosted server | The same key worked from a Mac and failed from Render. Meta said on Discord it was likely an entitlement caching issue. | Calls from the live app failed with an error that looked like our bug. | Retry 404s up to 3 times with growing pauses. |
| 3 | 402 "Billing verification failed" on every call, mid-session | Every SAM call started failing at once. | Our code first read the failures as "nothing found" and showed a wrong answer to the user. | Surface the API's own error when most calls fail. |
| 4 | Hackathon credits only cover `-contributor` models | Their inputs may be used for training. Our inputs are photos of homes, which can show people. | We couldn't use the credits for vision calls and paid for usage directly. | Standard models only, `store: false` on SAM. |
| 5 | SAM finds every match for a word | "sofa" returns every sofa; "wall art" returned 10 outlines for one picture. | Needs a second step to pick the right one. | Spark gives a rough location; plain code keeps the matching outline. |
| 6 | SAM prompt wording matters | "stairs" scored 0.55 on a clear staircase; "staircase" scored 0.70. | Hard to tune without a guide to the words SAM expects. | Let Spark choose the prompt word. |
| 7 | Results vary between runs | The same 8 photos gave somewhat different item lists on reruns. | Accuracy has to be measured over several runs to be trusted. | None yet; doubtful items are kept and marked "Not sure". |

## Measured

On 3 real rooms in one home, the pipeline found 45 of the 57 things the owner listed by hand (79%). It's one scan per room and one person's list, so it shows behaviour, not a general rate. Method and details: [ACCURACY.md](ACCURACY.md).

| Room | Things listed | Found | Missed | Total scan time |
| --- | --- | --- | --- | --- |
| Living room | 33 | 25 | 8 | 171 s |
| Foyer | 15 | 12 | 3 | 174 s |
| Parlor | 9 | 8 | 1 | 202 s |

Misses were mostly small things on other surfaces (clutter on a TV stand, a tiny bust), wall fixtures (sconces, a blinds remote) and coats on a rack.

Where each scan's time goes, in seconds:

| Step | Model | Living room | Foyer | Parlor |
| --- | --- | --- | --- | --- |
| Name items in each photo (8 calls in parallel) | muse-spark-1.3 | 43 | 40 | 56 |
| Outline items | sam-3.1 | 6 | 5 | 3 |
| Merge repeats across photos (1 call) | muse-spark-1.3 | 106 | 119 | 133 |
| Check crops (1 call) | muse-spark-1.3 | 16 | 10 | 9 |

The merge call's time did not track how much it compared: the parlor had the fewest sightings (33, against 56 in the living room) and the slowest merge. It is the one step a person waits on with nothing to show.

## Asks for the Meta Model API team

1. **Stream structured output, or send progress on long calls.** A JSON-schema call that runs 2 minutes should stream partial results or keep-alive events, so apps can show progress and phones don't drop the connection. This was our biggest problem.
2. **Document latency by input size and effort level.** Even rough numbers (seconds per image, per 1,000 input tokens, at low vs medium effort) would let builders design around waits before they hit them.
3. **Make account and entitlement errors unmistakable.** A 404 `model_not_found` caused by entitlement caching, and a 402 mid-session, both looked like app bugs. A distinct error code and a status page would save hours.
4. **Offer hackathon credits on the standard models,** or a privacy-safe option for them. Builders handling personal photos can't use the `-contributor` models, so the credits miss the apps that most need care with data.
5. **Let SAM take a location hint.** A point or rough box from another model, to return only the matching instance, would remove the most custom code in our pipeline.
6. **Publish SAM prompt guidance.** Which words work best ("staircase" over "stairs"), and how scores compare across prompts.
7. **Add a seed or more deterministic option for vision calls,** so accuracy can be measured once and trusted.
