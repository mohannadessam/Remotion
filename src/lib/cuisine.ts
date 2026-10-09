const EMOJI: Record<string, string> = {
  burgers: "🍔",
  shawarma: "🌯",
  coffee: "☕",
  desserts: "🍰",
  mandi: "🍚",
  tacos: "🌮",
  breakfast: "🍳",
  pizza: "🍕",
  juice: "🧃",
  grill: "🍢",
};

export function cuisineEmoji(cuisine: string) {
  return EMOJI[cuisine] ?? "🍽️";
}
