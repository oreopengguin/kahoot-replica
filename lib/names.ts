// Nickname generation + friendly-nickname filter. Used on both client and server.

const ADJECTIVES = [
  "Swift", "Brave", "Clever", "Mighty", "Sneaky", "Cosmic", "Turbo", "Golden",
  "Electric", "Frosty", "Blazing", "Lucky", "Silent", "Wild", "Neon", "Royal",
  "Shadow", "Sunny", "Zesty", "Epic", "Fuzzy", "Rapid", "Crimson", "Azure",
  "Daring", "Jolly", "Nimble", "Plucky", "Stellar", "Vivid",
];

const ANIMALS = [
  "Fox", "Otter", "Falcon", "Panda", "Tiger", "Dolphin", "Koala", "Wolf",
  "Raven", "Gecko", "Lynx", "Puffin", "Mongoose", "Narwhal", "Ocelot", "Panther",
  "Quokka", "Raccoon", "Sparrow", "Tortoise", "Viper", "Walrus", "Yak", "Zebra",
  "Badger", "Cheetah", "Dingo", "Ermine", "Ferret", "Heron",
];

export function generateNickname(): string {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const b = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const n = Math.floor(Math.random() * 90) + 10;
  return `${a}${b}${n}`;
}

// Kept intentionally modest: blocks the obvious stuff without false-positive
// chaos. Normalized against leetspeak substitutions before matching.
const BLOCKED = [
  "fuck", "shit", "bitch", "cunt", "asshole", "dick", "cock", "pussy",
  "nigger", "nigga", "faggot", "retard", "whore", "slut", "penis", "vagina",
  "hitler", "nazi", "rape", "porn", "sex",
];

const SUBS: Record<string, string> = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b",
  "@": "a", "$": "s", "!": "i", "+": "t",
};

export function isNicknameAllowed(raw: string): boolean {
  const name = raw.trim();
  if (name.length === 0 || name.length > 20) return false;
  let normalized = name.toLowerCase();
  for (const [k, v] of Object.entries(SUBS)) normalized = normalized.split(k).join(v);
  normalized = normalized.replace(/[^a-z]/g, "");
  return !BLOCKED.some((w) => normalized.includes(w));
}
