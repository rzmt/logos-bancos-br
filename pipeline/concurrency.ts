/** Runs `fn` over `items` with at most `limit` promises in flight. */
export async function withConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (index < items.length) {
      const i = index++;
      await fn(items[i] as T);
    }
  });
  await Promise.all(workers);
}
