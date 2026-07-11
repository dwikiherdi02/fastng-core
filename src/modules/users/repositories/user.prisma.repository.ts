import type { PrismaClient } from '@prisma/client'
import type { TransactionClient } from '../../../core/database/transaction.js'
import { UserEntity } from '../entities/user.entity.js'
import type { IUserRepository } from './user.repository.js'

interface UserRecordWithRoles {
  id: string
  username: string
  email: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  roles: { role: { code: string } }[]
}

function toEntity(record: UserRecordWithRoles): UserEntity {
  return new UserEntity({
    id: record.id,
    username: record.username,
    email: record.email,
    roles: record.roles.map((r) => r.role.code),
    isActive: record.isActive,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  })
}

const withRoles = { roles: { include: { role: true } } } as const

export class UserPrismaRepository implements IUserRepository {
  private prisma: PrismaClient | TransactionClient

  constructor(prisma: PrismaClient | TransactionClient) {
    this.prisma = prisma
  }

  async findById(id: string): Promise<UserEntity | null> {
    const record = await this.prisma.user.findUnique({ where: { id }, include: withRoles })
    return record ? toEntity(record) : null
  }

  async findAll({
    page = 1,
    limit = 20,
  }: { page?: number; limit?: number } = {}): Promise<{ items: UserEntity[]; total: number }> {
    const skip = (page - 1) * limit
    const [records, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: withRoles,
      }),
      this.prisma.user.count(),
    ])
    return { items: records.map(toEntity), total }
  }

  async update(id: string, data: { username?: string; email?: string }): Promise<UserEntity> {
    const record = await this.prisma.user.update({ where: { id }, data, include: withRoles })
    return toEntity(record)
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } })
  }

  withClient(tx: TransactionClient): IUserRepository {
    return new UserPrismaRepository(tx)
  }
}
