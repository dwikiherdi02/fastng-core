import { UserEntity } from '../entities/user.entity.js'

function toEntity(record) {
  return new UserEntity({
    id: record.id,
    username: record.username,
    email: record.email,
    role: record.role,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  })
}

export class UserPrismaRepository {
  /** @param {import('@prisma/client').PrismaClient} prisma */
  constructor(prisma) {
    this.prisma = prisma
  }

  async findById(id) {
    const record = await this.prisma.user.findUnique({ where: { id } })
    return record ? toEntity(record) : null
  }

  async findAll({ page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit
    const [records, total] = await Promise.all([
      this.prisma.user.findMany({ skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.user.count(),
    ])
    return { items: records.map(toEntity), total }
  }

  async update(id, data) {
    const record = await this.prisma.user.update({ where: { id }, data })
    return toEntity(record)
  }

  async delete(id) {
    await this.prisma.user.delete({ where: { id } })
  }

  /**
   * Returns a new repository instance bound to a transaction client.
   * Use inside withTransaction() to run queries atomically.
   * @param {import('@prisma/client').PrismaClient} tx
   */
  withClient(tx) {
    return new UserPrismaRepository(tx)
  }
}
