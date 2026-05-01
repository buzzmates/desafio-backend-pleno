import { EnqueueOrderPayload } from '../types/queue.type';

export abstract class IOrderQueue {
  abstract enqueue(data: EnqueueOrderPayload): Promise<void>;
}
