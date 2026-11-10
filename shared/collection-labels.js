export const COLLECTION_EMOJIS = [
  '📚', '🎨', '🧩', '🎬', '💡', '📷', '🧭', '🛠️', '📝', '🎧',
  '🌱', '🗂️', '🧪', '🧱', '🖥️', '🖌️', '🔖', '🏕️', '🌌', '📐',
];

// Accept a single emoji, including flags, skin tones and joined sequences.
export const isCollectionEmoji = value =>
  typeof value === 'string' && /^(?:\p{RGI_Emoji}|\p{Extended_Pictographic})$/v.test(value);

export function collectionLabel(name, emoji) {
  return emoji && !name.startsWith(emoji) ? `${emoji} ${name}` : name;
}
