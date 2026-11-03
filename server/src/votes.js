// Family vote links. The owner sends a few items from one Space; people on their household list pick
// their name and vote Keep, Sell, Let go or Unsure. Votes are advice: the owner still decides.
// Stored in Supabase: item names, small pictures, asking prices and voters' names. Nothing else.
// Each link expires after 14 days, and the owner can delete it sooner.
import { createHash, randomBytes } from 'node:crypto';
import express from 'express';
import { sameKey, supabase } from './shared.js';

export const LINK_DAYS = 14;
export const MAX_ITEMS = 25;
export const MAX_VOTERS = 12;
export const MAX_PICTURE = 120_000; // characters of a data URL, about 90 KB of JPEG
export const CHOICES = ['keep', 'sell', 'donate', 'unsure'];

const fail = (status, message) => Object.assign(new Error(message), { status });
const text = (value, max) => String(value ?? '').trim().slice(0, max);
const hash = token => createHash('sha256').update(token).digest('hex');
const token = bytes => randomBytes(bytes).toString('base64url');
const linkId = id => {
  if (!/^[\w-]{16,40}$/.test(id)) throw fail(404, 'This vote link is not right. Ask for a new one.');
  return id;
};

// Supabase in production. VOTES_STORE=memory keeps links in this process instead, for local tests only.
const memory = { links: new Map(), answers: new Map() };
const useMemory = () => process.env.VOTES_STORE === 'memory';
if (process.env.VOTES_STORE === 'memory') console.warn('Vote links are kept in memory: for local testing only.');

const store = {
  async create(row) {
    if (useMemory()) { memory.links.set(row.id, row); return; }
    await supabase('vote_links', { method: 'POST', body: row, prefer: 'return=minimal' });
  },
  async get(id) {
    if (useMemory()) return memory.links.get(id) ?? null;
    return (await supabase(`vote_links?id=eq.${id}&select=*`))[0] ?? null;
  },
  async remove(id) {
    if (useMemory()) { memory.links.delete(id); memory.answers.delete(id); return; }
    await supabase(`vote_links?id=eq.${id}`, { method: 'DELETE', prefer: 'return=minimal' }); // answers go with it
  },
  async removeExpired() {
    const now = new Date().toISOString();
    if (useMemory()) { for (const [id, l] of memory.links) if (l.expires_at < now) await store.remove(id); return; }
    await supabase(`vote_links?expires_at=lt.${now}`, { method: 'DELETE', prefer: 'return=minimal' });
  },
  async answers(id) {
    if (useMemory()) return [...(memory.answers.get(id)?.values() ?? [])];
    return supabase(`vote_answers?link_id=eq.${id}&select=voter_id,answers,updated_at`);
  },
  async saveAnswers(row) {
    if (useMemory()) {
      if (!memory.answers.has(row.link_id)) memory.answers.set(row.link_id, new Map());
      memory.answers.get(row.link_id).set(row.voter_id, row);
      return;
    }
    await supabase('vote_answers?on_conflict=link_id,voter_id', { method: 'POST', body: row, prefer: 'resolution=merge-duplicates,return=minimal' });
  },
};

/** Keeps a link to its limits, whatever the phone sent: up to 25 items and 12 voters, short text, small pictures. */
export function cleanLink(body) {
  const items = Array.isArray(body?.items) ? body.items : [];
  const voters = Array.isArray(body?.voters) ? body.voters : [];
  if (!items.length) throw fail(400, 'Choose at least one item.');
  if (items.length > MAX_ITEMS) throw fail(400, `Send up to ${MAX_ITEMS} items at a time.`);
  if (!voters.length) throw fail(400, 'Choose who can vote.');
  if (voters.length > MAX_VOTERS) throw fail(400, `Up to ${MAX_VOTERS} people can vote.`);
  const cleanItems = items.map(i => {
    const picture = typeof i.picture === 'string' && i.picture.startsWith('data:image/jpeg;base64,') && i.picture.length <= MAX_PICTURE ? i.picture : null;
    const price = typeof i.price === 'number' && i.price >= 1 && i.price <= 100_000 ? Math.round(i.price) : null;
    return { ref: text(i.ref, 20), name: text(i.name, 80), picture, price };
  }).filter(i => i.ref && i.name);
  const cleanVoters = voters.map(v => ({ id: text(v.id, 64), name: text(v.name, 40) })).filter(v => v.id && v.name);
  if (new Set(cleanItems.map(i => i.ref)).size !== cleanItems.length) throw fail(400, 'Each item can only be in a link once.');
  if (!cleanItems.length || !cleanVoters.length) throw fail(400, 'Choose items and who can vote.');
  return { space_name: text(body.spaceName, 60) || 'Our home', items: cleanItems, voters: cleanVoters };
}

