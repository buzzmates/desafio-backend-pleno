import { Processor, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  BaseEnrichmentProcessor,
  EnrichmentJob,
} from '../base-enrichment.processor';
import { OrderRepository } from '../../common/order.repository';
import { PrismaService } from '../../common/prisma.service';
import { AddressValidationService } from '../services/address-validation.service';

interface AddressJob extends EnrichmentJob {
  orderId: string;
}

@Processor('address-validation')
export class AddressProcessor extends BaseEnrichmentProcessor<AddressJob> {
  constructor(
    orderRepository: OrderRepository,
    prisma: PrismaService,
    private readonly addressService: AddressValidationService,
  ) {
    super(orderRepository, prisma, 'AddressProcessor');
  }

  getEnrichmentField(): string {
    return 'addressValidation';
  }

  async enrich(job: Job<AddressJob>): Promise<Record<string, unknown>> {
    const { orderId } = job.data;
    this.logger.log(`Enriching address for order: ${orderId}`);

    // Get order details for address validation
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    // For demo purposes, using a fixed postal code
    // In real implementation, this would come from order customer data
    const postalCode = '01310100'; // Example São Paulo postal code (8 digits)

    this.logger.log(`Using postal code ${postalCode} for order ${orderId}`);
    const validationResult = await this.addressService.validateAddress({
      postalCode,
    });

    this.logger.log(
      `Address validation ${validationResult?.isValid ? 'successful' : 'failed'} for order: ${orderId}`,
    );

    return validationResult as unknown as Record<string, unknown>;
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<AddressJob>) {
    super.onCompleted(job);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<AddressJob>, error: Error) {
    await super.onFailed(job, error);
  }
}
