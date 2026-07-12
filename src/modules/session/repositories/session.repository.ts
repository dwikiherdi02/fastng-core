import type { PrismaClient } from '@prisma/client'
import type { TransactionClient } from '../../../core/database/transaction.js'
import env from '../../../core/config/env.config.js'
import { SessionPrismaRepository } from './session.prisma.repository.js'
import { SessionMongoRepository } from './session.mongo.repository.js'

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

export interface ISessionRepository {
  createSession(data: CreateSessionData): Promise<{ id: string }>
  findSessionByHash(refreshTokenHash: string): Promise<SessionRecord | null>
  rotateSession(sessionId: string, data: RotateSessionData): Promise<void>
  revokeSession(sessionId: string): Promise<void>
  /** Revoke a session only if it belongs to `userId`. Returns false if not found/owned. */
  revokeUserSession(userId: string, sessionId: string): Promise<boolean>
  deleteSessionByHash(refreshTokenHash: string): Promise<void>
  revokeAllUserSessions(userId: string): Promise<void>
  listUserSessions(userId: string): Promise<SessionInfo[]>
  withClient(tx: TransactionClient): ISessionRepository
}

export function createSessionRepository(prisma: PrismaClient | null): ISessionRepository {
  if (env.DB_DRIVER === 'mongodb') {
    return new SessionMongoRepository()
  }
  return new SessionPrismaRepository(prisma!)
}
