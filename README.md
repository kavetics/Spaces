# Spaces

**Your home, understood by Muse.** Scan a room with your phone and Spaces builds an inventory of what's there. Add who
shares it, decide what to keep, sell or let go, and keep track of the chores. Then share it with Muse, so Muse in the
Meta AI app knows your home the way you do.

Built solo for the Meta Global AI Developer Hackathon · Indie Developer Track · Build for Your World.

> ### For judges
>
> **In 30 seconds:** Spaces turns 8 phone photos of a room into a home inventory with `muse-spark-1.3` and `sam-3.1`,
> then lets people decide what to keep, ask family to vote, and track chores. Shared Spaces become context for Muse in
> the Meta AI app, which can then, for example, draft a Marketplace listing for a sofa marked Sell. On 3 real rooms it
> found 45 of 57 things, in about 3 minutes a room.
>
> - **Demo video (3 min):** https://youtu.be/mR-L1qUUaLk
> - **Live app:** https://room-rush-0ivl.onrender.com (the address still says `room-rush`, from an earlier idea)
> - **Try it in 2 minutes:** on a phone, tap Scan your first Space and turn through 8 photos. On a laptop, tap
>   "Upload a photo instead" on the camera screen, then add more photos from the Space page. Then tap a category,
>   tap an item to see it outlined in its photo, tap Share with Muse, and ask Muse from the bar on My home.
> - **Where Meta's models are:** scan to inventory in [server/src/inventory.js](server/src/inventory.js), Ask Muse in
>   [server/src/ask.js](server/src/ask.js), task suggestions in [server/src/tasks.js](server/src/tasks.js), the API
>   client in [server/src/meta.js](server/src/meta.js), and the Meta AI app connector in
>   [server/src/connector.js](server/src/connector.js).
> - **More depth:** [design doc](docs/DESIGN.md) · [measured accuracy](docs/ACCURACY.md) ·
>   [Meta Model API feedback](docs/PARTNER_FEEDBACK.md)
> - **Can't be tried here:** the Meta AI app connector serves only the owner's household, so it's shown in the video.
>   Saving scan photos happens only on the development server.

The last version of the earlier party game is at the git tag `room-rush-games`.

## Why I built it

When my parents moved to another city, they left me with their house and everything in it. I wanted to clear it out,
but didn't know where to start. Every decision meant taking a photo, sending it to family and waiting for answers. And
the garden needed looking after, which I'd never done before.

Spaces turns that into context Muse can use:

| Part | What it holds |
|---|---|
| **Spaces** | A room or the backyard, scanned in 8 guided photos |
| **Things** | What the scan found, sorted into categories, each with the photo it was seen in |
| **People** | Who shares the home, added by hand and never detected in photos |
| **Decisions** | Keep, Sell or Let go, made alone or with a family vote link |
| **Tasks** | Chores for a Space and its Things, like watering the plants weekly, with who does each |
| **Muse** | Ask Muse in the app, and a connector that lets Muse in the Meta AI app read the Spaces you share |

## What it does

1. **Scan a Space.** The camera takes 8 photos as you turn, each one when the phone is lined up and still.
2. **Build the inventory.** Muse Spark names what's in each photo, SAM 3.1 outlines each item, and Muse Spark merges
   the same item seen across photos. Unsure items stay in the list, marked "Not sure", for you to decide.
3. **Decide.** Go through Things one at a time (Keep, Sell, Let go), or send family one vote link instead of twenty
   texts. For things to sell, Muse Spark estimates condition and value from extra photos and drafts a listing.
4. **Look after it.** Muse suggests tasks from what the scan found, one task for every Thing cared for the same way
   ("Water the plants" with all 15 plants) and who might do each. Plain code sets every date and repeats them.
5. **Ask Muse.** Ask about all your Spaces at once: "What could I sell?", "What's due this week?". Every answer cites
   the items it's about, and tapping a citation opens the scan photo with that item outlined.
6. **Hand it to Muse in the Meta AI app.** Share a Space, and Muse in the Meta AI app can read it through a read-only
   connector, for example to draft a Marketplace listing for the sofa you marked Sell.

## How Meta's models are used

