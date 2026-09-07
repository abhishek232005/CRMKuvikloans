import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  Unique,
} from "typeorm";

import { RecordStatus } from "../constants/enums";
import { SoftDeleteEntity, UuidEntity } from "./base.entity";

@Entity("roles")
export class Role extends SoftDeleteEntity {
  @Index({ unique: true })
  @Column({ type: "varchar", length: 80 })
  code!: string;

  @Column({ type: "varchar", length: 120 })
  name!: string;

  @Column({
    type: "enum",
    enum: RecordStatus,
    default: RecordStatus.ACTIVE,
  })
  status!: RecordStatus;
}

@Entity("permissions")
export class Permission extends SoftDeleteEntity {
  @Index({ unique: true })
  @Column({ type: "varchar", length: 120 })
  code!: string;

  @Column({ type: "varchar", length: 80 })
  module!: string;

  @Column({ type: "varchar", length: 160 })
  name!: string;
}

@Entity("branches")
export class Branch extends SoftDeleteEntity {
  @Index({ unique: true })
  @Column({ type: "varchar", length: 30 })
  code!: string;

  @Column({ type: "varchar", length: 160 })
  name!: string;

  @Column({
    type: "varchar",
    length: 100,
    nullable: true,
  })
  city?: string;

  @Column({
    type: "enum",
    enum: RecordStatus,
    default: RecordStatus.ACTIVE,
  })
  status!: RecordStatus;
}

@Entity("teams")
export class Team extends SoftDeleteEntity {
  @Column({ type: "varchar", length: 160 })
  name!: string;

  @Column({
    name: "branch_id",
    type: "char",
    length: 36,
    nullable: true,
  })
  branchId?: string;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: "branch_id" })
  branch?: Branch;
}

@Entity("users")
export class User extends SoftDeleteEntity {
  @Index({ unique: true })
  @Column({ type: "varchar", length: 180 })
  email!: string;

  @Column({
    name: "password_hash",
    type: "varchar",
    length: 255,
  })
  passwordHash!: string;

  @Column({
    name: "first_name",
    type: "varchar",
    length: 80,
  })
  firstName!: string;

  @Column({
    name: "last_name",
    type: "varchar",
    length: 80,
    nullable: true,
  })
  lastName?: string;

  @Column({
    type: "varchar",
    length: 20,
    nullable: true,
  })
  mobile?: string;

  @Column({
    type: "enum",
    enum: RecordStatus,
    default: RecordStatus.ACTIVE,
  })
  status!: RecordStatus;

  @Column({
    name: "branch_id",
    type: "char",
    length: 36,
    nullable: true,
  })
  branchId?: string;

  @Column({
    name: "team_id",
    type: "char",
    length: 36,
    nullable: true,
  })
  teamId?: string;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: "branch_id" })
  branch?: Branch;

  @ManyToOne(() => Team)
  @JoinColumn({ name: "team_id" })
  team?: Team;
}

@Entity("user_roles")
@Unique(["userId", "roleId"])
export class UserRole extends UuidEntity {
  @Column({
    name: "user_id",
    type: "char",
    length: 36,
  })
  userId!: string;

  @Column({
    name: "role_id",
    type: "char",
    length: 36,
  })
  roleId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "user_id" })
  user!: User;

  @ManyToOne(() => Role)
  @JoinColumn({ name: "role_id" })
  role!: Role;
}

@Entity("role_permissions")
@Unique(["roleId", "permissionId"])
export class RolePermission extends UuidEntity {
  @Column({
    name: "role_id",
    type: "char",
    length: 36,
  })
  roleId!: string;

  @Column({
    name: "permission_id",
    type: "char",
    length: 36,
  })
  permissionId!: string;

  @ManyToOne(() => Role)
  @JoinColumn({ name: "role_id" })
  role!: Role;

  @ManyToOne(() => Permission)
  @JoinColumn({ name: "permission_id" })
  permission!: Permission;
}