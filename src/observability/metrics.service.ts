import { Injectable } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram } from 'prom-client';

type HttpMetricLabels = {
  method: string;
  route: string;
  status_code: string;
};

type QueueMetricLabels = {
  queue: string;
  outcome: 'completed' | 'failed' | 'dlq';
};

@Injectable()
export class MetricsService {
  constructor(
    @InjectMetric('http_requests_total')
    private readonly httpRequestsTotal: Counter<string>,
    @InjectMetric('http_request_duration_seconds')
    private readonly httpRequestDuration: Histogram<string>,
    @InjectMetric('external_api_request_duration_seconds')
    private readonly externalApiRequestDuration: Histogram<string>,
    @InjectMetric('queue_jobs_processed_total')
    private readonly queueJobsProcessedTotal: Counter<string>,
  ) {}

  startHttpTimer() {
    return this.httpRequestDuration.startTimer();
  }

  incrementHttpRequest(labels: HttpMetricLabels) {
    this.httpRequestsTotal.inc(labels);
  }

  startExternalApiTimer() {
    return this.externalApiRequestDuration.startTimer();
  }

  incrementQueueJob(labels: QueueMetricLabels) {
    this.queueJobsProcessedTotal.inc(labels);
  }
}
