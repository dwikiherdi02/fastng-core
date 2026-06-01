import type { PrismaClient } from '@prisma/client'
import type { TransactionClient } from '../../../core/database/transaction.js'
import { UserEntity } from '../entities/user.entity.js'
import type { IUserRepository } from './user.repository.js'

function toEntity(record: {
  id: string
  username: string
  email: string
  role: string
  createdAt: Date
  updatedAt: Date
}): UserEntity {
  return new UserEntity({
    id: record.id,
    username: record.username,
    email: record.email,
    role: record.role,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  })
}

export class UserPrismaRepository implements IUserRepository {
  private prisma: PrismaClient | TransactionClient

  constructor(prisma: PrismaClient | TransactionClient) {
    this.prisma = prisma
  }

  async findById(id: string): Promise<UserEntity | null> {
    const record = await this.prisma.user.findUnique({ where: { id } })
    return record ? toEntity(record) : null
  }

  async findAll({
    page = 1,
    limit = 20,
  }: { page?: number; limit?: number } = {}): Promise<{ items: UserEntity[]; total: number }> {
    const skip = (page - 1) * limit
    const [records, total] = await Promise.all([
      this.prisma.user.findMany({ skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.user.count(),
    ])
    return { items: records.map(toEntity), total }
  }

  async update(id: string, data: { username?: string; email?: string }): Promise<UserEntity> {
    const record = await this.prisma.user.update({ where: { id }, data })
    return toEntity(record)
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } })
  }

  withClient(tx: TransactionClient): IUserRepository {
    return new UserPrismaRepository(tx)
  }
}
