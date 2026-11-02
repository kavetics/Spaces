// When someone adds photos to a Space, from another spot or of a corner, some new items are things
// already in its inventory, seen from a different angle. Muse Spark compares their pictures; plain code
// keeps only one-to-one matches. Nothing is merged here: the person confirms each possible repeat.
import { sparkJSON } from './meta.js';

const MAX_PICTURES = 40;
const text = (value, max = 120) => String(value ?? '').slice(0, max);

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['matches'],
  properties: {
    matches: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['added', 'existing'],
        properties: {
          added: { type: 'string', description: 'Reference of a new item, like n2.' },
          existing: { type: 'string', description: 'Reference of the existing item it is the same physical object as, like e5.' },
        },
      },
    },
  },
};

/**
 * Plain-code checks on the model's matches: references must exist, and each new and each existing
 * item can be matched once. Returns { addedRef: existingRef }.
 */
export function checkMatches(matches, addedRefs, existingRefs) {
  const result = {};
  const used = new Set();
  for (const { added, existing } of matches) {
    if (!addedRefs.has(added) || !existingRefs.has(existing)) continue;
    if (result[added] || used.has(existing)) continue;
    result[added] = existing;
    used.add(existing);
  }
  return result;
}

/** existing and added: [{ ref, name, description, category, picture (data URL or empty) }]. */
export async function findRepeats({ space, existing, added }) {
  if (!existing.length || !added.length) return { repeats: {} };
  // Pictures make the comparison, but there's a limit to how many fit in one request.
  const withPictures = [...added, ...existing].filter(i => typeof i.picture === 'string' && i.picture.startsWith('data:image/')).slice(0, MAX_PICTURES);
  const shown = new Set(withPictures.map(i => i.ref));
  const line = i => `${text(i.ref, 10)}: ${text(i.name)} (${text(i.description)}), ${text(i.category, 30)}${shown.has(i.ref) ? `, picture ${withPictures.indexOf(i) + 1}` : ''}`;
  const { result, ms } = await sparkJSON({
    prompt: [
      `Someone added photos of their "${text(space, 40)}" taken from a different spot, so some new items may be things already listed, seen from another angle.`,
      'Match a new item to an existing one only if it is clearly the same physical object. Similar things, like two different chairs, are not matches. Most new items will have no match; leave them out.',
      `Existing items:\n${existing.map(line).join('\n')}`,
      `New items:\n${added.map(line).join('\n')}`,
      'The pictures are numbered in the order given.',
    ].join('\n\n'),
    images: withPictures.map(i => i.picture),
    schemaName: 'repeat_matches',
    schema: SCHEMA,
    effort: 'medium',
  });
  return {
    repeats: checkMatches(result.matches, new Set(added.map(i => text(i.ref, 10))), new Set(existing.map(i => text(i.ref, 10)))),
    timing: { ms },
  };
}