/** Only known items and known choices; "Unsure" is kept so it shows when they come back. */
export function cleanAnswers(answers, link) {
  const refs = new Set(link.items.map(i => i.ref));
  return Object.fromEntries(Object.entries(answers && typeof answers === 'object' ? answers : {})
    .filter(([ref, choice]) => refs.has(ref) && CHOICES.includes(choice)));
}

// A small limit per address, so a public link can't be used to flood storage.
const hits = new Map();
function limit(max, windowMs) {
  return (req, res, next) => {
    const key = `${max}:${req.ip}`;
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter(t => now - t < windowMs);
    if (recent.length >= max) return res.status(429).json({ error: 'Too many tries. Wait a few minutes and try again.' });
    recent.push(now);
    hits.set(key, recent);
    next();
  };
}

async function openLink(id) {
  const link = await store.get(linkId(id));
  if (!link) throw fail(404, 'This vote has ended or was deleted.');
  if (new Date(link.expires_at) < new Date()) {
    await store.remove(link.id);
    throw fail(410, 'This vote has ended.');
  }
  return link;
}

const ownerOf = (req, link) => {
  const given = req.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!given || !sameKey(hash(given), link.owner_hash)) throw fail(401, 'Only the person who sent this link can see its votes.');
};

export const votes = express.Router();

// The owner makes a link. A newer link for the same Space replaces the older one and its votes.
votes.post('/', limit(20, 60 * 60_000), express.json({ limit: '4mb' }), async (req, res, next) => {
  try {
    const fields = cleanLink(req.body);
    const replaces = req.body.replaces;
    if (typeof replaces?.id === 'string' && /^[\w-]{16,40}$/.test(replaces.id) && replaces.ownerToken) {
      const old = await store.get(replaces.id);
      if (old && sameKey(hash(String(replaces.ownerToken)), old.owner_hash)) await store.remove(old.id);
    }
    await store.removeExpired();
    const ownerToken = token(24);
    const row = { id: token(16), owner_hash: hash(ownerToken), ...fields, created_at: new Date().toISOString(), expires_at: new Date(Date.now() + LINK_DAYS * 86_400_000).toISOString() };
    await store.create(row);
    res.json({ id: row.id, ownerToken, expiresAt: row.expires_at });
  } catch (err) { next(err); }
});

// What a voter sees: the items and the names to pick from. Never anyone's votes or decisions.
votes.get('/:id', limit(300, 10 * 60_000), async (req, res, next) => {
  try {
    const link = await openLink(req.params.id);
    res.json({ spaceName: link.space_name, items: link.items, voters: link.voters, expiresAt: link.expires_at });
  } catch (err) { next(err); }
});

// One voter's own votes, so they can come back and change them.
votes.get('/:id/answers/:voter', limit(300, 10 * 60_000), async (req, res, next) => {
  try {
    const link = await openLink(req.params.id);
    if (!link.voters.some(v => v.id === req.params.voter)) throw fail(404, 'Pick your name from the list.');
    const mine = (await store.answers(link.id)).find(a => a.voter_id === req.params.voter);
    res.json({ answers: mine?.answers ?? {}, updatedAt: mine?.updated_at ?? null });
  } catch (err) { next(err); }
});

votes.put('/:id/answers/:voter', limit(60, 10 * 60_000), express.json({ limit: '16kb' }), async (req, res, next) => {
  try {
    const link = await openLink(req.params.id);
    if (!link.voters.some(v => v.id === req.params.voter)) throw fail(403, 'Only people on the list can vote.');
    const answers = cleanAnswers(req.body?.answers, link);
    await store.saveAnswers({ link_id: link.id, voter_id: req.params.voter, answers, updated_at: new Date().toISOString() });
    res.json({ saved: Object.keys(answers).length });
  } catch (err) { next(err); }
});

// The owner's view: everyone's votes.
votes.get('/:id/results', limit(300, 10 * 60_000), async (req, res, next) => {
  try {
    const link = await openLink(req.params.id);
    ownerOf(req, link);
    const answers = await store.answers(link.id);
    res.json({ expiresAt: link.expires_at, votes: answers.map(a => ({ voterId: a.voter_id, answers: a.answers, updatedAt: a.updated_at })) });
  } catch (err) { next(err); }
});

votes.delete('/:id', limit(60, 10 * 60_000), async (req, res, next) => {
  try {
    const link = await store.get(linkId(req.params.id));
    if (link) {
      ownerOf(req, link);
      await store.remove(link.id);
    }
    res.json({ deleted: true });
  } catch (err) { next(err); }
});
