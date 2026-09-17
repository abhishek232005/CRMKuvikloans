import bcrypt from "bcrypt";
import { createHash, randomBytes } from "crypto";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import type { Request } from "express";
import { AppDataSource } from "../config/data-source";
import { IsNull } from "typeorm";
import { env } from "../config/env";
import { RecordStatus, AuditAction } from "../constants/enums";
import {
  Role,
  RolePermission,
  User,
  UserRole,
  Permission,
} from "../entities/access.entities";
import { AuthSession, PasswordResetToken } from "../entities/auth.entities";
import { AuditLog } from "../entities/work-finance.entities";
import { AppError } from "../middleware/error-handler";
export type AuthenticatedUser = {
  id: string;
  email: string;
  permissions: string[];
  roles: string[];
};
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const refreshDays = 14;
const publicUser = (user: User, roles: string[], permissions: string[]) => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName ?? null,
  status: user.status,
  roles,
  permissions,
});
export async function getAuthUser(id: string): Promise<AuthenticatedUser> {
  const user = await AppDataSource.getRepository(User).findOneBy({ id });
  if (!user || user.status !== RecordStatus.ACTIVE || user.deletedAt)
    throw new AppError(401, "Session is no longer valid");
  const roleRows = await AppDataSource.getRepository(UserRole).findBy({
    userId: id,
  });
  const roleIds = roleRows.map((row) => row.roleId);
  const roles = roleIds.length
    ? await AppDataSource.getRepository(Role).findByIds(roleIds)
    : [];
  const permissionRows = roleIds.length
    ? await AppDataSource.getRepository(RolePermission)
        .createQueryBuilder("rp")
        .where("rp.role_id IN (:...roleIds)", { roleIds })
        .getMany()
    : [];
  const permissionIds = [
    ...new Set(permissionRows.map((row) => row.permissionId)),
  ];
  const permissions = permissionIds.length
    ? await AppDataSource.getRepository(Permission).findByIds(permissionIds)
    : [];
  return {
    id: user.id,
    email: user.email,
    roles: roles.map((role) => role.code),
    permissions: permissions.map((permission) => permission.code),
  };
}
const accessToken = (user: AuthenticatedUser) =>
  jwt.sign(
    { sub: user.id, email: user.email, permissions: user.permissions },
    env.JWT_ACCESS_SECRET,
    { expiresIn: "15m" },
  );
const refreshToken = (sessionId: string) =>
  jwt.sign({ sid: sessionId }, env.JWT_REFRESH_SECRET, {
    expiresIn: `${refreshDays}d`,
  });
