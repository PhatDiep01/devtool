import { executeDiff } from './diff-engine';
import { ComparePayload, CompareResult, WorkerResponseMessage } from './types';

export class DiffWorkerClient {
  private worker: Worker | null = null;
  private currentRequestId: string | null = null;
  private pendingResolver: ((result: CompareResult) => void) | null = null;
  private pendingRejecter: ((error: Error) => void) | null = null;
  private isWorkerSupported: boolean = typeof window !== 'undefined' && typeof window.Worker !== 'undefined';

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    if (!this.isWorkerSupported) return;

    try {
      this.worker = new Worker(new URL('./diff.worker.ts', import.meta.url), {
        type: 'module'
      });

      this.worker.onmessage = (event: MessageEvent<WorkerResponseMessage>) => {
        const { id, type, result, error } = event.data;

        // Discard stale responses if a newer request has been initiated
        if (id !== this.currentRequestId) {
          return;
        }

        if (type === 'COMPARE_SUCCESS' && result) {
          if (this.pendingResolver) {
            this.pendingResolver(result);
          }
        } else if (type === 'COMPARE_ERROR') {
          if (this.pendingRejecter) {
            this.pendingRejecter(new Error(error || 'Lỗi xử lý Worker'));
          }
        }

        this.cleanupPending();
      };

      this.worker.onerror = (err) => {
        console.warn('Web Worker error, falling back to main-thread execution:', err);
        if (this.pendingRejecter) {
          this.pendingRejecter(new Error('Web Worker encounter an error'));
        }
        this.cleanupPending();
      };
    } catch (e) {
      console.warn('Unable to initialize Web Worker, falling back to synchronous execution:', e);
      this.worker = null;
      this.isWorkerSupported = false;
    }
  }

  private cleanupPending() {
    this.pendingResolver = null;
    this.pendingRejecter = null;
    this.currentRequestId = null;
  }

  /**
   * Request comparison calculation.
   * If a previous request is pending, it is replaced and will not trigger old callbacks.
   */
  public calculateDiff(payload: ComparePayload): Promise<CompareResult> {
    const requestId = `diff_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.currentRequestId = requestId;

    // Fallback: If Worker unavailable, execute synchronously via microtask
    if (!this.worker || !this.isWorkerSupported) {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          try {
            const res = executeDiff(payload);
            resolve(res);
          } catch (err) {
            reject(err as Error);
          }
        }, 0);
      });
    }

    return new Promise<CompareResult>((resolve, reject) => {
      this.pendingResolver = resolve;
      this.pendingRejecter = reject;

      this.worker!.postMessage({
        id: requestId,
        type: 'COMPARE',
        payload
      });
    });
  }

  /**
   * Terminate worker to free memory when unmounting.
   */
  public terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.cleanupPending();
  }
}

// Export singleton instance for app-wide reuse
export const diffWorkerClient = new DiffWorkerClient();
