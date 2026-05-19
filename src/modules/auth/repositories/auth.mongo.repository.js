import { UserModel } from '../../../core/database/models/user.model.js'
import { RefreshTokenModel } from '../../../core/database/models/refresh-token.model.js'
import { AuthEntity } from '../entities/auth.entity.js'

function toEntity(doc) {
  return new AuthEntity({
    id: doc._id.toString(),
    username: doc.username,
    email: doc.email,
    role: doc.role,
    createdAt: doc.createdAt,
  })
}

export class AuthMongoRepository {
  async findByEmail(email) {
    const doc = await UserModel.findOne({ email }).select('+password').lean()
    if (!doc) return null
    return { entity: toEntity(doc), passwordHash: doc.password }
  }

  async findById(id) {
    const doc = await UserModel.findById(id).lean()
    return doc ? toEntity(doc) : null
  }

  async createUser({ username, email, passwordHash }) {
    const doc = await UserModel.create({ username, email, password: passwordHash })
    return toEntity(doc)
  }

  async saveRefreshToken({ token, userId, expiresAt }) {
    await RefreshTokenModel.create({ token, userId, expiresAt })
  }

  async findRefreshToken(token) {
    return RefreshTokenModel.findOne({ token }).lean()
  }

  async deleteRefreshToken(token) {
    await RefreshTokenModel.deleteOne({ token })
  }

  async deleteAllRefreshTokensForUser(userId) {
    await RefreshTokenModel.deleteMany({ userId })
  }

  /**
   * No-op for API consistency with PrismaRepository.
   * MongoDB transactions require a replica set — use withTransaction() only with Prisma.
   */
  withClient() {
    return this
  }
}
