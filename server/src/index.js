// Spaces API server. Holds the API keys; the browser never talks to Meta directly.
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { toDataUrl } from './meta.js';
import { buildInventory } from './inventory.js';
import { askMuse } from './ask.js';
import { connector } from './connector.js';
import { shared } from './shared.js';
import { votes } from './votes.js';
import { describeForSale } from './itemDetails.js';
import { findRepeats } from './repeats.js';
import { draftListing } from './listing.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

app.use(cors());
app.set('trust proxy', 1); // Render's proxy: request limits count the visitor's address, not the proxy's

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/connector/v1', connector);
app.use('/api/shared', shared);
app.use('/api/votes', votes);

// A whole home's inventory comes with each question, since it's stored on the phone.
app.post('/api/ask', express.json({ limit: '2mb' }), async (req, res, next) => {
  try {
    const { scope, spaces, messages } = req.body ?? {};
    if (!Array.isArray(spaces) || !Array.isArray(messages) || !messages.length) throw Object.assign(new Error('Send spaces and messages.'), { status: 400 });
    res.json(await askMuse({ scope, spaces, messages }));
  } catch (err) { next(err); }
});

// After photos are added to a Space: which new items are already in its inventory.
app.post('/api/repeats', express.json({ limit: '8mb' }), async (req, res, next) => {
  try {
    const { space, existing, added } = req.body ?? {};
    if (!Array.isArray(existing) || !Array.isArray(added)) throw Object.assign(new Error('Send existing and added items.'), { status: 400 });
    res.json(await findRepeats({ space, existing: existing.slice(0, 300), added: added.slice(0, 300) }));
  } catch (err) { next(err); }
});

// Details for an item someone is selling, from the extra photos they took of it.
app.post('/api/item-details', upload.array('photos', 6), async (req, res, next) => {
  try {
    if (!req.files?.length) throw Object.assign(new Error('Attach photos of the item as "photos".'), { status: 400 });
    const item = JSON.parse(req.body.item || '{}');
    res.json(await describeForSale(req.files.map(f => toDataUrl(f.buffer, f.mimetype)), item));
  } catch (err) { next(err); }
});

// A sale listing drafted from an item's listing-safe details. Nothing is posted anywhere.
app.post('/api/listing', express.json({ limit: '64kb' }), async (req, res, next) => {
  try {
    const { item } = req.body ?? {};
    if (!item?.name) throw Object.assign(new Error('Send the item to list.'), { status: 400 });
    res.json(await draftListing(item));
  } catch (err) { next(err); }
});

// A scan's photos become an inventory. One JSON line per step, since this takes a while.
app.post('/api/inventory', upload.array('frames', 10), async (req, res, next) => {
  try {
    if (!req.files?.length) throw Object.assign(new Error('Attach the scan as "frames".'), { status: 400 });
    // Development only: keep the photos, so recognition can be measured and tuned on real scans.
    if (process.env.NODE_ENV !== 'production') {
      const folder = new URL(`../../test-photos/scans/${new Date().toISOString().replace(/[:.]/g, '-')}/`, import.meta.url).pathname;
      await mkdir(folder, { recursive: true });
      await Promise.all(req.files.map((f, i) => writeFile(join(folder, `photo-${i}.jpg`), f.buffer)));
    }
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-cache');
    res.flushHeaders();
    const send = line => res.write(`${JSON.stringify(line)}\n`);
    try {
      const space = String(req.body.space || 'room').trim().slice(0, 40) || 'room';
      const result = await buildInventory(req.files.map(f => toDataUrl(f.buffer, f.mimetype)), { space, onProgress: send });
      send({ step: 'done', result });
    } catch (err) {
      console.error(err);
      send({ step: 'error', error: err.message });
    }
    res.end();
  } catch (err) { next(err); }
});

// In production this one server also hosts the built web app, so everything lives at one https link.
if (process.env.NODE_ENV === 'production') {
  const web = new URL('../../web/dist/', import.meta.url).pathname;
  app.use(express.static(web));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(join(web, 'index.html')));
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message });
});

const port = process.env.PORT || 8787;
app.listen(port, () => console.log(`Spaces API on http://localhost:${port}`));
