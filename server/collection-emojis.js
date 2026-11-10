import { COLLECTION_EMOJIS, isCollectionEmoji } from '../shared/collection-labels.js';

export const collectionEmojiKey = id => `collection_emoji:${id}`;
const graphemes = new Intl.Segmenter(undefined, {granularity:'grapheme'});

export function defaultCollectionEmoji(name, used) {
  const first = graphemes.segment(name)[Symbol.iterator]().next().value?.segment;
  if (isCollectionEmoji(first)) return first;
  return COLLECTION_EMOJIS.find(emoji => !used.has(emoji)) ?? COLLECTION_EMOJIS[used.size % COLLECTION_EMOJIS.length];
}

export function ensureCollectionEmojis(db) {
  // Settings survive backup and restore and remain readable by older ZNote
  // versions. Assign defaults once so later renames or deletions keep icons.
  const rows = db.prepare(`SELECT c.id, c.name, s.value AS emoji
    FROM collections c LEFT JOIN settings s ON s.key='collection_emoji:'||c.id
    ORDER BY c.created_at, c.id`).all();
  const used = new Set(rows.map(row => row.emoji).filter(Boolean));
  const insert = db.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)');
  for (const row of rows) {
    if (row.emoji !== null) continue;
    const emoji = defaultCollectionEmoji(row.name, used);
    insert.run(collectionEmojiKey(row.id), emoji);
    used.add(emoji);
  }
}
