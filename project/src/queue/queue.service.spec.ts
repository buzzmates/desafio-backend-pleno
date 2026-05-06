import { Test, TestingModule } from '@nestjs/testing';
import { QueueService } from './queue.service';
import { Queue } from 'bullmq';
import { getQueueToken } from '@nestjs/bullmq';
import { BadRequestException } from '@nestjs/common';

describe('QueueService', () => {
  let service: QueueService;
  let mockOrderQueue: jest.Mocked<Queue>;
  let mockNotificationQueue: jest.Mocked<Queue>;

  beforeEach(async () => {
    mockOrderQueue = {
      add: jest.fn(),
      getWaitingCount: jest.fn(),
      getActiveCount: jest.fn(),
      getCompletedCount: jest.fn(),
      getFailedCount: jest.fn(),
      getDelayedCount: jest.fn(),
      getJobCounts: jest.fn(),
      getJobs: jest.fn(),
      clean: jest.fn(),
    } as any;

    mockNotificationQueue = {
      add: jest.fn(),
      getWaitingCount: jest.fn(),
      getActiveCount: jest.fn(),
      getCompletedCount: jest.fn(),
      getFailedCount: jest.fn(),
      getDelayedCount: jest.fn(),
      getJobCounts: jest.fn(),
      getJobs: jest.fn(),
      clean: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        {
          provide: getQueueToken('order-processing'),
          useValue: mockOrderQueue,
        },
        {
          provide: getQueueToken('notifications'),
          useValue: mockNotificationQueue,
        },
      ],
    }).compile();

    service = module.get<QueueService>(QueueService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('enqueueOrder', () => {
    it('should enqueue order with correct configuration', async () => {
      // Arrange
      const orderId = 'test-order-id';
      mockOrderQueue.add.mockResolvedValue({} as any);

      // Act
      await service.enqueueOrder(orderId);

      // Assert
      expect(mockOrderQueue.add).toHaveBeenCalledWith(
        'process-order',
        { orderId },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        },
      );
    });

    it('should handle queue add errors', async () => {
      // Arrange
      const orderId = 'test-order-id';
      const error = new Error('Redis connection failed');
      mockOrderQueue.add.mockRejectedValue(error);

      // Act & Assert
      await expect(service.enqueueOrder(orderId)).rejects.toThrow(
        'Redis connection failed',
      );
      expect(mockOrderQueue.add).toHaveBeenCalledWith(
        'process-order',
        { orderId },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        },
      );
    });

    it('should handle empty order ID', async () => {
      // Arrange
      const orderId = '';
      mockOrderQueue.add.mockResolvedValue({} as any);

      // Act
      await service.enqueueOrder(orderId);

      // Assert
      expect(mockOrderQueue.add).toHaveBeenCalledWith(
        'process-order',
        { orderId: '' },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        },
      );
    });
  });

  describe('getMetrics', () => {
    it('should return order queue metrics', async () => {
      // Arrange
      mockOrderQueue.getWaitingCount.mockResolvedValue(10);
      mockOrderQueue.getActiveCount.mockResolvedValue(2);
      mockOrderQueue.getCompletedCount.mockResolvedValue(150);
      mockOrderQueue.getFailedCount.mockResolvedValue(3);
      mockOrderQueue.getDelayedCount.mockResolvedValue(0);

      // Act
      const result = await service.getMetrics();

      // Assert
      expect(result).toEqual({
        waiting: 10,
        active: 2,
        completed: 150,
        failed: 3,
        delayed: 0,
      });

      expect(mockOrderQueue.getWaitingCount).toHaveBeenCalled();
      expect(mockOrderQueue.getActiveCount).toHaveBeenCalled();
      expect(mockOrderQueue.getCompletedCount).toHaveBeenCalled();
      expect(mockOrderQueue.getFailedCount).toHaveBeenCalled();
      expect(mockOrderQueue.getDelayedCount).toHaveBeenCalled();
    });

    it('should handle metrics retrieval errors', async () => {
      // Arrange
      const error = new Error('Queue metrics unavailable');
      mockOrderQueue.getWaitingCount.mockRejectedValue(error);

      // Act & Assert
      await expect(service.getMetrics()).rejects.toThrow(
        'Queue metrics unavailable',
      );
    });

    it('should handle zero metrics', async () => {
      // Arrange
      mockOrderQueue.getWaitingCount.mockResolvedValue(0);
      mockOrderQueue.getActiveCount.mockResolvedValue(0);
      mockOrderQueue.getCompletedCount.mockResolvedValue(0);
      mockOrderQueue.getFailedCount.mockResolvedValue(0);
      mockOrderQueue.getDelayedCount.mockResolvedValue(0);

      // Act
      const result = await service.getMetrics();

      // Assert
      expect(result).toEqual({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      });
    });
  });

  describe('getAllQueueMetrics', () => {
    it('should return aggregated metrics for all queues', async () => {
      // Arrange
      mockOrderQueue.getWaitingCount.mockResolvedValue(10);
      mockOrderQueue.getActiveCount.mockResolvedValue(2);
      mockOrderQueue.getCompletedCount.mockResolvedValue(150);
      mockOrderQueue.getFailedCount.mockResolvedValue(3);
      mockOrderQueue.getDelayedCount.mockResolvedValue(0);

      mockNotificationQueue.getWaitingCount.mockResolvedValue(5);
      mockNotificationQueue.getActiveCount.mockResolvedValue(1);
      mockNotificationQueue.getCompletedCount.mockResolvedValue(75);
      mockNotificationQueue.getFailedCount.mockResolvedValue(2);
      mockNotificationQueue.getDelayedCount.mockResolvedValue(0);

      // Act
      const result = await service.getAllQueueMetrics();

      // Assert
      expect(result).toEqual({
        orderProcessing: {
          waiting: 10,
          active: 2,
          completed: 150,
          failed: 3,
          delayed: 0,
        },
        notifications: {
          waiting: 5,
          active: 1,
          completed: 75,
          failed: 2,
          delayed: 0,
        },
        aggregated: {
          waiting: 15,
          active: 3,
          completed: 225,
          failed: 5,
          delayed: 0,
        },
      });
    });

    it('should handle partial queue failures in getAllQueueMetrics', async () => {
      // Arrange
      mockOrderQueue.getWaitingCount.mockResolvedValue(10);
      mockOrderQueue.getActiveCount.mockResolvedValue(2);
      mockOrderQueue.getCompletedCount.mockResolvedValue(150);
      mockOrderQueue.getFailedCount.mockResolvedValue(3);
      mockOrderQueue.getDelayedCount.mockResolvedValue(0);

      const error = new Error('Notification queue unavailable');
      mockNotificationQueue.getWaitingCount.mockRejectedValue(error);

      // Act & Assert
      await expect(service.getAllQueueMetrics()).rejects.toThrow(
        'Notification queue unavailable',
      );
    });

    it('should handle empty queue metrics', async () => {
      // Arrange
      mockOrderQueue.getWaitingCount.mockResolvedValue(0);
      mockOrderQueue.getActiveCount.mockResolvedValue(0);
      mockOrderQueue.getCompletedCount.mockResolvedValue(0);
      mockOrderQueue.getFailedCount.mockResolvedValue(0);
      mockOrderQueue.getDelayedCount.mockResolvedValue(0);

      mockNotificationQueue.getWaitingCount.mockResolvedValue(0);
      mockNotificationQueue.getActiveCount.mockResolvedValue(0);
      mockNotificationQueue.getCompletedCount.mockResolvedValue(0);
      mockNotificationQueue.getFailedCount.mockResolvedValue(0);
      mockNotificationQueue.getDelayedCount.mockResolvedValue(0);

      // Act
      const result = await service.getAllQueueMetrics();

      // Assert
      expect(result.aggregated).toEqual({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      });
    });
  });

  describe('enqueueNotification', () => {
    it('should enqueue order_received notification', async () => {
      // Arrange
      const orderId = 'test-order-id';
      const type = 'order_received' as const;
      mockNotificationQueue.add.mockResolvedValue({} as any);

      // Act
      await service.enqueueNotification(orderId, type);

      // Assert
      expect(mockNotificationQueue.add).toHaveBeenCalledWith(
        'send-notification',
        { orderId, type },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      );
    });

    it('should enqueue order_enriched notification', async () => {
      // Arrange
      const orderId = 'test-order-id';
      const type = 'order_enriched' as const;
      mockNotificationQueue.add.mockResolvedValue({} as any);

      // Act
      await service.enqueueNotification(orderId, type);

      // Assert
      expect(mockNotificationQueue.add).toHaveBeenCalledWith(
        'send-notification',
        { orderId, type },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      );
    });

    it('should enqueue order_failed notification', async () => {
      // Arrange
      const orderId = 'test-order-id';
      const type = 'order_failed' as const;
      mockNotificationQueue.add.mockResolvedValue({} as any);

      // Act
      await service.enqueueNotification(orderId, type);

      // Assert
      expect(mockNotificationQueue.add).toHaveBeenCalledWith(
        'send-notification',
        { orderId, type },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      );
    });

    it('should handle notification enqueue errors', async () => {
      // Arrange
      const orderId = 'test-order-id';
      const type = 'order_received' as const;
      const error = new Error('Notification queue full');
      mockNotificationQueue.add.mockRejectedValue(error);

      // Act & Assert
      await expect(service.enqueueNotification(orderId, type)).rejects.toThrow(
        'Notification queue full',
      );
    });
  });

  describe('clearQueue', () => {
    it('should clear order-processing queue', async () => {
      // Arrange
      const queueName = 'order-processing';
      mockOrderQueue.clean.mockResolvedValue(undefined);

      // Act
      await service.clearQueue(queueName);

      // Assert
      expect(mockOrderQueue.clean).toHaveBeenCalledWith(0, 0, 'completed');
      expect(mockOrderQueue.clean).toHaveBeenCalledWith(0, 0, 'failed');
      expect(mockOrderQueue.clean).toHaveBeenCalledWith(0, 0, 'waiting');
      expect(mockOrderQueue.clean).toHaveBeenCalledWith(0, 0, 'active');
    });

    it('should clear notifications queue', async () => {
      // Arrange
      const queueName = 'notifications';
      mockNotificationQueue.clean.mockResolvedValue(undefined);

      // Act
      await service.clearQueue(queueName);

      // Assert
      expect(mockNotificationQueue.clean).toHaveBeenCalledWith(
        0,
        0,
        'completed',
      );
      expect(mockNotificationQueue.clean).toHaveBeenCalledWith(0, 0, 'failed');
      expect(mockNotificationQueue.clean).toHaveBeenCalledWith(0, 0, 'waiting');
      expect(mockNotificationQueue.clean).toHaveBeenCalledWith(0, 0, 'active');
    });

    it('should throw BadRequestException for invalid queue name', async () => {
      // Arrange
      const queueName = 'invalid-queue';

      // Act & Assert
      await expect(service.clearQueue(queueName)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.clearQueue(queueName)).rejects.toThrow(
        'Queue invalid-queue not found',
      );
    });

    it('should handle queue clean errors', async () => {
      // Arrange
      const queueName = 'order-processing';
      const error = new Error('Clean operation failed');
      mockOrderQueue.clean.mockRejectedValue(error);

      // Act & Assert
      await expect(service.clearQueue(queueName)).rejects.toThrow(
        'Clean operation failed',
      );
    });
  });

  describe('getQueueJobs', () => {
    it('should return jobs for order-processing queue', async () => {
      // Arrange
      const queueName = 'order-processing';
      const query = { state: 'waiting', page: 1, limit: 20 };

      const mockJobs = [
        {
          id: 'job-1',
          name: 'process-order',
          data: { orderId: 'order-1' },
          opts: { attempts: 3 },
          progress: 0,
          processedOn: new Date(),
          finishedOn: new Date(),
          failedReason: null,
          returnvalue: null,
        },
      ];

      const mockJobCounts = {
        waiting: 10,
        active: 2,
        completed: 50,
        failed: 1,
        delayed: 0,
      };

      mockOrderQueue.getJobs.mockResolvedValue(mockJobs as any);
      mockOrderQueue.getJobCounts.mockResolvedValue(mockJobCounts);

      // Act
      const result = await service.getQueueJobs(queueName, query);

      // Assert
      expect(mockOrderQueue.getJobs).toHaveBeenCalledWith('waiting', 0, 20);
      expect(mockOrderQueue.getJobCounts).toHaveBeenCalled();

      expect(result).toEqual({
        jobs: [
          {
            id: 'job-1',
            name: 'process-order',
            data: { orderId: 'order-1' },
            opts: { attempts: 3 },
            progress: 0,
            processedOn: mockJobs[0].processedOn,
            finishedOn: mockJobs[0].finishedOn,
            failedReason: null,
            returnvalue: null,
          },
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 10,
        },
      });
    });

    it('should handle default query parameters', async () => {
      // Arrange
      const queueName = 'notifications';
      const query = {};

      mockNotificationQueue.getJobs.mockResolvedValue([] as any);
      mockNotificationQueue.getJobCounts.mockResolvedValue({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      });

      // Act
      await service.getQueueJobs(queueName, query);

      // Assert
      expect(mockNotificationQueue.getJobs).toHaveBeenCalledWith(
        'waiting',
        0,
        20,
      );
    });

    it('should handle pagination correctly', async () => {
      // Arrange
      const queueName = 'order-processing';
      const query = { state: 'completed', page: 2, limit: 10 };

      mockOrderQueue.getJobs.mockResolvedValue([] as any);
      mockOrderQueue.getJobCounts.mockResolvedValue({
        waiting: 0,
        active: 0,
        completed: 25,
        failed: 0,
        delayed: 0,
      });

      // Act
      await service.getQueueJobs(queueName, query);

      // Assert
      expect(mockOrderQueue.getJobs).toHaveBeenCalledWith('completed', 10, 10); // offset = (2-1)*10 = 10
    });

    it('should throw BadRequestException for invalid queue name', async () => {
      // Arrange
      const queueName = 'invalid-queue';
      const query = {};

      // Act & Assert
      await expect(service.getQueueJobs(queueName, query)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.getQueueJobs(queueName, query)).rejects.toThrow(
        'Queue invalid-queue not found',
      );
    });

    it('should handle job retrieval errors', async () => {
      // Arrange
      const queueName = 'order-processing';
      const query = {};
      const error = new Error('Job retrieval failed');
      mockOrderQueue.getJobs.mockRejectedValue(error);

      // Act & Assert
      await expect(service.getQueueJobs(queueName, query)).rejects.toThrow(
        'Job retrieval failed',
      );
    });
  });

  describe('healthCheck', () => {
    it('should pass health check successfully', async () => {
      // Arrange
      mockOrderQueue.getJobCounts.mockResolvedValue({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      });

      // Act & Assert
      await expect(service.healthCheck()).resolves.toBeUndefined();
      expect(mockOrderQueue.getJobCounts).toHaveBeenCalled();
    });

    it('should handle health check failures', async () => {
      // Arrange
      const error = new Error('Queue unavailable');
      mockOrderQueue.getJobCounts.mockRejectedValue(error);

      // Act & Assert
      await expect(service.healthCheck()).rejects.toThrow('Queue unavailable');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle concurrent queue operations', async () => {
      // Arrange
      const orderId = 'test-order';
      mockOrderQueue.add.mockResolvedValue({} as any);
      mockOrderQueue.getWaitingCount.mockResolvedValue(5);

      // Act
      await Promise.all([service.enqueueOrder(orderId), service.getMetrics()]);

      // Assert
      expect(mockOrderQueue.add).toHaveBeenCalledTimes(1);
      expect(mockOrderQueue.getWaitingCount).toHaveBeenCalledTimes(1);
    });

    it('should handle special characters in order ID', async () => {
      // Arrange
      const orderId = 'order-with_special-chars.123';
      mockOrderQueue.add.mockResolvedValue({} as any);

      // Act
      await service.enqueueOrder(orderId);

      // Assert
      expect(mockOrderQueue.add).toHaveBeenCalledWith(
        'process-order',
        { orderId: 'order-with_special-chars.123' },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        },
      );
    });

    it('should handle very long order ID', async () => {
      // Arrange
      const orderId = 'a'.repeat(1000);
      mockOrderQueue.add.mockResolvedValue({} as any);

      // Act
      await service.enqueueOrder(orderId);

      // Assert
      expect(mockOrderQueue.add).toHaveBeenCalledWith(
        'process-order',
        { orderId },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        },
      );
    });
  });
});
