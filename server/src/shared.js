// Spaces their owner shared with Muse, kept in Supabase as names, item lists and tasks. Room photos never come
// here; items marked Sell may carry up to 3 small sale photos, for listing them on Marketplace.
// Without accounts, only someone with the owner key can share, change or unshare a Space.
import { timingSafeEqual } from 'node:crypto';
import express from 'express';

const MAX_ITEMS = 500;
const MAX_TASKS = 100;
const MAX_PHOTOS = 3; // per item marked Sell
const MAX_PHOTO = 150_000; // characters of a data URL, about 110 KB of JPEG
const text = (value, max = 200) => String(value ?? '').slice(0, max);
const price = v => (typeof v === 'number' && v > 0 && v < 1e6 ? Math.round(v) : null);

export async function supabase(path, { method = 'GET', body, prefer } = {}) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw Object.assign(new Error('Sharing is not set up on this server.'), { status: 503 });
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(prefer && { Prefer: prefer }),
    },
    body: body && JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    // A paused or unreachable project shouldn't look like the person did something wrong.
    const detail = await res.text().catch(() => '');
    console.error(`Supabase ${method} ${path}: ${res.status} ${detail}`);
    // A table that was never created is a setup step on the server, not a passing outage.
    if (detail.includes('PGRST205')) throw Object.assign(new Error("This isn't set up on the server yet: its storage tables are missing."), { status: 503 });
    // A column added after the table was made (tasks) may not be there yet; callers can do without it.
    if (detail.includes('PGRST204') || detail.includes('42703')) throw Object.assign(new Error('A storage column is missing.'), { status: 502, missingColumn: true });
    throw Object.assign(new Error("Couldn't reach shared storage. Try again later."), { status: 502 });
  }
  // Writes asked to return nothing come back with an empty body.
  const reply = await res.text();
  return reply ? JSON.parse(reply) : null;
}

/** Every shared Space, for the Muse connector. Before the tasks column is added, Spaces come without tasks. */
export async function listShared() {
  try {
    return await supabase('shared_spaces?select=id,name,scanned_at,items,tasks&order=shared_at');
  } catch (err) {
    if (!err.missingColumn) throw err;
    return (await supabase('shared_spaces?select=id,name,scanned_at,items&order=shared_at')).map(s => ({ ...s, tasks: [] }));
  }
}

const REPEATS = ['once', 'weekly', '2weeks', 'monthly'];
const isDay = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** A Space's tasks: what, how often, when it's due, who does it and which Things, as plain text. */
export function cleanTasks(tasks) {
  if (!Array.isArray(tasks)) return [];
  return tasks.slice(0, MAX_TASKS).map(t => ({
    name: text(t.name, 60),
    repeat: REPEATS.includes(t.repeat) ? t.repeat : 'once',
    due: isDay(t.due) ? t.due : null,
    done: Boolean(t.done),
    who: text(t.who, 40) || null,
    things: (Array.isArray(t.things) ? t.things : []).slice(0, 50).map(n => text(n)).filter(Boolean),
  })).filter(t => t.name && t.due);
}

/** Keeps only the fields Muse needs, as text with sane lengths, whatever the phone sent. */
export function cleanItems(items) {
  if (!Array.isArray(items)) throw Object.assign(new Error('Send items as a list.'), { status: 400 });
  return items.slice(0, MAX_ITEMS).map(i => ({
    name: text(i.name),
    description: text(i.description),
    quantity: Math.max(1, Math.min(999, Number.parseInt(i.quantity, 10) || 1)),
    category: text(i.category, 40),
    nearby: Boolean(i.nearby),
    area: text(i.area, 60),
    unsure: Boolean(i.unsure),
    // Decisions and listing-safe details only. Private fields never reach the server.
    status: ['keep', 'sell', 'donate', 'trash'].includes(i.status) ? i.status : 'undecided',
    brand: text(i.brand, 60) || null,
    model: text(i.model, 60) || null,
    size: text(i.size, 60) || null,
    condition: ['like-new', 'good', 'fair', 'needs-repair'].includes(i.condition) ? i.condition : null,
    estimatedValue: price(i.estimatedValue),
    askingPrice: price(i.askingPrice),
    listingStatus: ['not-listed', 'draft', 'listed', 'sold'].includes(i.listingStatus) ? i.listingStatus : null,
    // Only items marked Sell carry a listing: its draft, and up to 3 small JPEG sale photos.
    ...(i.status === 'sell' && {
      listingTitle: text(i.listingTitle, 80) || null,
      listingDescription: text(i.listingDescription, 2000) || null,
      photos: (Array.isArray(i.photos) ? i.photos : [])
        .filter(p => typeof p === 'string' && p.startsWith('data:image/jpeg;base64,') && p.length <= MAX_PHOTO)
        .slice(0, MAX_PHOTOS),
    }),
  })).filter(i => i.name);
}

export function sameKey(given, expected) {
  if (!given || !expected) return false;
  const a = Buffer.from(String(given));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// With no owner key configured, nobody can share: it fails closed.
function requireOwner(req, res, next) {
  const expected = process.env.SPACES_OWNER_KEY;
  if (!expected) return res.status(503).json({ error: 'Sharing is not turned on.' });
  if (!sameKey(req.get('authorization')?.match(/^Bearer (.+)$/)?.[1], expected)) return res.status(401).json({ error: 'Wrong owner key.' });
  next();
}

const spaceId = id => {
  if (!/^[\w-]{1,64}$/.test(id)) throw Object.assign(new Error('Bad Space id.'), { status: 400 });
  return id;
};

export const shared = express.Router();
shared.use(requireOwner);

// Which Spaces are shared, so the phone shows the right switches. Also confirms the owner key.
shared.get('/', async (_req, res, next) => {
  try { res.json({ ids: (await supabase('shared_spaces?select=id')).map(r => r.id) }); } catch (err) { next(err); }
});

// Share a Space, or update one already shared. The phone sends this again whenever its items change.
shared.put('/:id', express.json({ limit: '6mb' }), async (req, res, next) => {
  try {
    const scanned = new Date(req.body?.scannedAt);
    if (Number.isNaN(scanned.getTime())) throw Object.assign(new Error('Send when it was scanned.'), { status: 400 });
    const row = { id: spaceId(req.params.id), name: text(req.body.name, 60) || 'Space', scanned_at: scanned.toISOString(), items: cleanItems(req.body.items), tasks: cleanTasks(req.body.tasks), updated_at: new Date().toISOString() };
    const save = body => supabase('shared_spaces?on_conflict=id', { method: 'POST', body, prefer: 'resolution=merge-duplicates,return=minimal' });
    try {
      await save(row);
    } catch (err) {
      // Until the tasks column is added (server/sql/shared_spaces.sql), the Space is shared without its tasks.
      if (!err.missingColumn) throw err;
      const { tasks: _, ...withoutTasks } = row;
      await save(withoutTasks);
    }
    res.json({ shared: true, items: row.items.length });
  } catch (err) { next(err); }
});

shared.delete('/:id', async (req, res, next) => {
  try {
    await supabase(`shared_spaces?id=eq.${encodeURIComponent(spaceId(req.params.id))}`, { method: 'DELETE', prefer: 'return=minimal' });
    res.json({ shared: false });
  } catch (err) { next(err); }
});
