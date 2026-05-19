import { AuthEntity } from '../entities/auth.entity.js'

function toEntity(record) {
  return new AuthEntity({
    id: record.id,
    username: record.username,
    email: record.email,
    role: record.role,
    createdAt: record.createdAt,
  })
}

export class AuthPrismaRepository {
  /** @param {import('@prisma/client').PrismaClient} prisma */
  constructor(prisma) {
    this.prisma = prisma
  }

  async findByEmail(email) {
    const record = await this.prisma.user.findUnique({ where: { email } })
    return record ? { entity: toEntity(record), passwordHash: record.password } : null
  }

  async findById(id) {
    const record = await this.prisma.user.findUnique({ where: { id } })
    return record ? toEntity(record) : null
  }

  async createUser({ username, email, passwordHash }) {
    const record = await this.prisma.user.create({
      data: { username, email, password: passwordHash },
    })
    return toEntity(record)
  }

  async saveRefreshToken({ token, userId, expiresAt }) {
    await this.prisma.refreshToken.create({ data: { token, userId, expiresAt } })
  }

  async findRefreshToken(token) {
    return this.prisma.refreshToken.findUnique({ where: { token } })
  }

  async deleteRefreshToken(token) {
    await this.prisma.refreshToken.delete({ where: { token } }).catch(() => {})
  }

  async deleteAllRefreshTokensForUser(userId) {
    await this.prisma.refreshToken.deleteMany({ where: { userId } })
  }

  /**
   * Returns a new repository instance bound to a transaction client.
   * Use inside withTransaction() to run queries atomically.
   * @param {import('@prisma/client').PrismaClient} tx
   */
  withClient(tx) {
    return new AuthPrismaRepository(tx)
  }
}
