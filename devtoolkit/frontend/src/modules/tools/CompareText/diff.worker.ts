import { executeDiff } from './diff-engine';
import { WorkerRequestMessage, WorkerResponseMessage } from './types';

// Web Worker context
self.onmessage = (event: MessageEvent<WorkerRequestMessage>) => {
  const { id, type, payload } = event.data;

  if (type === 'COMPARE') {
    try {
      const result = executeDiff(payload);
      const response: WorkerResponseMessage = {
        id,
        type: 'COMPARE_SUCCESS',
        result
      };
      self.postMessage(response);
    } catch (err) {
      const response: WorkerResponseMessage = {
        id,
        type: 'COMPARE_ERROR',
        error: (err as Error)?.message || 'Lỗi không xác định khi tính toán so sánh văn bản.'
      };
      self.postMessage(response);
    }
  }
};
