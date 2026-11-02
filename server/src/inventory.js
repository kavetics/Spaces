// Turn a room scan into an inventory. Muse Spark names what's in each photo and roughly where each
// one is. SAM 3.1 finds every match for that kind of thing, and plain code keeps the outline that
// matches Spark's rough spot, since "sofa" finds every sofa. Muse Spark then decides which sightings
// across overlapping photos are the same item. Plain code checks every merge, picks each item's
// best crop and works out quantities. Last, Muse Spark looks at each crop to confirm it shows the item.
import sharp from 'sharp';
import { segment, sparkJSON } from './meta.js';

const EFFORT = process.env.INVENTORY_EFFORT || 'medium';
const MAX_SAM_AT_ONCE = 8;
const MIN_SAM_CONFIDENCE = 0.5;
const CROP_PADDING = 0.15;
const CROP_SIDE = 384;
const MIN_OVERLAP = 0.1; // Spark's spots are rough, so a SAM outline only has to overlap this much…
// Photos are 45° apart. A big item can span many photos, but each must be near another of its photos.
const MAX_MERGE_STEPS = 2;
const EDGE = 0.03; // this close to a photo's side counts as cut off by it
const MERGE_PHOTO_SIDE = 800; // comparing photos doesn't need full size, and this step is the slowest
// People and pets aren't belongings, whatever the model returns.
const NOT_BELONGINGS = /\b(person|people|man|woman|boy|girl|child|children|kid|baby|toddler|human|dog|puppy|cat|kitten|pet)s?\b/i;

// Everyday clutter isn't worth tracking, whatever the model returns. Things that hold or handle it are.
const CLUTTER = /\b(papers?|mail|envelopes?|documents?|receipts?|paper towels?|tissues?|toilet paper|napkins?|soaps?|detergents?|shampoo|toothpaste|lotion|dispensers?|pump bottles?|take-?out|leftovers?|food|snacks?|trash|garbage|packaging|wrappers?|clothes|clothing|laundry)\b/i;
const HOLDS_CLUTTER = /\b(racks?|dryers?|washers?|washing machine|hampers?|baskets?|hangers?|shredders?|holders?|organi[sz]ers?|trays?|bins?|mailbox(es)?|cans?|wardrobes?|dressers?)\b/i;

export function isClutter(item) {
  const text = `${item.name} ${item.sam_prompt}`;
  return CLUTTER.test(text) && !HOLDS_CLUTTER.test(text);
}

const CATEGORIES = ['furniture', 'electronics', 'appliance', 'lighting', 'decor', 'textile', 'storage', 'books_media', 'plant', 'tool', 'outdoor', 'toy_game', 'kitchenware', 'other'];

const PHOTO_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'sam_prompt', 'description', 'category', 'sure', 'in_space', 'area', 'boxes'],
        properties: {
          name: { type: 'string', description: 'Specific everyday name, e.g. "gray 3-seat sofa".' },
          sam_prompt: { type: 'string', description: 'One or two generic words a vision model can search for, e.g. "sofa".' },
          description: { type: 'string', description: 'Color, material and any visible brand, in under 12 words.' },
          category: { type: 'string', enum: CATEGORIES },
          sure: { type: 'boolean', description: 'False if the item is partly hidden, blurry or you are guessing what it is.' },
          in_space: { type: 'boolean', description: 'True if it physically stands inside the space being scanned.' },
          area: { type: 'string', description: 'The area it stands in, in one or two lowercase words, e.g. "living room", "kitchen", "dining area".' },
          boxes: {
            type: 'array',
            description: 'One box around each physical one in the photo, so the number of boxes is how many there are. Coordinates run 0 to 1000 across the width and down the height.',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['x1', 'y1', 'x2', 'y2'],
              properties: { x1: { type: 'integer' }, y1: { type: 'integer' }, x2: { type: 'integer' }, y2: { type: 'integer' } },
            },
          },
        },
      },
    },
  },
};

