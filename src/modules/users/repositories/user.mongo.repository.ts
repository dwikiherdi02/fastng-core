import type { Types } from 'mongoose'
import type { TransactionClient } from '../../../core/database/transaction.js'
import { UserModel } from '../../../core/database/models/user.model.js'
import { RoleModel } from '../../../core/database/models/role.model.js'
import { UserEntity } from '../entities/user.entity.js'
import type { IUserRepository } from './user.repository.js'

interface LeanUserDoc {
  _id: Types.ObjectId
  username: string
  email: string
  is_active: boolean
  role_ids: Types.ObjectId[]
  created_at: Date
  updated_at: Date
}

async function resolveRoleCodes(roleIds: Types.ObjectId[]): Promise<string[]> {
  if (!roleIds?.length) return []
  const roles = await RoleModel.find({ _id: { $in: roleIds } })
    .select('code')
    .lean()
  return roles.map((r) => r.code)
}

async function toEntity(doc: LeanUserDoc): Promise<UserEntity> {
  return new UserEntity({
    id: doc._id.toString(),
    username: doc.username,
    email: doc.email,
    roles: await resolveRoleCodes(doc.role_ids),
    isActive: doc.is_active,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  })
}

export class UserMongoRepository implements IUserRepository {
  async findById(id: string): Promise<UserEntity | null> {
    const doc = await UserModel.findById(id).lean<LeanUserDoc>()
    return doc ? toEntity(doc) : null
  }

  async findAll({
    page = 1,
    limit = 20,
  }: { page?: number; limit?: number } = {}): Promise<{ items: UserEntity[]; total: number }> {
    const skip = (page - 1) * limit
    const [docs, total] = await Promise.all([
      UserModel.find().skip(skip).limit(limit).sort({ created_at: -1 }).lean<LeanUserDoc[]>(),
      UserModel.countDocuments(),
    ])
    const items = await Promise.all(docs.map(toEntity))
    return { items, total }
  }

  async update(id: string, data: { username?: string; email?: string }): Promise<UserEntity> {
    const doc = await UserModel.findByIdAndUpdate(id, data, { new: true }).lean<LeanUserDoc>()
    if (!doc) throw new Error(`User ${id} not found`)
    return toEntity(doc)
  }

  async delete(id: string): Promise<void> {
    await UserModel.findByIdAndDelete(id)
  }

  withClient(_tx: TransactionClient): IUserRepository {
    return this
  }
}
