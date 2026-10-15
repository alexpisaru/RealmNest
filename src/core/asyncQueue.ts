// A push-based async iterable: producers push items from callbacks, one
// consumer reads them with `for await`. Used to turn process output into
// provider event streams.

export class AsyncQueue<T> implements AsyncIterable<T> {
  private items: T[] = [];
  private waiting: ((r: IteratorResult<T>) => void) | null = null;
  private closed = false;

  push(item: T) {
    if (this.closed) return;
    if (this.waiting) {
      const w = this.waiting;
      this.waiting = null;
      w({ value: item, done: false });
    } else this.items.push(item);
  }

  /** no more items; the consumer finishes after draining what is queued */
  end() {
    this.closed = true;
    if (this.waiting && !this.items.length) {
      const w = this.waiting;
      this.waiting = null;
      w({ value: undefined, done: true });
    }
  }

  get ended() {
    return this.closed;
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: () => {
        if (this.items.length) return Promise.resolve({ value: this.items.shift()!, done: false });
        if (this.closed) return Promise.resolve({ value: undefined, done: true });
        return new Promise((resolve) => (this.waiting = resolve));
      },
      return: () => {
        this.closed = true;
        this.items.length = 0;
        return Promise.resolve({ value: undefined, done: true });
      },
    };
  }
}