const PHOTO_SYSTEM = [
  'You build a home inventory from photos. List every separate belonging someone could own, keep, sell or give away: furniture, electronics, lamps, decor, rugs, plants, books, tools, toys and small objects.',
  'List only what you can actually see. Never guess at what is out of view or inside something closed.',
  'Group identical things in this photo into one entry, like "dining chair", with one box for each. Things that differ, like a sofa and a loveseat, are separate entries.',
  'Skip everyday clutter that nobody would track: papers, mail and documents; loose or piled clothes; takeout containers, food and drinks; trash and packaging; paper towels, tissues, soap, toiletries and cleaning supplies; everyday cups, mugs and dishes; chargers and cables.',
  'Do not list people, pets, or anything built into the home: walls, floors, ceilings, doors, windows, built-in lights, or outlets.',
  'Do not read out or describe private details such as documents, screens, or the people in photographs.',
].join(' ');

const MERGE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['groups'],
  properties: {
    groups: {
      type: 'array',
      description: 'Every sighting id appears in exactly one group. A group is one kind of item.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['sighting_ids', 'name', 'description', 'in_space', 'area'],
        properties: {
          sighting_ids: { type: 'array', items: { type: 'integer' } },
          name: { type: 'string', description: 'The clearest name for the item.' },
          description: { type: 'string', description: 'Color, material and any visible brand, in under 12 words.' },
          in_space: { type: 'boolean', description: 'True if it physically stands inside the space being scanned.' },
          area: { type: 'string', description: 'The area it stands in, in one or two lowercase words. Use the same words for everything in one area.' },
        },
      },
    },
  },
};

// Open-plan homes have no doorway to mark the edge of a room, so this is a judgment from the whole view.
const spaceRule = space => `The user is scanning their "${space}". Decide by where each thing physically stands, not what it is usually for: a desk standing in a living room is in the living room. Things across an open plan or through a doorway, like a kitchen or dining area beyond the room, are not in it. If the area has no clear edge, use the furniture layout and flooring to judge.`;

const CHECK_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['checks'],
  properties: {
    checks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['number', 'shows_item'],
        properties: {
          number: { type: 'integer' },
          shows_item: { type: 'boolean', description: 'True only if the picture clearly shows this item.' },
        },
      },
    },
  },
};

/** Runs tasks with a limit on how many are in flight, keeping results in order. */
async function pool(tasks, limit) {
  const results = new Array(tasks.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (next < tasks.length) {
      const i = next++;
      results[i] = await tasks[i]();
    }
  }));
  return results;
}

async function namePhoto(image, space) {
  const { result, ms } = await sparkJSON({
    system: PHOTO_SYSTEM,
    prompt: `List the belongings in this photo. ${spaceRule(space)}`,
    images: [image],
    schemaName: 'photo_items',
    schema: PHOTO_SCHEMA,
    effort: EFFORT,
  });
  // No usable box means the model couldn't point at it, so it isn't listed.
  const items = result.items.filter(i => !NOT_BELONGINGS.test(`${i.name} ${i.sam_prompt}`) && !isClutter(i) && sparkBoxes(i.boxes).length);
  return { items, ms };
}

/** How many photos apart two photos are, going the short way around the room. */
function photoSteps(a, b, total) {
  const gap = Math.abs(a - b);
  return Math.min(gap, total - gap);
}

/**
 * Plain-code check on the merge. Keeps a group only while it's possible: every sighting used once,
 * no two sightings from one photo (those were listed separately, so they're different things),
 * and each photo close to another of the item's photos, so a big item can span several.
 */
export function checkGroups(groups, sightings, total) {
  const used = new Set();
  const checked = [];
  for (const group of groups) {
    const kept = [];
    for (const id of group.sighting_ids) {
      const s = sightings[id];
      if (!s || used.has(id)) continue;
      const fits = kept.every(k => k.photo !== s.photo)
        && (!kept.length || kept.some(k => photoSteps(k.photo, s.photo, total) <= MAX_MERGE_STEPS));
      if (!fits) continue;
      kept.push(s);
      used.add(id);
    }
    if (kept.length) checked.push({ name: group.name, description: group.description, in_space: group.in_space, area: group.area, sightings: kept });
  }
  // Anything the model dropped or that failed a check stays as its own item: better a repeat than a lost item.
  sightings.forEach((s, id) => {
    if (!used.has(id)) checked.push({ name: s.name, description: s.description, in_space: s.in_space, area: s.area, sightings: [s] });
  });
  return checked;
}

