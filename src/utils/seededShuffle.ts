export function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = arr.slice();
  // simple xorshift32 PRNG
  let s = seed >>> 0;
  function rnd() {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  }
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
