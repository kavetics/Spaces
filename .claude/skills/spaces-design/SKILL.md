---
name: spaces-design
description: UI and UX design guide for the Spaces app (web/), the home-context app that hands what it knows to Muse. Use it before designing, changing or reviewing any screen, flow, button, label, empty state or piece of copy in Spaces, and whenever the owner asks for a mockup, a UX critique, "make this simpler", "this is confusing", layout changes, or demo polish, even if they don't say "design". It holds the product model (Space, Things, People, Decisions), the users, the design rules learned so far, and the review routine with iPhone-width screenshots.
---

# Designing Spaces

Spaces helps people build the context of their home, what's in it, who shares it and what they've
decided, and hands that context to Muse so Meta AI understands their home the way they do. Scanning,
decluttering and voting are how that context gets made; they aren't the product on their own. Every
screen should make the context richer or put it to use.

## The model

```
Space (a room, the backyard)
├── Things      items found by the scan or added by hand: name, category, photos, details
│   └── a decision: Keep, Sell or Let go (and for Sell: price, condition, listing)
├── People      who shares the home, added by hand, never detected in photos
└── Decisions   what People and Things produce together: decluttering (solo), family votes
```

Later layers, on the roadmap and not in the UI yet: Memories (stories on Things), Tasks and chores
(repeatable, like watering the backyard plants), and People linked to Spaces beyond "used by".
Don't design for them unless asked; mention them only as what's next.

The payoff is Muse: Ask Muse inside the app, and the connector that lets Muse in the Meta AI app read
shared Spaces, for example to create a Marketplace listing from a Thing marked Sell.

Use the model's words on screen. "Things" for headings, "item" inside sentences, "People",
"Decisions". Don't introduce new nouns for the same idea (inventory, objects, members, choices).

## Who is looking

- **The owner** on an iPhone, often standing in the room. Short attention, one hand. They direct;
  the app should never make them wonder what a button does.
- **Family voters** opening a link on their own phone with no app and no account. They see only
  items, names and prices, pick their name, vote, done. Nothing about the owner's decisions.
- **Judges** seeing it for the first time in a 3-minute video and then on the live app. They need to
  get the model (Space, Things, People, Decisions, Muse) in seconds, and must never see a fake or
  half-working control.

## Design rules learned in this project

These came from real feedback; each one fixed something that confused the owner.

1. **One main action per screen or card.** The family vote had five buttons that changed by state;
   it became one card with one button and one screen for the rest. When a state machine needs many
   actions, give the card one button that opens a screen holding the others.
2. **Show only what the next real step needs; fold the rest away.** The Sell form shows what
   Marketplace requires (photos, price, condition, listing) and puts optional details under a closed
   "More details". Cut fields nothing uses rather than hiding them.
3. **Combine steps when the user thinks of them as one.** "End vote and use top picks" is one tap,
   because ending a vote and using its result are one intention. Make one-tap actions safe instead:
   never override what the person already decided, skip ties, and offer Undo.
4. **Fewer choices beat complete choices.** "Not sure" was removed from votes; skipping says the
   same thing. If an option adds a tap without telling the owner anything, drop it.
5. **Errors appear where the person is looking**, next to or above the button they tapped, and say
   what's actually wrong in plain words. A message that rendered below the screen edge looked like
   "nothing happened".
6. **Plain code checks and counts; AI judges.** Anything AI produced is labeled ("AI estimate",
   "Drafted by Muse") and editable. Say what's saved, what's shared and where, in one plain sentence
   at the moment it matters.
7. **Words fit an iPhone.** Segmented controls hold three or four short labels; test that nothing
   truncates ("Not su..." was a bug). Buttons are a verb plus an object, sentence case.
8. **Every screen ends the person somewhere sensible.** Back returns to where they came from (with
   its tab and filter kept); Save and Done return to the list with the changed item in view.

## Platform constraints (don't fight them)

- Components and tokens come from Astryx; its rules are in `web/AGENTS.md`. No raw divs, no
  hardcoded hex or px; use tokens like `var(--spacing-4)` and `var(--radius-container)`.
- Phone first: check every screen at 390 x 844. Dark theme is the default.
- iPhone specifics: the share sheet only opens straight from a tap; the Contact Picker isn't on by
  default; there's no reliable background work.
- Privacy promises are part of the UI: room photos stay on the phone; People are added, never
  detected; phone numbers and private fields never leave the phone; anything shared says so.

## How to work on a design

1. **Restate the problem in the owner's words**, and name which part of the model it touches.
2. **Look at what's there first.** `scripts/screens.mjs` captures the main screens at 390 x 844
   with a faked scan (no AI cost): welcome, Space picker, scan guide, Space, item, Sell form,
   Declutter card, Your Spaces, People and For sale. Run it against the local build
   (`node screens.mjs http://localhost:8788 <folder> <photo>`; it needs `puppeteer-core` installed
   where you run it) and read the shots as each user above would. For a screen it doesn't reach,
   copy its pattern.
3. **List what's confusing**, bluntly, as short bullets: too many actions, unclear words, steps the
   user thinks of as one, things that look broken.
4. **Propose the smallest change that fixes it**, as a table (where, now, after) and, for anything
   beyond a wording fix, a mockup of the screens before building. Ask only the decisions that are
   truly the owner's, each with a recommended answer.
5. **Build only after an explicit go.** Then verify with screenshots at phone width, update the
   browser tests that cover the screen, and say what wasn't checked on a real iPhone.

## Review checklist

Before calling a screen done, check:

- One main button, and it's the thing most people want next.
- Every label fits on a 390px screen with no truncation.
- Words match the model (Things, People, Decisions, Muse) and are plain.
- Nothing AI-made is presented as fact; nothing shared is unannounced.
- Empty, loading, error and "already done" states all read sensibly.
- Back, Save and Done land somewhere that makes sense.
- A judge seeing it cold for five seconds would know what it's for.
