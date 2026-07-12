import type { Types } from 'mongoose'
import type { TransactionClient } from '../../../core/database/transaction.js'
import { SessionModel } from '../../../core/database/models/session.model.js'
import type {
  ISessionRepository,
  SessionRecord,
  SessionInfo,
  CreateSessionData,
  RotateSessionData,
} from './session.repository.js'

export class SessionMongoRepository implements ISessionRepository {
  async createSession(data: CreateSessionData): Promise<{ id: string }> {
    const session = await SessionModel.create({
      user_id: data.userId,
      refresh_token_hash: data.refreshTokenHash,
      access_token_jti: data.accessTokenJti,
      expires_at: data.expiresAt,
      device_info: data.deviceInfo,
      ip_address: data.ipAddress,
    })
    return { id: (session._id as Types.ObjectId).toString() }
  }

  async findSessionByHash(refreshTokenHash: string): Promise<SessionRecord | null> {
    const session = await SessionModel.findOne({ refresh_token_hash: refreshTokenHash }).lean()
    if (!session) return null
    return {
      id: session._id.toString(),
      userId: session.user_id.toString(),
      accessTokenJti: session.access_token_jti,
      isRevoked: session.is_revoked,
      expiresAt: session.expires_at,
    }
  }

  async rotateSession(sessionId: string, data: RotateSessionData): Promise<void> {
    await SessionModel.updateOne(
      { _id: sessionId },
      {
        $set: {
          refresh_token_hash: data.refreshTokenHash,
          access_token_jti: data.accessTokenJti,
          expires_at: data.expiresAt,
          last_used_at: new Date(),
        },
      }
    )
  }

  async revokeSession(sessionId: string): Promise<void> {
    await SessionModel.updateOne({ _id: sessionId }, { $set: { is_revoked: true } })
  }

  async revokeUserSession(userId: string, sessionId: string): Promise<boolean> {
    const result = await SessionModel.updateOne(
      { _id: sessionId, user_id: userId },
      { $set: { is_revoked: true } }
    )
    return result.matchedCount > 0
  }

  async deleteSessionByHash(refreshTokenHash: string): Promise<void> {
    await SessionModel.deleteOne({ refresh_token_hash: refreshTokenHash })
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    await SessionModel.deleteMany({ user_id: userId })
  }

  async listUserSessions(userId: string): Promise<SessionInfo[]> {
    const sessions = await SessionModel.find({ user_id: userId }).sort({ last_used_at: -1 }).lean()
    return sessions.map((s) => ({
      id: s._id.toString(),
      deviceInfo: s.device_info ?? null,
      ipAddress: s.ip_address ?? null,
      isRevoked: s.is_revoked,
      createdAt: s.created_at,
      lastUsedAt: s.last_used_at,
      expiresAt: s.expires_at,
    }))
  }

  withClient(_tx: TransactionClient): ISessionRepository {
    return this
  }
}
