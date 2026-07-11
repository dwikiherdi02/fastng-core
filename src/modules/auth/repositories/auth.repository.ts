import type { PrismaClient } from '@prisma/client'
import type { TransactionClient } from '../../../core/database/transaction.js'
import type { AuthEntity } from '../entities/auth.entity.js'
import env from '../../../core/config/env.config.js'
import { AuthPrismaRepository } from './auth.prisma.repository.js'
import { AuthMongoRepository } from './auth.mongo.repository.js'

/** Minimal session state needed by the refresh flow. */
export interface SessionRecord {
  id: string
  userId: string
  accessTokenJti: string
  isRevoked: boolean
  expiresAt: Date
}

/** Session metadata exposed to the user (device list / force-logout). */
export interface SessionInfo {
  id: string
  deviceInfo: string | null
  ipAddress: string | null
  isRevoked: boolean
  createdAt: Date
  lastUsedAt: Date
  expiresAt: Date
}

export interface CreateSessionData {
  userId: string
  refreshTokenHash: string
  accessTokenJti: string
  expiresAt: Date
  deviceInfo?: string
  ipAddress?: string
}

export interface RotateSessionData {
  refreshTokenHash: string
  accessTokenJti: string
  expiresAt: Date
}

export interface IAuthRepository {
  findByEmail(email: string): Promise<{ entity: AuthEntity; passwordHash: string } | null>
  findById(id: string): Promise<AuthEntity | null>
  /** Create a user and assign the default `user` role (if seeded). */
  createUser(data: { username: string; email: string; passwordHash: string }): Promise<AuthEntity>

  createSession(data: CreateSessionData): Promise<{ id: string }>
  findSessionByHash(refreshTokenHash: string): Promise<SessionRecord | null>
  /** Rotate a session in place: new refresh hash + jti + expiry, bump lastUsedAt. */
  rotateSession(sessionId: string, data: RotateSessionData): Promise<void>
  /** Mark a session revoked (force-logout); the current access token stays valid until it expires. */
  revokeSession(sessionId: string): Promise<void>
  /** Revoke a session only if it belongs to `userId`. Returns false if not found/owned. */
  revokeUserSession(userId: string, sessionId: string): Promise<boolean>
  /** Delete a session by its refresh-token hash (logout). */
  deleteSessionByHash(refreshTokenHash: string): Promise<void>
  /** Delete every session for a user (e.g. on email change or account deletion). */
  revokeAllUserSessions(userId: string): Promise<void>
  listUserSessions(userId: string): Promise<SessionInfo[]>

  withClient(tx: TransactionClient): IAuthRepository
}

export function createAuthRepository(prisma: PrismaClient | null): IAuthRepository {
  if (env.DB_DRIVER === 'mongodb') {
    return new AuthMongoRepository()
  }
  return new AuthPrismaRepository(prisma!)
}
