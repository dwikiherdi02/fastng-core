import bcrypt from 'bcryptjs'
import { ConflictError, UnauthorizedError, NotFoundError } from '../../../core/utils/errors.js'
import env from '../../../core/config/env.config.js'
import type { FastifyInstance } from 'fastify'
import type { AuthEntity } from '../entities/auth.entity.js'
import type { IAuthRepository } from '../repositories/auth.repository.js'

const SALT_ROUNDS = 12

interface Tokens {
  accessToken: string
  refreshToken: string
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

  async register(data: {
    username: string
    email: string
    password: string
  }): Promise<{ entity: AuthEntity; tokens: Tokens }> {
    const existing = await this.repository.findByEmail(data.email)
    if (existing) throw new ConflictError('Email is already registered')
    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS)
    const entity = await this.repository.createUser({
      username: data.username,
      email: data.email,
      passwordHash,
    })
    const tokens = await this.issueTokens(entity)
    return { entity, tokens }
  }

  async login(data: {
    email: string
    password: string
  }): Promise<{ entity: AuthEntity; tokens: Tokens }> {
    const result = await this.repository.findByEmail(data.email)
    if (!result) throw new UnauthorizedError('Invalid email or password')
    const valid = await bcrypt.compare(data.password, result.passwordHash)
    if (!valid) throw new UnauthorizedError('Invalid email or password')
    const tokens = await this.issueTokens(result.entity)
    return { entity: result.entity, tokens }
  }

  async refreshToken(
    refreshTokenValue: string
  ): Promise<{ entity: AuthEntity; tokens: Tokens }> {
    const stored = await this.repository.findRefreshToken(refreshTokenValue)
    if (!stored) throw new UnauthorizedError('Invalid refresh token')
    if (new Date(stored.expiresAt) < new Date()) {
      await this.repository.deleteRefreshToken(refreshTokenValue)
      throw new UnauthorizedError('Refresh token expired')
    }
    const userId =
      typeof stored.userId === 'string' ? stored.userId : stored.userId.toString()
    const entity = await this.repository.findById(userId)
    if (!entity) throw new NotFoundError('User not found')
    await this.repository.deleteRefreshToken(refreshTokenValue)
    const tokens = await this.issueTokens(entity)
    return { entity, tokens }
  }

  async logout(refreshTokenValue: string): Promise<void> {
    await this.repository.deleteRefreshToken(refreshTokenValue)
  }

  async revokeAllTokens(userId: string): Promise<void> {
    await this.repository.deleteAllRefreshTokensForUser(userId)
  }

  private async issueTokens(entity: AuthEntity): Promise<Tokens> {
    const payload = { sub: entity.id, username: entity.username, role: entity.role }
    const accessToken = this.fastify.jwt.sign(payload, { expiresIn: env.JWT_ACCESS_EXPIRES })
    const refreshToken = this.fastify.jwt.sign(
      { sub: entity.id, type: 'refresh' },
      { expiresIn: env.JWT_REFRESH_EXPIRES }
    )
    const expiresAt = new Date(Date.now() + msFromExpiry(env.JWT_REFRESH_EXPIRES))
    await this.repository.saveRefreshToken({ token: refreshToken, userId: entity.id, expiresAt })
    return { accessToken, refreshToken }
  }
}
