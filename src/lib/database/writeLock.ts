let _writeQueueTail: Promise<void> = Promise.resolve();

/**
 * Serializes mutating SQLite operations in strict FIFO order on the single
 * native connection so concurrent writes cannot collide with "Already in transaction".
 *
 * Callers must apply this at top-level mutating boundaries (do not nest a second
 * `withDbWriteLock` inside a callback already holding the lock).
 */
export function withDbWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = _writeQueueTail;
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  _writeQueueTail = prev.then(
    () => current,
    () => current
  );

  return prev.then(async () => {
    try {
      return await fn();
    } finally {
      release();
    }
  });
}