export const refreshCookie = (value: string, expires: Date) => ({
  name: "refresh_token",
  value,
  options: {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/api/v1/auth",
    expires,
  },
});
async function audit(
  userId: string | undefined,
  action: AuditAction,
  module: string,
  entityId?: string,
  request?: Request,
) {
  await AppDataSource.getRepository(AuditLog).save({
    userId,
    action,
    module,
    entityType: module,
    entityId,
    ipAddress: request?.ip,
    userAgent: request?.get("user-agent"),
  });
}
export async function login(email: string, password: string, request: Request) {
  const user = await AppDataSource.getRepository(User).findOneBy({
    email: email.toLowerCase(),
  });
  if (
    !user ||
    user.status !== RecordStatus.ACTIVE ||
    !(await bcrypt.compare(password, user.passwordHash))
  )
    throw new AppError(401, "Invalid email or password");
  const authUser = await getAuthUser(user.id);
  const expiresAt = new Date(Date.now() + refreshDays * 86_400_000);
  const session = await AppDataSource.getRepository(AuthSession).save({
    userId: user.id,
    tokenHash: hash(randomBytes(32).toString("hex")),
    expiresAt,
    ipAddress: request.ip,
    userAgent: request.get("user-agent"),
  });
  const token = refreshToken(session.id);
  session.tokenHash = hash(token);
  await AppDataSource.getRepository(AuthSession).save(session);
  await audit(user.id, AuditAction.LOGIN, "auth", user.id, request);
  return {
    accessToken: accessToken(authUser),
    refresh: refreshCookie(token, expiresAt),
    user: publicUser(user, authUser.roles, authUser.permissions),
  };
}
export async function refresh(token?: string, request?: Request) {
  if (!token) throw new AppError(401, "Refresh token missing");
  let payload: { sid: string };
  try {
    payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as { sid: string };
  } catch {
    throw new AppError(401, "Refresh token invalid");
  }
  const session = await AppDataSource.getRepository(AuthSession).findOneBy({
    id: payload.sid,
    tokenHash: hash(token),
  });
  if (!session || session.revokedAt || session.expiresAt < new Date())
    throw new AppError(401, "Refresh token invalid");
  session.revokedAt = new Date();
  await AppDataSource.getRepository(AuthSession).save(session);
  const user = await getAuthUser(session.userId);
  const expiresAt = new Date(Date.now() + refreshDays * 86_400_000);
  const replacement = await AppDataSource.getRepository(AuthSession).save({
    userId: user.id,
    tokenHash: hash(randomBytes(32).toString("hex")),
    expiresAt,
    ipAddress: request?.ip,
    userAgent: request?.get("user-agent"),
  });
  const nextToken = refreshToken(replacement.id);
  replacement.tokenHash = hash(nextToken);
  await AppDataSource.getRepository(AuthSession).save(replacement);
  return {
    accessToken: accessToken(user),
    refresh: refreshCookie(nextToken, expiresAt),
    user,
  };
}
export async function logout(token?: string, request?: Request) {
  if (token) {
    try {
      const { sid } = jwt.verify(token, env.JWT_REFRESH_SECRET) as {
        sid: string;
      };
      await AppDataSource.getRepository(AuthSession).update(
        { id: sid },
        { revokedAt: new Date() },
      );
    } catch {
      /* cookie is cleared regardless */
    }
  }
  await audit(
    request?.auth?.id,
    AuditAction.LOGOUT,
    "auth",
    request?.auth?.id,
    request,
  );
}
export async function requestPasswordReset(email: string) {
  const user = await AppDataSource.getRepository(User).findOneBy({
    email: email.toLowerCase(),
  });
  if (!user || user.status !== RecordStatus.ACTIVE) return;
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD || !env.SMTP_FROM)
    throw new AppError(503, "Password reset email is not configured yet");
  await AppDataSource.getRepository(PasswordResetToken).update(
    { userId: user.id, usedAt: IsNull() },
    { usedAt: new Date() },
  );
  const raw = randomBytes(32).toString("base64url");
  await AppDataSource.getRepository(PasswordResetToken).save({
    userId: user.id,
    tokenHash: hash(raw),
    expiresAt: new Date(Date.now() + 60 * 60_000),
  });
  const url = `${env.FRONTEND_URL}/reset-password?token=${encodeURIComponent(raw)}`;
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
  });
  await transport.sendMail({
    from: env.SMTP_FROM,
    to: user.email,
    subject: "Reset your Kuvik CRM password",
    text: `Use this link within one hour to reset your password: ${url}`,
  });
}
export async function resetPassword(token: string, password: string) {
  const reset = await AppDataSource.getRepository(PasswordResetToken).findOneBy(
    { tokenHash: hash(token), usedAt: IsNull() },
  );
  if (!reset || reset.expiresAt < new Date())
    throw new AppError(400, "Reset link is invalid or expired");
  const passwordHash = await bcrypt.hash(password, 12);
  await AppDataSource.transaction(async (manager) => {
    await manager
      .getRepository(User)
      .update({ id: reset.userId }, { passwordHash });
    await manager
      .getRepository(PasswordResetToken)
      .update({ id: reset.id }, { usedAt: new Date() });
    await manager
      .getRepository(AuthSession)
      .update(
        { userId: reset.userId, revokedAt: IsNull() },
        { revokedAt: new Date() },
      );
  });
  await audit(reset.userId, AuditAction.UPDATE, "password_reset", reset.userId);
}


