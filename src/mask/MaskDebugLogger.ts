export interface MaskDebugSessionInfo {
  sessionId: string;
  downloadUrl: string;
  summaryUrl: string;
  startedAt: string;
}

export interface MaskDebugLoggerOptions {
  baseUrl?: string;
}

function normalizeBaseUrl(value?: string) {
  return (value ?? '').replace(/\/$/, '');
}

type DebugRecord = {
  seq: number;
  type: string;
  wallTime: string;
  perfMs: number;
  data: unknown;
};

const FLUSH_INTERVAL_MS = 1500;
const FLUSH_BATCH_SIZE = 12;
const MAX_BUFFERED_RECORDS = 240;

function createSessionId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '');
  }

  return [
    Date.now().toString(36),
    Math.random().toString(36).slice(2),
    Math.random().toString(36).slice(2),
  ].join('');
}

/**
 * Non-blocking diagnostic recorder.
 *
 * Records stay in memory briefly, then are POSTed in batches to the same
 * Railway frontend service. The server appends them as NDJSON so the complete
 * time sequence can later be downloaded and analyzed.
 */
export class MaskDebugLogger {
  private readonly sessionId = createSessionId();
  private readonly startedAt = new Date().toISOString();
  private readonly downloadUrl: string;
  private readonly summaryUrl: string;
  private readonly uploadUrl: string;

  private queue: DebugRecord[] = [];
  private sequence = 0;
  private stopped = false;
  private flushing = false;
  private timer: number;

  constructor(
    initialData: unknown,
    options: MaskDebugLoggerOptions = {},
  ) {
    const baseUrl =
      normalizeBaseUrl(options.baseUrl);

    this.downloadUrl =
      `${baseUrl}/__mask-debug/session/${this.sessionId}.ndjson`;
    this.summaryUrl =
      `${baseUrl}/__mask-debug/session/${this.sessionId}/summary.json`;
    this.uploadUrl =
      `${baseUrl}/__mask-debug/log`;

    this.log('session_start', initialData);

    this.timer = window.setInterval(
      () => {
        void this.flush();
      },
      FLUSH_INTERVAL_MS,
    );
  }

  getSessionInfo(): MaskDebugSessionInfo {
    return {
      sessionId: this.sessionId,
      downloadUrl: this.downloadUrl,
      summaryUrl: this.summaryUrl,
      startedAt: this.startedAt,
    };
  }

  log(
    type: string,
    data: unknown,
    perfMs = performance.now(),
  ) {
    if (this.stopped) return;

    this.queue.push({
      seq: this.sequence++,
      type,
      wallTime: new Date().toISOString(),
      perfMs,
      data,
    });

    if (
      this.queue.length >
      MAX_BUFFERED_RECORDS
    ) {
      this.queue.splice(
        0,
        this.queue.length -
          MAX_BUFFERED_RECORDS,
      );
    }

    if (
      this.queue.length >=
      FLUSH_BATCH_SIZE
    ) {
      void this.flush();
    }
  }

  async flush() {
    if (
      this.flushing ||
      this.queue.length === 0
    ) {
      return;
    }

    this.flushing = true;

    const records = this.queue.splice(
      0,
      this.queue.length,
    );

    try {
      const response = await fetch(
        this.uploadUrl,
        {
          method: 'POST',
          headers: {
            'content-type':
              'application/json',
          },
          body: JSON.stringify({
            sessionId: this.sessionId,
            records,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          `debug log upload failed: ${response.status}`,
        );
      }
    } catch {
      if (!this.stopped) {
        this.queue.unshift(...records);

        if (
          this.queue.length >
          MAX_BUFFERED_RECORDS
        ) {
          this.queue.splice(
            0,
            this.queue.length -
              MAX_BUFFERED_RECORDS,
          );
        }
      }
    } finally {
      this.flushing = false;
    }
  }

  stop(finalData?: unknown) {
    if (this.stopped) return;

    this.log(
      'session_stop',
      finalData ?? {},
    );

    this.stopped = true;
    window.clearInterval(this.timer);

    const records = this.queue.splice(
      0,
      this.queue.length,
    );

    if (records.length === 0) {
      return;
    }

    const body = JSON.stringify({
      sessionId: this.sessionId,
      records,
    });

    try {
      const blob = new Blob(
        [body],
        {
          type: 'application/json',
        },
      );

      if (
        navigator.sendBeacon(
          this.uploadUrl,
          blob,
        )
      ) {
        return;
      }
    } catch {
      // fall through to fetch
    }

    void fetch(
      this.uploadUrl,
      {
        method: 'POST',
        headers: {
          'content-type':
            'application/json',
        },
        body,
      },
    );
  }
}
