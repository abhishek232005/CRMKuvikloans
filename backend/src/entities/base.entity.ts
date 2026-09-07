import { CreateDateColumn, DeleteDateColumn, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
export abstract class UuidEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
export abstract class SoftDeleteEntity extends UuidEntity {
  @DeleteDateColumn({ name: 'deleted_at', nullable: true }) deletedAt?: Date | null;
}
