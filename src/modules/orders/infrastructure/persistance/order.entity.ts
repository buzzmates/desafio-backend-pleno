import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrderStatus } from '../../domain/enums/order-status-enum';
import { OrderItem } from '../../domain/types/order.type';

@Entity('orders')
export class OrderEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  @Index()
  order_id!: string;

  @Column({ unique: true })
  idempotency_key!: string;

  @Column()
  customer_name!: string;

  @Column()
  customer_email!: string;

  @Column({ type: 'jsonb' })
  items!: OrderItem[];

  @Column()
  currency!: string;

  @Column({ type: 'numeric' })
  total_amount!: number;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.RECEIVED,
  })
  status!: OrderStatus;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
