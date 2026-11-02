// A read-only API for the Muse app. It serves only the Spaces their owner chose to share, as names and
// item lists without photos. Nothing here can change data.
import express from 'express';
import { listShared, sameKey } from './shared.js';

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

/** Shared Spaces as flat items Muse can search. */
async function sharedItems() {
  const spaces = await listShared();
  return {
    spaces,
    items: spaces.flatMap(space => space.items.map((item, i) => ({
      id: `${space.id}:${i}`,
      space: space.id,
      space_name: space.name,
      scanned: space.scanned_at.slice(0, 10),
      ...item,
    }))),
  };
}

/** Words in the query must all appear in the item. Plain matching, so results are predictable. */
export function searchItems(items, { q, space, category }) {
  const words = String(q ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  return items.filter(i => (!space || i.space === space) && (!category || i.category === category)
    && words.every(w => `${i.name} ${i.description} ${i.category} ${i.area}`.toLowerCase().includes(w)));
}

// With no key configured, every request is refused: it fails closed.
function requireKey(req, res, next) {
  const expected = process.env.SPACES_CONNECTOR_KEY;
  if (!expected) return res.status(503).json({ error: 'The connector is not turned on.' });
  const given = req.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!given || !sameKey(given, expected)) return res.status(401).json({ error: 'Missing or wrong key.' });
  next();
}

const OPENAPI = {
  openapi: '3.0.3',
  info: { title: 'Spaces', version: '0.2.0', description: 'Read-only search of the home inventory Spaces its owner chose to share. Items marked nearby were seen near a Space, not in it. scanned is when the Space was photographed, so things may have changed since.' },
  servers: [{ url: '/api/connector/v1' }],
  security: [{ key: [] }],
  components: { securitySchemes: { key: { type: 'http', scheme: 'bearer' } } },
  paths: {
    '/ping': { get: { summary: 'Check the connection. Harmless.', responses: { 200: { description: 'OK' }, 401: { description: 'Missing or wrong key' } } } },
    '/spaces': { get: { summary: 'List shared Spaces, when each was scanned, and item counts.', responses: { 200: { description: 'OK' } } } },
    '/items': {
      get: {
        summary: 'Search items. With no filters, lists everything.',
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Words that must all match, like "sofa".' },
          { name: 'space', in: 'query', schema: { type: 'string' }, description: 'A Space id from /spaces.' },
          { name: 'category', in: 'query', schema: { type: 'string', enum: ['furniture', 'electronics', 'appliances', 'decor', 'plants', 'kitchen', 'fitness_hobbies', 'other'] } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: DEFAULT_LIMIT, maximum: MAX_LIMIT } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
        ],
        responses: { 200: { description: 'OK' } },
      },
    },
  },
};

const intParam = (value, fallback, max) => {
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) || n < 0 ? fallback : Math.min(n, max);
};

export const connector = express.Router();

// The spec is public, since it describes the API and holds no data.
connector.get('/openapi.json', (_req, res) => res.json(OPENAPI));
connector.use(requireKey);
connector.get('/ping', (_req, res) => res.json({ ok: true }));
connector.get('/spaces', async (_req, res, next) => {
  try {
    const { spaces } = await sharedItems();
    res.json({ spaces: spaces.map(s => ({ id: s.id, name: s.name, scanned: s.scanned_at.slice(0, 10), items: s.items.length })) });
  } catch (err) { next(err); }
});
connector.get('/items', async (req, res, next) => {
  try {
    const { q, space, category } = req.query;
    const found = searchItems((await sharedItems()).items, { q, space, category });
    const limit = intParam(req.query.limit, DEFAULT_LIMIT, MAX_LIMIT);
    const offset = intParam(req.query.offset, 0, found.length);
    res.json({ total: found.length, limit, offset, items: found.slice(offset, offset + limit) });
  } catch (err) { next(err); }
});
connector.use((_req, res) => res.status(404).json({ error: 'Not found. This API is read-only.' }));
