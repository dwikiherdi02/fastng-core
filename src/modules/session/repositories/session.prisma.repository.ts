import type { PrismaClient } from '@prisma/client'
import type { TransactionClient } from '../../../core/database/transaction.js'
import type {
  ISessionRepository,
  SessionRecord,
  SessionInfo,
  CreateSessionData,
  RotateSessionData,
} from './session.repository.js'

export class SessionPrismaRepository implements ISessionRepository {
  constructor(private prisma: PrismaClient | TransactionClient) {}

  async createSession(data: CreateSessionData): Promise<{ id: string }> {
    const session = await this.prisma.session.create({
      data: {
        userId: data.userId,
        refreshTokenHash: data.refreshTokenHash,
        accessTokenJti: data.accessTokenJti,
        expiresAt: data.expiresAt,
        deviceInfo: data.deviceInfo,
        ipAddress: data.ipAddress,
      },
    })
    return { id: session.id }
  }

  async findSessionByHash(refreshTokenHash: string): Promise<SessionRecord | null> {
    const session = await this.prisma.session.findUnique({ where: { refreshTokenHash } })
    if (!session) return null
    return {
      id: session.id,
      userId: session.userId,
      accessTokenJti: session.accessTokenJti,
      isRevoked: session.isRevoked,
      expiresAt: session.expiresAt,
    }
  }

  async rotateSession(sessionId: string, data: RotateSessionData): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        refreshTokenHash: data.refreshTokenHash,
        accessTokenJti: data.accessTokenJti,
        expiresAt: data.expiresAt,
        lastUsedAt: new Date(),
      },
    })
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.prisma.session.update({ where: { id: sessionId }, data: { isRevoked: true } })
  }

  async revokeUserSession(userId: string, sessionId: string): Promise<boolean> {
    const result = await this.prisma.session.updateMany({
      where: { id: sessionId, userId },
      data: { isRevoked: true },
    })
    return result.count > 0
  }

  async deleteSessionByHash(refreshTokenHash: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { refreshTokenHash } })
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { userId } })
  }

  async listUserSessions(userId: string): Promise<SessionInfo[]> {
    const sessions = await this.prisma.session.findMany({
      where: { userId },
      orderBy: { lastUsedAt: 'desc' },
    })
    return sessions.map((s) => ({
      id: s.id,
      deviceInfo: s.deviceInfo,
      ipAddress: s.ipAddress,
      isRevoked: s.isRevoked,
      createdAt: s.createdAt,
      lastUsedAt: s.lastUsedAt,
      expiresAt: s.expiresAt,
    }))
  }

  withClient(tx: TransactionClient): ISessionRepository {
    return new SessionPrismaRepository(tx)
  }
}
