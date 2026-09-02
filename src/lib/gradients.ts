// Deterministic warm gradient placeholder for products without imagery.
const palette = [
  ["#E7CFC6", "#d1b5aa"],
  ["#DCC9B3", "#bfa88e"],
  ["#ccc4be", "#8B6F61"],
  ["#e8ddd7", "#E7CFC6"],
  ["#d8cec8", "#4A2E23"],
];
export function gradientFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const [a, b] = palette[h % palette.length];
  return `linear-gradient(160deg, ${a} 0%, ${b} 100%)`;
}
