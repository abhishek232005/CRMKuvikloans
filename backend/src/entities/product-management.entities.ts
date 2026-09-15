import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { RecordStatus } from '../constants/enums';
import { SoftDeleteEntity, UuidEntity } from './base.entity';
import { Lender, LoanProduct } from './crm.entities';
import { Customer, Lead } from './crm.entities';
import { LoanApplication, Document } from './lifecycle.entities';
import { User } from './access.entities';

@Entity('product_fields') @Unique(['productId', 'fieldKey'])
export class ProductField extends SoftDeleteEntity {
  @Index() @Column({ name: 'product_id', type: 'char', length: 36 }) productId!: string;
  @Column({ name: 'field_key', length: 80 }) fieldKey!: string;
  @Column({ length: 120 }) label!: string;
  @Column({ name: 'field_type', length: 30 }) fieldType!: string;
  @Column({ length: 80, nullable: true }) section?: string;
  @Column({ name: 'is_required', default: false }) isRequired!: boolean;
  @Column({ type: 'json', nullable: true }) options?: unknown[];
  @Column({ type: 'json', nullable: true }) validation?: Record<string, unknown>;
  @Column({ name: 'display_order', type: 'int', default: 0 }) displayOrder!: number;
  @Column({ type: 'enum', enum: RecordStatus, default: RecordStatus.ACTIVE }) status!: RecordStatus;
  @ManyToOne(() => LoanProduct) @JoinColumn({ name: 'product_id' }) product!: LoanProduct;
}
@Entity('product_workflow_stages') @Unique(['productId', 'code'])
export class ProductWorkflowStage extends SoftDeleteEntity {
  @Index() @Column({ name: 'product_id', type: 'char', length: 36 }) productId!: string;
  @Column({ length: 80 }) code!: string;
  @Column({ length: 120 }) name!: string;
  @Column({ name: 'stage_order', type: 'int' }) stageOrder!: number;
  @Column({ name: 'is_active', default: true }) isActive!: boolean;
  @ManyToOne(() => LoanProduct) @JoinColumn({ name: 'product_id' }) product!: LoanProduct;
}
@Entity('eligibility_rules')
export class EligibilityRule extends SoftDeleteEntity {
  @Index() @Column({ name: 'product_id', type: 'char', length: 36 }) productId!: string;
  @Index() @Column({ name: 'lender_id', type: 'char', length: 36, nullable: true }) lenderId?: string;
  @Column({ name: 'rule_type', length: 60 }) ruleType!: string;
  @Column({ length: 20 }) operator!: string;
  @Column({ name: 'rule_value', type: 'json' }) ruleValue!: unknown;
  @Column({ name: 'value_type', length: 30, default: 'number' }) valueType!: string;
  @Column({ type: 'int', default: 100 }) priority!: number;
  @Column({ type: 'enum', enum: RecordStatus, default: RecordStatus.ACTIVE }) status!: RecordStatus;
  @ManyToOne(() => LoanProduct) @JoinColumn({ name: 'product_id' }) product!: LoanProduct;
  @ManyToOne(() => Lender) @JoinColumn({ name: 'lender_id' }) lender?: Lender;
}
@Entity('eligibility_results')
export class EligibilityResult extends UuidEntity {
  @Index() @Column({ name: 'customer_id', type: 'char', length: 36 }) customerId!: string;
  @Column({ name: 'lead_id', type: 'char', length: 36, nullable: true }) leadId?: string;
  @Index() @Column({ name: 'product_id', type: 'char', length: 36 }) productId!: string;
  @Column({ type: 'json' }) input!: Record<string, unknown>;
  @Column({ type: 'json' }) recommendations!: unknown[];
  @ManyToOne(() => Customer) @JoinColumn({ name: 'customer_id' }) customer!: Customer;
  @ManyToOne(() => Lead) @JoinColumn({ name: 'lead_id' }) lead?: Lead;
  @ManyToOne(() => LoanProduct) @JoinColumn({ name: 'product_id' }) product!: LoanProduct;
}
@Entity('document_links')
export class DocumentLink extends SoftDeleteEntity {
  @Index() @Column({ name: 'document_id', type: 'char', length: 36 }) documentId!: string;
  @Index() @Column({ name: 'customer_id', type: 'char', length: 36, nullable: true }) customerId?: string;
  @Index() @Column({ name: 'lead_id', type: 'char', length: 36, nullable: true }) leadId?: string;
  @Index() @Column({ name: 'application_id', type: 'char', length: 36, nullable: true }) applicationId?: string;
  @Column({ name: 'product_id', type: 'char', length: 36, nullable: true }) productId?: string;
  @Column({ name: 'document_type', length: 100 }) documentType!: string;
  @Column({ name: 'verified_by_id', type: 'char', length: 36, nullable: true }) verifiedById?: string;
  @Column({ name: 'verified_at', type: 'datetime', nullable: true }) verifiedAt?: Date;
  @Column({ name: 'rejection_reason', type: 'text', nullable: true }) rejectionReason?: string;
  @ManyToOne(() => Document) @JoinColumn({ name: 'document_id' }) document!: Document;
  @ManyToOne(() => User) @JoinColumn({ name: 'verified_by_id' }) verifiedBy?: User;
}
@Entity('document_versions')
export class DocumentVersion extends UuidEntity {
  @Index() @Column({ name: 'document_id', type: 'char', length: 36 }) documentId!: string;
  @Column({ name: 'previous_document_id', type: 'char', length: 36, nullable: true }) previousDocumentId?: string;
  @Column({ name: 'version_number', type: 'int' }) versionNumber!: number;
  @ManyToOne(() => Document) @JoinColumn({ name: 'document_id' }) document!: Document;
}
