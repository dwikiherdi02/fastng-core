import bcrypt from 'bcryptjs'
import { ConflictError, UnauthorizedError, NotFoundError } from '../../../core/utils/errors.js'
import env from '../../../core/config/env.config.js'
import { generateRefreshToken, hashToken, generateJti } from '../../../core/utils/token.js'
import { createRbacReader, type MenuNode } from '../../../core/rbac/rbac.reader.js'
import type { FastifyInstance } from 'fastify'
import type { AuthEntity } from '../entities/auth.entity.js'
import type { IAuthRepository, SessionInfo } from '../repositories/auth.repository.js'

const SALT_ROUNDS = 12

interface Tokens {
  accessToken: string
  refreshToken: string
}

/** Where the login/refresh came from — recorded on the session for device management. */
export interface RequestContext {
  deviceInfo?: string
  ipAddress?: string
}

function msFromExpiry(expiry: string): number {
  const units: Record<string, number> = { m: 60_000, h: 3_600_000, d: 86_400_000 }
  const match = expiry.match(/^(\d+)([mhd])$/)
  if (!match) throw new Error(`Invalid expiry format: ${expiry}`)
  return parseInt(match[1]) * units[match[2]]
}

export class AuthService {
  private repository: IAuthRepository
  private fastify: FastifyInstance

  constructor(repository: IAuthRepository, fastify: FastifyInstance) {
    this.repository = repository
    this.fastify = fastify
  }

  async register(
    data: { username: string; email: string; password: string },
    ctx: RequestContext = {}
  ): Promise<{ entity: AuthEntity; tokens: Tokens }> {
    const existing = await this.repository.findByEmail(data.email)
    if (existing) throw new ConflictError('Email is already registered')
    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS)
    const entity = await this.repository.createUser({
      username: data.username,
      email: data.email,
      passwordHash,
    })
    const tokens = await this.startSession(entity, ctx)
    return { entity, tokens }
  }

  async login(
    data: { email: string; password: string },
    ctx: RequestContext = {}
  ): Promise<{ entity: AuthEntity; tokens: Tokens }> {
    const result = await this.repository.findByEmail(data.email)
    if (!result) throw new UnauthorizedError('Invalid email or password')
    const valid = await bcrypt.compare(data.password, result.passwordHash)
    if (!valid) throw new UnauthorizedError('Invalid email or password')
    if (!result.entity.isActive) throw new UnauthorizedError('Account is inactive')
    const tokens = await this.startSession(result.entity, ctx)
    return { entity: result.entity, tokens }
  }

  async refreshToken(
    refreshTokenValue: string
  ): Promise<{ entity: AuthEntity; tokens: Tokens }> {
    const hash = hashToken(refreshTokenValue)
    const session = await this.repository.findSessionByHash(hash)
    // Unknown hash: either never issued, or an already-rotated token being replayed.
    if (!session) throw new UnauthorizedError('Invalid refresh token')
    if (session.isRevoked) throw new UnauthorizedError('Session has been revoked')
    if (new Date(session.expiresAt) < new Date()) {
      await this.repository.deleteSessionByHash(hash)
      throw new UnauthorizedError('Refresh token expired')
    }

    const entity = await this.repository.findById(session.userId)
    if (!entity) throw new NotFoundError('User not found')
    if (!entity.isActive) throw new UnauthorizedError('Account is inactive')

    // Rotate: replace the refresh token + jti on the same session row.
    const jti = generateJti()
    const newRefresh = generateRefreshToken()
    const expiresAt = new Date(Date.now() + msFromExpiry(env.JWT_REFRESH_EXPIRES))
    await this.repository.rotateSession(session.id, {
      refreshTokenHash: hashToken(newRefresh),
      accessTokenJti: jti,
      expiresAt,
    })
    const accessToken = this.signAccessToken(entity, session.id, jti)
    return { entity, tokens: { accessToken, refreshToken: newRefresh } }
  }

  async logout(refreshTokenValue: string): Promise<void> {
    await this.repository.deleteSessionByHash(hashToken(refreshTokenValue))
  }

  /** Force-logout a specific device/session owned by the user. */
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const revoked = await this.repository.revokeUserSession(userId, sessionId)
    if (!revoked) throw new NotFoundError('Session not found')
  }

  /** Revoke all of a user's sessions (e.g. on email change / account deletion). */
  async revokeAllTokens(userId: string): Promise<void> {
    await this.repository.revokeAllUserSessions(userId)
  }

  async listSessions(userId: string): Promise<SessionInfo[]> {
    return this.repository.listUserSessions(userId)
  }

  /** Sidebar menu tree the given roles can access. */
  async getMenus(roleCodes: string[]): Promise<MenuNode[]> {
    const reader = createRbacReader(this.fastify.db)
    return reader.getAccessibleMenus(roleCodes)
  }

  private async startSession(entity: AuthEntity, ctx: RequestContext): Promise<Tokens> {
    const jti = generateJti()
    const refreshToken = generateRefreshToken()
    const expiresAt = new Date(Date.now() + msFromExpiry(env.JWT_REFRESH_EXPIRES))
    const session = await this.repository.createSession({
      userId: entity.id,
      refreshTokenHash: hashToken(refreshToken),
      accessTokenJti: jti,
      expiresAt,
      deviceInfo: ctx.deviceInfo,
      ipAddress: ctx.ipAddress,
    })
    const accessToken = this.signAccessToken(entity, session.id, jti)
    return { accessToken, refreshToken }
  }

  private signAccessToken(entity: AuthEntity, sid: string, jti: string): string {
    const payload = {
      sub: entity.id,
      sid,
      jti,
      username: entity.username,
      roles: entity.roles,
    }
    return this.fastify.jwt.sign(payload, { expiresIn: env.JWT_ACCESS_EXPIRES })
  }
}
