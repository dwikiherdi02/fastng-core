import type { PrismaClient } from '@prisma/client'
import type { TransactionClient } from '../../../core/database/transaction.js'
import { AuthEntity } from '../entities/auth.entity.js'
import type { IAuthRepository, RefreshTokenRecord } from './auth.repository.js'

function toEntity(record: {
  id: string
  username: string
  email: string
  role: string
  createdAt: Date
}): AuthEntity {
  return new AuthEntity({
    id: record.id,
    username: record.username,
    email: record.email,
    role: record.role,
    createdAt: record.createdAt,
  })
}

export class AuthPrismaRepository implements IAuthRepository {
  private prisma: PrismaClient | TransactionClient

  constructor(prisma: PrismaClient | TransactionClient) {
    this.prisma = prisma
  }

  async findByEmail(email: string): Promise<{ entity: AuthEntity; passwordHash: string } | null> {
    const record = await this.prisma.user.findUnique({ where: { email } })
    return record ? { entity: toEntity(record), passwordHash: record.password } : null
  }

  async findById(id: string): Promise<AuthEntity | null> {
    const record = await this.prisma.user.findUnique({ where: { id } })
    return record ? toEntity(record) : null
  }

  async createUser(data: {
    username: string
    email: string
    passwordHash: string
  }): Promise<AuthEntity> {
    const record = await this.prisma.user.create({
      data: { username: data.username, email: data.email, password: data.passwordHash },
    })
    return toEntity(record)
  }

  async saveRefreshToken(data: {
    token: string
    userId: string
    expiresAt: Date
  }): Promise<void> {
    await this.prisma.refreshToken.create({ data })
  }

  async findRefreshToken(token: string): Promise<RefreshTokenRecord | null> {
    return this.prisma.refreshToken.findUnique({ where: { token } })
  }

  async deleteRefreshToken(token: string): Promise<void> {
    await this.prisma.refreshToken.delete({ where: { token } }).catch(() => {})
  }

  async deleteAllRefreshTokensForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { userId } })
  }

  withClient(tx: TransactionClient): IAuthRepository {
    return new AuthPrismaRepository(tx)
  }
}
