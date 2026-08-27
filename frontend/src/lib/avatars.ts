/**
 * Curated avatar emoji set, extracted verbatim from the old EmojiAvatar
 * component so the data outlives the component that happened to hold it.
 *
 * Emoji are used here as *user avatars* only — never as UI iconography.
 */

export const AVATAR_EMOJIS = [
  // Animals
  "🐶", "🐱", "🐭", "🐹", "🐰", "🐇", "🦊", "🐻", "🐻‍❄️", "🐼",
  "🐨", "🐯", "🦁", "🐷", "🐮", "🐺", "🦝", "🐄", "🐐", "🐑",
  "🫎", "🐴", "🦄", "🦓", "🦌", "🦬", "🐘", "🐪", "🦒", "🦘",
  "🐒", "🐵", "🦍", "🦧", "🐿️", "🦔", "🦥", "🦦", "🦨",

  // Birds
  "🐔", "🐓", "🐣", "🐤", "🐥", "🐦", "🐧", "🕊️", "🦃", "🦅",
  "🦆", "🦢", "🦉", "🦚", "🦜", "🦩", "🦤", "🪿", "🐦‍⬛", "🐦‍🔥",

  // Marine & Reptiles
  "🐸", "🐲", "🦖", "🐳", "🐬", "🦭", "🐡", "🦈", "🐙",

  // People / Fantasy
  "🧙🏻", "🧚🏻", "🧜🏻", "🧞‍♂️", "🧛🏻", "🧟", "🧝🏻", "🧌", "🦹🏻", "🦸🏻",
  "🧑🏻‍🎤", "🧑🏻‍🚀", "🧑🏻‍🔬", "🧑🏻‍🍳", "🧑🏻‍🎨", "🧑🏻‍🌾", "🧑🏻‍🏫",

  // Fun Stuff
  "👻", "👽", "🤖", "💩", "🧸",
] as const;

export type AvatarEmoji = (typeof AVATAR_EMOJIS)[number];

export interface AvatarCategory {
  name: string;
  emojis: readonly string[];
}

/** Grouped for tabbed navigation in the picker. */
export const AVATAR_CATEGORIES: readonly AvatarCategory[] = [
  { name: "Animals", emojis: AVATAR_EMOJIS.slice(0, 39) },
  { name: "Birds", emojis: AVATAR_EMOJIS.slice(39, 59) },
  { name: "Marine", emojis: AVATAR_EMOJIS.slice(59, 68) },
  { name: "Fantasy", emojis: AVATAR_EMOJIS.slice(68) },
];

/** Sensible default when a player has not chosen yet. */
export const DEFAULT_AVATAR_EMOJI = "🐶";

export function getRandomEmoji(): string {
  return AVATAR_EMOJIS[Math.floor(Math.random() * AVATAR_EMOJIS.length)];
}
