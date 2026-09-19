/**
 * A cancellable, bounded scheduler: plans are data, never executable model code.
 * Steps may be async (e.g. the hand's travel animation must finish before the
 * connector is revealed), so `runStep` may return a promise.
 */
export class VisualPlaybackEngine {
  private timer: number | null = null;
  private generation = 0;
  private cancelled = false;

  constructor(
    private readonly runStep: (index: number) => void | Promise<void>,
    private readonly onFinish: () => void,
  ) {}

  play(count: number) {
    this.cancel();
    this.cancelled = false;
    const generation = ++this.generation;
    if (count <= 0) {
      this.onFinish();
      return;
    }
    const next = (index: number) => {
      if (this.cancelled || generation !== this.generation) return;
      if (index >= count) {
        this.onFinish();
        return;
      }
      Promise.resolve(this.runStep(index))
        .catch(() => {
          /* a failed step never stalls the lesson */
        })
        .then(() => {
          if (this.cancelled || generation !== this.generation) return;
          this.timer = window.setTimeout(() => next(index + 1), 0);
        });
    };
    next(0);
  }

  cancel() {
    this.cancelled = true;
    this.generation += 1;
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
  }
}
