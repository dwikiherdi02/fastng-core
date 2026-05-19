import { UserModel } from '../../../core/database/models/user.model.js'
import { UserEntity } from '../entities/user.entity.js'

function toEntity(doc) {
  return new UserEntity({
    id: doc._id.toString(),
    username: doc.username,
    email: doc.email,
    role: doc.role,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  })
}

export class UserMongoRepository {
  async findById(id) {
    const doc = await UserModel.findById(id).lean()
    return doc ? toEntity(doc) : null
  }

  async findAll({ page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit
    const [docs, total] = await Promise.all([
      UserModel.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      UserModel.countDocuments(),
    ])
    return { items: docs.map(toEntity), total }
  }

  async update(id, data) {
    const doc = await UserModel.findByIdAndUpdate(id, data, { new: true }).lean()
    return toEntity(doc)
  }

  async delete(id) {
    await UserModel.findByIdAndDelete(id)
  }

  /**
   * No-op for API consistency with PrismaRepository.
   * MongoDB transactions require a replica set — use withTransaction() only with Prisma.
   */
  withClient() {
    return this
  }
}
