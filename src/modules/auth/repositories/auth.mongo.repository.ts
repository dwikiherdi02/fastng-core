import type { Types } from 'mongoose'
import type { TransactionClient } from '../../../core/database/transaction.js'
import { UserModel } from '../../../core/database/models/user.model.js'
import { RefreshTokenModel } from '../../../core/database/models/refresh-token.model.js'
import { AuthEntity } from '../entities/auth.entity.js'
import type { IAuthRepository, RefreshTokenRecord } from './auth.repository.js'

interface LeanUserDoc {
  _id: Types.ObjectId
  username: string
  email: string
  password: string
  role: string
  createdAt: Date
}

function toEntity(doc: LeanUserDoc): AuthEntity {
  return new AuthEntity({
    id: doc._id.toString(),
    username: doc.username,
    email: doc.email,
    role: doc.role,
    createdAt: doc.createdAt,
  })
}

export class AuthMongoRepository implements IAuthRepository {
  async findByEmail(
    email: string
  ): Promise<{ entity: AuthEntity; passwordHash: string } | null> {
    const doc = await UserModel.findOne({ email }).select('+password').lean<LeanUserDoc>()
    if (!doc) return null
    return { entity: toEntity(doc), passwordHash: doc.password }
  }

  async findById(id: string): Promise<AuthEntity | null> {
    const doc = await UserModel.findById(id).lean<LeanUserDoc>()
    return doc ? toEntity(doc) : null
  }

  async createUser(data: {
    username: string
    email: string
    passwordHash: string
  }): Promise<AuthEntity> {
    const created = await UserModel.create({
      username: data.username,
      email: data.email,
      password: data.passwordHash,
    })
    return new AuthEntity({
      id: (created._id as Types.ObjectId).toString(),
      username: created.username,
      email: created.email,
      role: created.role,
      createdAt: created.createdAt,
    })
  }

  async saveRefreshToken(data: {
    token: string
    userId: string
    expiresAt: Date
  }): Promise<void> {
    await RefreshTokenModel.create(data)
  }

  async findRefreshToken(token: string): Promise<RefreshTokenRecord | null> {
    return RefreshTokenModel.findOne({ token }).lean() as Promise<RefreshTokenRecord | null>
  }

  async deleteRefreshToken(token: string): Promise<void> {
    await RefreshTokenModel.deleteOne({ token })
  }

  async deleteAllRefreshTokensForUser(userId: string): Promise<void> {
    await RefreshTokenModel.deleteMany({ userId })
  }

  withClient(_tx: TransactionClient): IAuthRepository {
    return this
  }
}
