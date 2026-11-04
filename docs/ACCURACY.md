# Recognition accuracy

Measured on Nov 3, 2026, on three real rooms in one home. A small sample: one home, one scan per room, one person's
item list. It shows how the pipeline behaves, not a general accuracy rate.

## How it was measured
1. The owner scanned each room with the app (8 guided photos) on the development server, which saves the photos locally.
   Photos are private and never committed.
2. Standing in the room, the owner wrote down everything a mover or insurer would list, one line per kind of thing with
   a count. Built-ins (walls, doors, outlets, switches, vents, ceiling lights) were left out, and so were people and pets.
3. Recognition ran again on the saved photos (`npm run test:inventory`), and each found item was matched to the list.
   The owner settled every unclear match.
4. **Found** means the app listed it, under any name. Items the app filed under "Also spotted nearby" still count as
   found; they're reported separately as placed in the wrong area.

## Results

| Room | Things on the list | Found | Missed | Wrong area | Count off | Time |
|---|---|---|---|---|---|---|
| Living room | 33 | 25 | 8 | 0 | 2 | 171 s |
| Foyer | 15 | 12 | 3 | 3 | 1 | 174 s |
| Parlor | 9 | 8 | 1 | 0 | 0 | 202 s |
| **All three** | **57** | **45 (79%)** | **12** | **3** | **3** | **~3 min a room** |

- No photo failed to read, and SAM 3.1 returned an outline for every item in all three rooms.
- **Count off:** found, but with the wrong number (one sofa counted twice; 12 small figurines for 9; 3 of 4 small
  religious items).

## What it missed
- **Small things on other surfaces:** a pouch, a wooden stump, a tin box and a neck pillow on the TV stand, a tiny
  bust, and a small metal object on a stand. 6 of the 12 misses. (A small idol, one of four religious items on a
  shelf, is under "count off".)
- **Wall fixtures:** wall sconces in two rooms and a wall-mounted blinds remote.
- **Things hung on a coat rack:** coats and hangers.
- **One unsettled:** a wall decoration in the living room. The app's one glowing wall hanging is matched to a
  different item on the list, so this one is counted as missed until checked.

## Where the time goes
Each scan makes 8 Muse Spark calls (one per photo, run together), 33 to 56 SAM 3.1 calls, one Muse Spark call to merge
repeats across photos, and one to check crops.

| Step | Living room | Foyer | Parlor |
|---|---|---|---|
| Muse Spark, naming items in each photo | 43 s | 40 s | 56 s |
| SAM 3.1, outlines | 6 s | 5 s | 3 s |
| Muse Spark, merging repeats | 106 s | 119 s | 133 s |
| Muse Spark, checking crops | 16 s | 10 s | 9 s |

The single merge call is 60 to 66% of every scan, so it's the first thing to speed up.