/** Which sides of the photo cut this sighting off. */
const cutOffBy = s => ({
  left: s.things.some(t => t.box.x1 <= EDGE),
  right: s.things.some(t => t.box.x2 >= 1 - EDGE),
});

/**
 * Photos overlap so little that big things are often cut in half and get different names in each.
 * Something cut off by a photo's right side and the next photo's left side is probably one item.
 * These are hints for Spark, which can see whether they really match.
 */
export function splitCandidates(sightings, total) {
  const pairs = [];
  sightings.forEach((a, i) => {
    if (!cutOffBy(a).right) return;
    sightings.forEach((b, j) => {
      if (b.photo === (a.photo + 1) % total && total > 1 && a.category === b.category && cutOffBy(b).left) pairs.push([i, j]);
    });
  });
  return pairs;
}

const shrinkForMerge = async image => {
  const small = await sharp(Buffer.from(image.slice(image.indexOf(',') + 1), 'base64'))
    .resize({ width: MERGE_PHOTO_SIDE, height: MERGE_PHOTO_SIDE, fit: 'inside' })
    .jpeg({ quality: 75 })
    .toBuffer();
  return `data:image/jpeg;base64,${small.toString('base64')}`;
};

/** Overlap of two boxes: 0 is none, 1 is identical. */
export function overlap(a, b) {
  const w = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
  const h = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
  if (w <= 0 || h <= 0) return 0;
  const area = r => (r.x2 - r.x1) * (r.y2 - r.y1);
  return (w * h) / (area(a) + area(b) - w * h);
}

const clamp = v => Math.max(0, Math.min(1, v));

/** Spark's boxes as fractions of the photo. Drops any that are empty or backwards. */
export function sparkBoxes(boxes) {
  return boxes
    .map(b => ({ x1: clamp(b.x1 / 1000), y1: clamp(b.y1 / 1000), x2: clamp(b.x2 / 1000), y2: clamp(b.y2 / 1000) }))
    .filter(b => b.x2 > b.x1 && b.y2 > b.y1);
}

const contains = (outer, inner) => {
  const x = (inner.x1 + inner.x2) / 2;
  const y = (inner.y1 + inner.y2) / 2;
  return x >= outer.x1 && x <= outer.x2 && y >= outer.y1 && y <= outer.y2;
};

// …or one's center has to sit inside the other, which small things in a loose box need.
const matchScore = (spot, outline) => {
  const score = overlap(spot, outline);
  if (score >= MIN_OVERLAP) return score;
  return contains(spot, outline) || contains(outline, spot) ? MIN_OVERLAP / 2 : 0;
};

/**
 * Pairs each thing Spark pointed at with the SAM outline that best matches it, each outline used once.
 * Boxes are fractions of the photo. A thing with no match keeps Spark's rough box and located: false.
 */
export function matchOutlines(spots, objects) {
  const outlines = objects.map(o => ({
    box: { x1: o.box.x1 / o.imageSize.width, y1: o.box.y1 / o.imageSize.height, x2: o.box.x2 / o.imageSize.width, y2: o.box.y2 / o.imageSize.height },
    confidence: o.confidence,
  }));
  const used = new Set();
  const pairs = spots.flatMap((spot, s) => outlines.map((o, i) => ({ s, i, score: matchScore(spot, o.box) })))
    .filter(p => p.score > 0)
    .sort((a, b) => b.score - a.score);
  const matched = new Map();
  for (const { s, i } of pairs) {
    if (matched.has(s) || used.has(i)) continue;
    matched.set(s, outlines[i]);
    used.add(i);
  }
  return spots.map((spot, s) => (matched.has(s)
    ? { box: matched.get(s).box, located: true }
    : { box: spot, located: false }));
}

