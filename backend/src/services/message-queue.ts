type Job = {
  fn: () => Promise<void>;
  eventType: string;
  sessionId: string;
};

export class MessageQueue {
  private readonly queue: Job[] = [];
  private isSending = false;
  private static readonly MAX_QUEUE_DEPTH = 50;
  private static readonly MIN_SEND_INTERVAL_MS = 1100;

  constructor(
    private readonly onDrop: (eventType: string, sessionId: string) => void,
  ) {}

  enqueue(fn: () => Promise<void>, eventType: string, sessionId: string): void {
    if (this.queue.length >= MessageQueue.MAX_QUEUE_DEPTH) {
      const dropped = this.queue.shift()!;
      this.onDrop(dropped.eventType, dropped.sessionId);
    }
    this.queue.push({ fn, eventType, sessionId });
    this.process();
  }

  drain(): void {
    this.queue.length = 0;
  }

  private process(): void {
    if (this.isSending || this.queue.length === 0) return;
    const job = this.queue.shift()!;
    this.isSending = true;
    const start = Date.now();
    job.fn()
      .catch(() => { /* errors handled inside fn() */ })
      .finally(() => {
        const elapsed = Date.now() - start;
        const delay = Math.max(0, MessageQueue.MIN_SEND_INTERVAL_MS - elapsed);
        setTimeout(() => {
          this.isSending = false;
          this.process();
        }, delay);
      });
  }
}
