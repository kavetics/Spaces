// Details for an item someone wants to sell, from the extra photos they take of it. Muse Spark reads
// only what's visible and estimates condition, size and value. Plain code keeps every number in a sane
// range, and everything comes back marked as an AI estimate for the person to check.
import { sparkJSON } from './meta.js';

const EFFORT = process.env.DETAILS_EFFORT || 'medium';
const CONDITIONS = ['like-new', 'good', 'fair', 'needs-repair'];
const nullable = type => ({ type: [type, 'null'] });

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['brand', 'model', 'size', 'attributes', 'included_items', 'mounted', 'condition', 'condition_notes', 'defects', 'dimensions', 'estimated_value', 'value_basis'],
  properties: {
    brand: { ...nullable('string'), description: 'Only if a logo or label is clearly readable. Otherwise null.' },
    model: { ...nullable('string'), description: 'Only if a model number or name is clearly readable. Otherwise null.' },
    size: { ...nullable('string'), description: 'Plain size, like "55-inch screen" or "3-seat". Null if unclear.' },
    attributes: {
      type: 'array',
      description: 'What a buyer would want to know for this kind of item, like material, color or ports. Up to 6.',
      items: { type: 'object', additionalProperties: false, required: ['name', 'value'], properties: { name: { type: 'string' }, value: { type: 'string' } } },
    },
    included_items: { type: 'array', items: { type: 'string' }, description: 'Accessories visible with it, like a remote or cushions.' },
    mounted: { ...nullable('boolean'), description: 'True if fixed to a wall or ceiling.' },
    condition: { type: ['string', 'null'], enum: [...CONDITIONS, null], description: 'From what is visible. Null if the photos do not show enough.' },
    condition_notes: { ...nullable('string'), description: 'Visible wear, in one short sentence.' },
    defects: { type: 'array', items: { type: 'string' }, description: 'Only visible damage, like a scratch or a stain.' },
    dimensions: {
      type: ['object', 'null'],
      additionalProperties: false,
      required: ['width', 'height', 'depth'],
      description: 'Rough size in inches, judged from the photos. Null if there is nothing to judge scale by.',
      properties: { width: nullable('number'), height: nullable('number'), depth: nullable('number') },
    },
    estimated_value: { ...nullable('number'), description: 'Rough used resale price in US dollars. Null if you cannot tell.' },
    value_basis: { ...nullable('string'), description: 'One short reason for the price, like "similar used sofas sell for about this".' },
  },
};

const SYSTEM = [
  'You help someone sell an item from their home. You get photos of the item.',
  'Only report brand, model and text you can actually read. Never guess a brand from looks.',
  'Condition, size and value are estimates from photos: be modest, and use null when the photos do not show enough.',
  'You cannot tell from photos whether something works, so never claim it does.',
  'Do not mention people, documents or anything private that appears in the photos.',
].join(' ');

const text = (value, max = 120) => (typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null);
const inRange = (value, max) => (typeof value === 'number' && value > 0 && value <= max ? Math.round(value * 10) / 10 : null);

/** Plain-code limits on what the model returned: nothing absurd gets to the screen. */
export function cleanDetails(raw) {
  const d = raw.dimensions;
  const dimensions = d && (inRange(d.width, 400) || inRange(d.height, 400) || inRange(d.depth, 400))
    ? { width: inRange(d.width, 400), height: inRange(d.height, 400), depth: inRange(d.depth, 400), unit: 'in' }
    : null;
  const value = inRange(raw.estimated_value, 100000);
  return {
    brand: text(raw.brand, 60),
    model: text(raw.model, 60),
    size: text(raw.size, 60),
    attributes: Object.fromEntries((raw.attributes ?? []).slice(0, 6).map(a => [text(a.name, 30), text(a.value, 60)]).filter(([k, v]) => k && v)),
    includedItems: (raw.included_items ?? []).map(i => text(i, 40)).filter(Boolean).slice(0, 10),
    mounted: typeof raw.mounted === 'boolean' ? raw.mounted : null,
    condition: CONDITIONS.includes(raw.condition) ? raw.condition : null,
    conditionNotes: text(raw.condition_notes, 200),
    defects: (raw.defects ?? []).map(i => text(i, 80)).filter(Boolean).slice(0, 10),
    dimensions,
    estimatedValue: value ? { amount: Math.round(value), currency: 'USD', source: `AI estimate from photos${text(raw.value_basis) ? `: ${text(raw.value_basis)}` : ''}` } : null,
  };
}

/** images: data URLs of the item. item: { name, description, category }. */
export async function describeForSale(images, item) {
  const { result, ms } = await sparkJSON({
    system: SYSTEM,
    prompt: `The item is a ${String(item.name).slice(0, 80)} (${String(item.description ?? '').slice(0, 120)}), category ${String(item.category ?? '').slice(0, 30)}. Describe it for a resale listing from these ${images.length} photos.`,
    images,
    schemaName: 'item_for_sale',
    schema: SCHEMA,
    effort: EFFORT,
  });
  return { details: cleanDetails(result), timing: { ms } };
}
