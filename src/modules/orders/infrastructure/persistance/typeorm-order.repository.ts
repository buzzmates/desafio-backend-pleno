import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import {
  CreateIfAbsentResult,
  IOrderRepository,
} from '../../domain/repositories/order.repository';
import { OrderEntity } from './order.entity';
import { Order } from '../../domain/entities/order';
import { OrderMapper } from './order.mapper';
import { OrderStatus } from '../../domain/enums/order-status-enum';

@Injectable()
export class TypeOrmOrderRepository extends IOrderRepository {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly repo: Repository<OrderEntity>,
  ) {
    super();
  }

  async save(order: Order): Promise<Order> {
    try {
      const entity = this.repo.create(OrderMapper.toPersistence(order));
      const saved = await this.repo.save(entity);
      return OrderMapper.toDomain(saved);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const existing = await this.findByIdempotencyKey(order.idempotency_key);
        if (!existing) {
          throw error;
        }
        return existing!;
      }
      throw error;
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error as any).driverError?.code === '23505'
    );
  }

  async findById(id: string): Promise<Order | null> {
    const entity = await this.repo.findOne({ where: { id } });

    return entity ? OrderMapper.toDomain(entity) : null;
  }

  async findByIdempotencyKey(key: string): Promise<Order | null> {
    const entity = await this.repo.findOne({
      where: { idempotency_key: key },
    });

    return entity ? OrderMapper.toDomain(entity) : null;
  }

  async findAll(status?: OrderStatus): Promise<Order[]> {
    const entities = await this.repo.find({
      where: status ? { status } : {},
    });

    return entities.map(OrderMapper.toDomain);
  }

  async createIfAbsent(order: Order): Promise<CreateIfAbsentResult> {
    try {
      const entity = this.repo.create(OrderMapper.toPersistence(order));

      const insertResult = await this.repo.insert(entity);
      const insertedId = insertResult.identifiers[0]?.id;

      if (!insertedId) {
        throw new Error('Insert succeeded but no id was returned');
      }
      const rawInsertedId: unknown = insertResult.identifiers[0]?.id;

      if (typeof rawInsertedId !== 'string' || rawInsertedId.length === 0) {
        throw new Error('Insert succeeded but no valid string id was returned');
      }

      const createdOrder = await this.findById(rawInsertedId);

      if (!createdOrder) {
        throw new Error(`Inserted order not found: ${insertedId}`);
      }

      return {
        order: createdOrder,
        created: true,
      };
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const existing = await this.findByIdempotencyKey(order.idempotency_key);

        if (!existing) {
          throw error;
        }

        return {
          order: existing,
          created: false,
        };
      }

      throw error;
    }
  }
}
