import { Processor, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BaseEnrichmentProcessor, EnrichmentJob } from './base-enrichment.processor';
import { OrderRepository } from '../common/order.repository';
import { PrismaService } from '../common/prisma.service';

interface AddressJob extends EnrichmentJob {
  orderId: string;
}

@Processor('address-validation')
export class AddressProcessor extends BaseEnrichmentProcessor<AddressJob> {
  constructor(
    orderRepository: OrderRepository,
    prisma: PrismaService,
  ) {
    super(orderRepository, prisma, AddressProcessor.name);
  }

  getEnrichmentField(): string {
    return 'addressValidation';
  }

  async enrich(job: Job<AddressJob>): Promise<Record<string, unknown>> {
    const { orderId } = job.data;
    this.logger.log(`Enriching address for order: ${orderId}`);

    // TODO: Implement actual address validation API call
    // For now, placeholder implementation
    return {
      postalCode: '01001-000',
      street: 'Praça da Sé',
      neighborhood: 'Sé',
      city: 'São Paulo',
      state: 'SP',
      isValid: true,
      validatedAt: new Date().toISOString(),
    };
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<AddressJob>) {
    super.onCompleted(job);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<AddressJob>, error: Error) {
    super.onFailed(job, error);
  }
}