// The best picture of an item is its largest view that isn't cut off by the photo's edge,
// preferring SAM's exact outline over Spark's rough box.
function bestView(sightings) {
  const views = sightings.flatMap(s => s.things.map(({ box, located }) => {
    const cutOff = box.x1 <= 0.005 || box.y1 <= 0.005 || box.x2 >= 0.995 || box.y2 >= 0.995;
    return { photo: s.photo, box, located, score: (box.x2 - box.x1) * (box.y2 - box.y1) * (cutOff ? 0.5 : 1) * (located ? 1 : 0.25) };
  }));
  if (!views.length) return null;
  const { score: _, ...best } = views.reduce((a, b) => (b.score > a.score ? b : a));
  return best;
}

function toItem(group, id) {
  const { sightings } = group;
  const located = sightings.some(s => s.things.some(t => t.located));
  return {
    id,
    name: group.name,
    description: group.description,
    category: sightings[0].category,
    inSpace: group.in_space !== false, // when in doubt it stays in; a person can always leave it out
    area: (group.area || 'nearby').trim().toLowerCase(),
    // The same thing is often in two photos, so quantity is the highest count in any one photo, never the sum.
    quantity: Math.max(1, ...sightings.map(s => s.things.length)),
    photos: [...new Set(sightings.map(s => s.photo))].sort((a, b) => a - b),
    view: bestView(sightings),
    // Worth a person's check: SAM couldn't find it, or Spark wasn't sure in any photo.
    needsReview: !located || !sightings.some(s => s.sure),
  };
}

/** Cuts an item out of its photo, with a little of the surroundings. */
async function cropView(image, { box }) {
  const input = Buffer.from(image.slice(image.indexOf(',') + 1), 'base64');
  const { width, height } = await sharp(input).metadata();
  const padX = (box.x2 - box.x1) * CROP_PADDING;
  const padY = (box.y2 - box.y1) * CROP_PADDING;
  const left = Math.floor(clamp(box.x1 - padX) * width);
  const top = Math.floor(clamp(box.y1 - padY) * height);
  const right = Math.ceil(clamp(box.x2 + padX) * width);
  const bottom = Math.ceil(clamp(box.y2 + padY) * height);
  const crop = await sharp(input)
    .extract({ left, top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) })
    .resize({ width: CROP_SIDE, height: CROP_SIDE, fit: 'inside' })
    .jpeg({ quality: 80 })
    .toBuffer();
  return `data:image/jpeg;base64,${crop.toString('base64')}`;
}

/**
 * Spark looks at each item's crop. If it doesn't clearly show the item, usually because the item is small,
 * the picture zooms out so the item is findable in context, and it's marked for a person to check.
 * Nothing is dropped: testing showed this check also fails real but small or distant items, and a
 * lost item is worse than a doubtful one. If the check itself fails, every item stays as it was.
 */
export function applyChecks(items, checks) {
  const results = new Map(checks.map(c => [c.number, c.shows_item]));
  const checked = items.map((item, n) => (results.get(n) === false ? { ...item, view: { ...item.view, wide: true }, needsReview: true } : item));
  return [...checked.filter(i => !i.needsReview), ...checked.filter(i => i.needsReview)];
}

async function checkCrops(items, images) {
  const crops = await Promise.all(items.map(item => cropView(images[item.view.photo], item.view)));
  const { result, ms } = await sparkJSON({
    prompt: [
      `Here are ${items.length} pictures, in order and numbered from 0. Each should show the item listed for its number. Check each one.`,
      items.map((item, n) => `${n}: ${item.name} (${item.description})`).join('\n'),
    ].join('\n\n'),
    images: crops,
    schemaName: 'crop_checks',
    schema: CHECK_SCHEMA,
    effort: 'low',
  });
  return { checks: result.checks, ms };
}

