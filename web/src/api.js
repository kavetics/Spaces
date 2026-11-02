// Calls to the Spaces server. In development Vite forwards /api to localhost:8787.

async function json(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

/** Connection trouble, as opposed to the server answering with an error. */
const isConnectionError = err => err.name === 'TypeError' || err.name === 'AbortError' || err.name === 'TimeoutError';

// A scan's photos become an inventory. Silence for this long means the phone dropped off or the work hung.
const INVENTORY_SILENCE_MS = 90000;
export async function buildInventory(frames, space, onProgress = () => {}) {
  const body = new FormData();
  if (space) body.append('space', space);
  frames.forEach((f, i) => body.append('frames', f, `room-${i}.jpg`));
  const controller = new AbortController();
  let silence;
  const stillAlive = () => {
    clearTimeout(silence);
    silence = setTimeout(() => controller.abort(), INVENTORY_SILENCE_MS);
  };
  stillAlive();
  try {
    const res = await fetch('/api/inventory', { method: 'POST', body, signal: controller.signal });
    stillAlive();
    if (!res.ok) return await json(res); // throws with the server's message
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      stillAlive();
      if (done) throw new Error('The connection ended before the inventory finished.');
      buffer += value;
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines.filter(Boolean)) {
        const event = JSON.parse(line);
        if (event.step === 'error') throw new Error(event.error);
        if (event.step === 'done') return event.result;
        onProgress(event);
      }
    }
  } catch (err) {
    if (isConnectionError(err)) throw new Error("Couldn't reach the app. Check your connection and try again.");
    throw err;
  } finally {
    clearTimeout(silence);
  }
}

// Ask Muse about the Spaces in view. Spark can take a while, but a question shouldn't hang forever.
const ASK_LIMIT_MS = 90000;
export async function askMuse({ scope, spaces, messages }) {
  try {
    return await json(await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope, spaces, messages }),
      signal: AbortSignal.timeout(ASK_LIMIT_MS),
    }));
  } catch (err) {
    if (isConnectionError(err)) throw new Error("Couldn't reach Muse. Check your connection.");
    throw err;
  }
}

// Which new items, after photos are added to a Space, may already be in its inventory.
export async function findRepeats(space, existing, added) {
  return json(await fetch('/api/repeats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ space, existing, added }),
    signal: AbortSignal.timeout(90000),
  }));
}

// Details for an item someone is selling, read from the extra photos they took of it.
export async function describeForSale(photos, item) {
  const body = new FormData();
  photos.forEach((p, i) => body.append('photos', p, `item-${i}.jpg`));
  body.append('item', JSON.stringify({ name: item.name, description: item.description, category: item.category }));
  try {
    return await json(await fetch('/api/item-details', { method: 'POST', body, signal: AbortSignal.timeout(90000) }));
  } catch (err) {
    if (isConnectionError(err)) throw new Error("Couldn't reach the app. Check your connection and try again.");
    throw err;
  }
}

// A sale listing drafted by Muse from an item's listing-safe details.
export async function draftListing(item) {
  try {
    return await json(await fetch('/api/listing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item }),
      signal: AbortSignal.timeout(90000),
    }));
  } catch (err) {
    if (isConnectionError(err)) throw new Error("Couldn't reach Muse. Check your connection.");
    throw err;
  }
}

/** Shrink phone photos to 1280px before upload: faster upload and fewer AI tokens. */
export async function shrinkPhoto(file, maxSide = 1280) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
}