| Model | Where | What it does |
|---|---|---|
| `muse-spark-1.3` | `server/src/inventory.js` | Names the items in each photo and where they are, merges the same item across photos, and checks each item's crop |
| `sam-3.1` | `server/src/inventory.js` | Outlines every match for each item Muse named. Plain code keeps the outline that matches Muse's rough spot. |
| `muse-spark-1.3` | `server/src/ask.js` | Answers questions about the home from the inventory, People, Decisions and Tasks, citing items by reference |
| `muse-spark-1.3` | `server/src/tasks.js` | Suggests chores from a Space's Things, with who might do each |
| `muse-spark-1.3` | `server/src/itemDetails.js`, `listing.js` | Estimates condition and value from photos, and drafts a sale listing |
| `muse-spark-1.3` | `server/src/repeats.js` | Spots items added later that are already in the inventory, seen from another angle |
| Muse Image | `web/src/assets/welcome-gold.webp` | Made the gold tunnel art on the welcome screen (generated art, no people) |
| Muse in the Meta AI app | `server/src/connector.js` | Reads shared Spaces, Things, Tasks and Marketplace-ready listings through a read-only API |

All calls go through the Meta Model API (OpenAI-compatible, `https://api.meta.ai/v1`) from the server, which holds the
key. The `-contributor` model variants are never used, because photos of homes can contain people.

**AI judges, plain code checks.** Muse decides what things are and which sightings are the same item. Plain code
checks every merge, counts quantities, picks each item's crop, sets every task date, keeps prices and sizes in sane
ranges, and removes any citation that isn't really in the inventory, so Muse can't cite something invented. Nothing
AI-made is shown as fact: estimates and suggestions are labelled and editable.

## Measured results

On three real rooms in one home (one scan each, checked against the owner's hand-written list):

| | Things on the list | Found | Time per scan |
|---|---|---|---|
| Living room | 33 | 25 | 171 s |
| Foyer | 15 | 12 | 174 s |
| Parlor | 9 | 8 | 202 s |
| **All three** | **57** | **45 (79%)** | **~3 min** |

Misses are mostly small things on other surfaces, wall fixtures and coats on a rack. Merging repeats across photos
takes 60 to 66% of each scan. It's a small sample: details and method in [docs/ACCURACY.md](docs/ACCURACY.md).

## Privacy

- **Room photos stay on the phone.** Spaces, Things, People and chats are stored in the phone's browser (IndexedDB).
- **Sharing is opt-in, per Space.** A shared Space sends names, item lists and tasks to the Spaces server for Muse, and
  never room photos. Items marked Sell may carry up to 3 small sale photos for the listing.
- **People are added, never detected.** People and pets are never inventory items, and phone numbers never leave the
  phone.
- **Development only:** the development server saves scan photos to a git-ignored folder, so recognition can be
  measured. The live app doesn't.

## Code map

| Path | What it is |
|---|---|
| `server/src/index.js` | Express server: every API route, and serving the built web app |
| `server/src/meta.js` | Meta Model API client |
| `server/src/inventory.js` | Scan → inventory: Muse Spark, SAM 3.1 and the plain-code checks |
| `server/src/ask.js` | Ask Muse answers and citation checks |
| `server/src/tasks.js` | Muse task suggestions |
| `server/src/connector.js` | Read-only connector for Muse in the Meta AI app |
| `server/src/shared.js`, `votes.js` | Shared Spaces and family vote links, in Supabase |
| `web/src/App.jsx` | Screens and the recognition run |
| `web/src/spaceGraph.js` | Links Space, area, category, item, photo and task; Ask Muse's context |
| `web/src/savedSpaces.js` | Spaces and chats on the phone |
| `server/scripts/test-inventory.js` | Runs recognition on saved photos, to measure it |

**Stack:** React (Vite) with the Astryx design system, Node.js (Express), Supabase for shared Spaces and votes, and
Render (`render.yaml`).

## Run it locally

Needs Node.js 20.6 or newer and a Meta Model API key.

```bash
cp .env.example .env        # then add MODEL_API_KEY
cd server && npm install && npm run dev     # API on http://localhost:8787
cd web && npm install && npm run dev        # app on https://localhost:5173
```

The web app runs over HTTPS with a self-signed certificate, because iPhone Safari only allows the camera on HTTPS.
To open it on a phone on the same Wi-Fi, use the Mac's address on port 5173 and accept the warning once.

Sharing with Muse and family votes also need `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (tables in
`server/sql/shared_spaces.sql` and `server/sql/vote_links.sql`). The connector for the Meta AI app needs `SPACES_CONNECTOR_KEY`, and it serves only the
owner's household, so judges can see it in the video but not connect their own Meta AI app.

To measure recognition on saved photos:

```bash
cd server && SPACE="Living room" npm run test:inventory -- ../test-photos/scans/<scan folder>
```

## License

MIT. See [LICENSE](LICENSE).
