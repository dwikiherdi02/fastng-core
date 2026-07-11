import type { PrismaClient } from '@prisma/client'
import type { TransactionClient } from '../../../core/database/transaction.js'
import { AuthEntity } from '../entities/auth.entity.js'
import type {
  IAuthRepository,
  SessionRecord,
  SessionInfo,
  CreateSessionData,
  RotateSessionData,
} from './auth.repository.js'

interface UserRecordWithRoles {
  id: string
  username: string
  email: string
  password: string
  isActive: boolean
  createdAt: Date
  roles: { role: { code: string } }[]
}

function toEntity(record: UserRecordWithRoles): AuthEntity {
  return new AuthEntity({
    id: record.id,
    username: record.username,
    email: record.email,
    roles: record.roles.map((r) => r.role.code),
    isActive: record.isActive,
    createdAt: record.createdAt,
  })
}

const withRoles = { roles: { include: { role: true } } } as const

export class AuthPrismaRepository implements IAuthRepository {
  private prisma: PrismaClient | TransactionClient

  constructor(prisma: PrismaClient | TransactionClient) {
    this.prisma = prisma
  }

  async findByEmail(email: string): Promise<{ entity: AuthEntity; passwordHash: string } | null> {
    const record = await this.prisma.user.findUnique({ where: { email }, include: withRoles })
    return record ? { entity: toEntity(record), passwordHash: record.password } : null
  }

  async findById(id: string): Promise<AuthEntity | null> {
    const record = await this.prisma.user.findUnique({ where: { id }, include: withRoles })
    return record ? toEntity(record) : null
  }

  async createUser(data: {
    username: string
    email: string
    passwordHash: string
  }): Promise<AuthEntity> {
    const defaultRole = await this.prisma.role.findUnique({ where: { code: 'user' } })
    const record = await this.prisma.user.create({
      data: {
        username: data.username,
        email: data.email,
        password: data.passwordHash,
        roles: defaultRole ? { create: { roleId: defaultRole.id } } : undefined,
      },
      include: withRoles,
    })
    return toEntity(record)
  }

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

  withClient(tx: TransactionClient): IAuthRepository {
    return new AuthPrismaRepository(tx)
  }
}
