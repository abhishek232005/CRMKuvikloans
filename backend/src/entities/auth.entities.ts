import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { UuidEntity } from './base.entity';
import { User } from './access.entities';

@Entity('auth_sessions')
export class AuthSession extends UuidEntity {
  @Index() @Column({ name: 'user_id', type: 'char', length: 36 }) userId!: string;
  @Index({ unique: true }) @Column({ name: 'token_hash', length: 64 }) tokenHash!: string;
  @Column({ name: 'expires_at', type: 'datetime' }) expiresAt!: Date;
  @Column({ name: 'revoked_at', type: 'datetime', nullable: true }) revokedAt?: Date | null;
  @Column({ name: 'ip_address', length: 64, nullable: true }) ipAddress?: string;
  @Column({ name: 'user_agent', type: 'text', nullable: true }) userAgent?: string;
  @ManyToOne(() => User) @JoinColumn({ name: 'user_id' }) user!: User;
}

@Entity('password_reset_tokens')
export class PasswordResetToken extends UuidEntity {
  @Index() @Column({ name: 'user_id', type: 'char', length: 36 }) userId!: string;
  @Index({ unique: true }) @Column({ name: 'token_hash', length: 64 }) tokenHash!: string;
  @Column({ name: 'expires_at', type: 'datetime' }) expiresAt!: Date;
  @Column({ name: 'used_at', type: 'datetime', nullable: true }) usedAt?: Date | null;
  @ManyToOne(() => User) @JoinColumn({ name: 'user_id' }) user!: User;
}