/** Builds the inventory. onProgress gets { step: 'photos' | 'merging' | 'checking', done, total }. */
export async function buildInventory(images, { space = 'room', onProgress = () => {}, debug = false } = {}) {
  const started = Date.now();
  const total = images.length;

  // A photo that fails is reported, and the others still count.
  let done = 0;
  const named = await Promise.all(images.map(image => namePhoto(image, space)
    .catch(error => ({ items: [], error: error.message }))
    .then(r => { onProgress({ step: 'photos', done: ++done, total }); return r; })));
  const failedPhotos = named.flatMap((r, photo) => (r.error ? [photo] : []));
  if (failedPhotos.length === total) throw new Error(`Couldn't read any of the photos: ${named[0].error}`);

  // SAM looks once per thing per photo, each photo's items only in that photo.
  const wanted = named.flatMap((r, photo) => r.items.map(item => ({ ...item, photo })));
  const samStarted = Date.now();
  const located = await pool(wanted.map(w => () => segment(images[w.photo], w.sam_prompt, { minConfidence: MIN_SAM_CONFIDENCE })
    .catch(err => ({ objects: [], error: err.message }))), MAX_SAM_AT_ONCE);
  const samFailures = located.filter(l => l.error).length;
  if (wanted.length && samFailures === wanted.length) throw new Error(`Couldn't locate any items: ${located[0].error}`);
  const sightings = wanted.map((w, i) => ({ ...w, things: matchOutlines(sparkBoxes(w.boxes), located[i].objects) }));
  const samMs = Date.now() - samStarted;

  // One photo has nothing to merge across.
  onProgress({ step: 'merging', done: 0, total: 1 });
  let groups = sightings.map((s, i) => ({ sighting_ids: [i], name: s.name, description: s.description, in_space: s.in_space, area: s.area }));
  let mergeMs = 0;
  let mergeFailed = null;
  if (total > 1 && sightings.length > 1) {
    const list = sightings.map((s, id) => {
      const { left, right } = cutOffBy(s);
      const cut = left || right ? `, cut off by the photo's ${[left && 'left', right && 'right'].filter(Boolean).join(' and ')} side` : '';
      return `${id}: photo ${s.photo}, ${s.name} (${s.description})${cut}`;
    }).join('\n');
    const candidates = splitCandidates(sightings, total);
    try {
      const { result, ms } = await sparkJSON({
        prompt: [
          `These ${total} photos were taken from one spot, turning right about 45° between each, so neighbouring photos overlap. Photo numbers start at 0.`,
          'Below is what was found in each photo. Group the sightings that are the same physical item, using the photos to compare. Separate items that only look alike must stay in separate groups.',
          'The photos overlap only a little, so a big item is often cut in half with different names: half a sofa might be called a "loveseat" in one photo and an "armchair" in the next. Compare what they look like, not their names. A big rug or sofa can span several photos.',
          `For each group, say whether it is in the space, looking across all the photos. ${spaceRule(space)}`,
          list,
          candidates.length ? `Cut off at touching edges of neighbouring photos, so check these first: ${candidates.map(([a, b]) => `${a} and ${b}`).join('; ')}.` : '',
        ].filter(Boolean).join('\n\n'),
        images: await Promise.all(images.map(shrinkForMerge)),
        schemaName: 'merged_items',
        schema: MERGE_SCHEMA,
        effort: EFFORT,
      });
      groups = result.groups;
      mergeMs = ms;
    } catch (err) {
      mergeFailed = err.message; // repeats are better than losing the whole scan
    }
  }
  const merged = checkGroups(groups, sightings, total).map((g, i) => toItem(g, i));

  onProgress({ step: 'checking', done: 0, total: 1 });
  let items = merged;
  let checkMs = 0;
  let checkFailed = null;
  if (merged.length) {
    try {
      const { checks, ms } = await checkCrops(merged, images);
      items = applyChecks(merged, checks);
      checkMs = ms;
    } catch (err) {
      checkFailed = err.message;
    }
  }

  return {
    items,
    ...(debug && { debug: { sightings: sightings.map(({ name, photo, boxes }) => ({ name, photo, boxes })), groups } }),
    photos: total,
    warnings: {
      failedPhotos,
      samFailures,
      mergeFailed,
      checkFailed,
    },
    timing: {
      sightings: sightings.length,
      sparkPhotoMs: Math.max(0, ...named.map(n => n.ms || 0)),
      samCalls: wanted.length,
      samMs,
      mergeMs,
      checkMs,
      totalMs: Date.now() - started,
    },
  };
}
