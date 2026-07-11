import type { Types } from 'mongoose'
import type { TransactionClient } from '../../../core/database/transaction.js'
import { UserModel } from '../../../core/database/models/user.model.js'
import { RoleModel } from '../../../core/database/models/role.model.js'
import { SessionModel } from '../../../core/database/models/session.model.js'
import { AuthEntity } from '../entities/auth.entity.js'
import type {
  IAuthRepository,
  SessionRecord,
  SessionInfo,
  CreateSessionData,
  RotateSessionData,
} from './auth.repository.js'

interface LeanUserDoc {
  _id: Types.ObjectId
  username: string
  email: string
  password: string
  isActive: boolean
  roleIds: Types.ObjectId[]
  createdAt: Date
}

async function resolveRoleCodes(roleIds: Types.ObjectId[]): Promise<string[]> {
  if (!roleIds?.length) return []
  const roles = await RoleModel.find({ _id: { $in: roleIds } })
    .select('code')
    .lean()
  return roles.map((r) => r.code)
}

async function toEntity(doc: LeanUserDoc): Promise<AuthEntity> {
  return new AuthEntity({
    id: doc._id.toString(),
    username: doc.username,
    email: doc.email,
    roles: await resolveRoleCodes(doc.roleIds),
    isActive: doc.isActive,
    createdAt: doc.createdAt,
  })
}

export class AuthMongoRepository implements IAuthRepository {
  async findByEmail(email: string): Promise<{ entity: AuthEntity; passwordHash: string } | null> {
    const doc = await UserModel.findOne({ email }).select('+password').lean<LeanUserDoc>()
    if (!doc) return null
    return { entity: await toEntity(doc), passwordHash: doc.password }
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
    const defaultRole = await RoleModel.findOne({ code: 'user' }).select('_id').lean()
    const created = await UserModel.create({
      username: data.username,
      email: data.email,
      password: data.passwordHash,
      roleIds: defaultRole ? [defaultRole._id] : [],
    })
    return new AuthEntity({
      id: (created._id as Types.ObjectId).toString(),
      username: created.username,
      email: created.email,
      roles: defaultRole ? ['user'] : [],
      isActive: created.isActive,
      createdAt: created.createdAt,
    })
  }

  async createSession(data: CreateSessionData): Promise<{ id: string }> {
    const session = await SessionModel.create({
      userId: data.userId,
      refreshTokenHash: data.refreshTokenHash,
      accessTokenJti: data.accessTokenJti,
      expiresAt: data.expiresAt,
      deviceInfo: data.deviceInfo,
      ipAddress: data.ipAddress,
    })
    return { id: (session._id as Types.ObjectId).toString() }
  }

  async findSessionByHash(refreshTokenHash: string): Promise<SessionRecord | null> {
    const session = await SessionModel.findOne({ refreshTokenHash }).lean()
    if (!session) return null
    return {
      id: session._id.toString(),
      userId: session.userId.toString(),
      accessTokenJti: session.accessTokenJti,
      isRevoked: session.isRevoked,
      expiresAt: session.expiresAt,
    }
  }

  async rotateSession(sessionId: string, data: RotateSessionData): Promise<void> {
    await SessionModel.updateOne(
      { _id: sessionId },
      {
        $set: {
          refreshTokenHash: data.refreshTokenHash,
          accessTokenJti: data.accessTokenJti,
          expiresAt: data.expiresAt,
          lastUsedAt: new Date(),
        },
      }
    )
  }

  async revokeSession(sessionId: string): Promise<void> {
    await SessionModel.updateOne({ _id: sessionId }, { $set: { isRevoked: true } })
  }

  async revokeUserSession(userId: string, sessionId: string): Promise<boolean> {
    const result = await SessionModel.updateOne(
      { _id: sessionId, userId },
      { $set: { isRevoked: true } }
    )
    return result.matchedCount > 0
  }

  async deleteSessionByHash(refreshTokenHash: string): Promise<void> {
    await SessionModel.deleteOne({ refreshTokenHash })
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    await SessionModel.deleteMany({ userId })
  }

  async listUserSessions(userId: string): Promise<SessionInfo[]> {
    const sessions = await SessionModel.find({ userId }).sort({ lastUsedAt: -1 }).lean()
    return sessions.map((s) => ({
      id: s._id.toString(),
      deviceInfo: s.deviceInfo ?? null,
      ipAddress: s.ipAddress ?? null,
      isRevoked: s.isRevoked,
      createdAt: s.createdAt,
      lastUsedAt: s.lastUsedAt,
      expiresAt: s.expiresAt,
    }))
  }

  withClient(_tx: TransactionClient): IAuthRepository {
    return this
  }
}
