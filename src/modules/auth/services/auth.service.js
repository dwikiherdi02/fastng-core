import bcrypt from 'bcryptjs'
import {
  ConflictError,
  UnauthorizedError,
  NotFoundError,
} from '../../../core/utils/errors.js'
import env from '../../../core/config/env.config.js'

const SALT_ROUNDS = 12

function msFromExpiry(expiry) {
  const units = { m: 60_000, h: 3_600_000, d: 86_400_000 }
  const match = expiry.match(/^(\d+)([mhd])$/)
  if (!match) throw new Error(`Invalid expiry format: ${expiry}`)
  return parseInt(match[1]) * units[match[2]]
}

export class AuthService {
  /**
   * @param {import('../repositories/auth.prisma.repository.js').AuthPrismaRepository} repository
   * @param {import('fastify').FastifyInstance} fastify
   */
  constructor(repository, fastify) {
    this.repository = repository
    this.fastify = fastify
  }

  async register({ username, email, password }) {
    const existing = await this.repository.findByEmail(email)
    if (existing) throw new ConflictError('Email is already registered')

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)
    const entity = await this.repository.createUser({ username, email, passwordHash })
    const tokens = await this.#issueTokens(entity)
    return { entity, tokens }
  }

  async login({ email, password }) {
    const result = await this.repository.findByEmail(email)
    if (!result) throw new UnauthorizedError('Invalid email or password')

    const valid = await bcrypt.compare(password, result.passwordHash)
    if (!valid) throw new UnauthorizedError('Invalid email or password')

    const tokens = await this.#issueTokens(result.entity)
    return { entity: result.entity, tokens }
  }

  async refreshToken(refreshTokenValue) {
    const stored = await this.repository.findRefreshToken(refreshTokenValue)
    if (!stored) throw new UnauthorizedError('Invalid refresh token')

    const now = new Date()
    if (new Date(stored.expiresAt) < now) {
      await this.repository.deleteRefreshToken(refreshTokenValue)
      throw new UnauthorizedError('Refresh token expired')
    }

    const userId = stored.userId?.toString?.() ?? stored.userId
    const entity = await this.repository.findById(userId)
    if (!entity) throw new NotFoundError('User not found')

    // Rotate: delete old, issue new
    await this.repository.deleteRefreshToken(refreshTokenValue)
    const tokens = await this.#issueTokens(entity)
    return { entity, tokens }
  }

  async logout(refreshTokenValue) {
    await this.repository.deleteRefreshToken(refreshTokenValue)
  }

  /**
   * Revokes all active refresh tokens for a user.
   * Called by other services (e.g. UserService) when a security-sensitive
   * change occurs (email update, password change) to force re-authentication.
   * @param {string} userId
   */
  async revokeAllTokens(userId) {
    await this.repository.deleteAllRefreshTokensForUser(userId)
  }

  async #issueTokens(entity) {
    const payload = { sub: entity.id, username: entity.username, role: entity.role }
    const accessToken = this.fastify.jwt.sign(payload, {
      expiresIn: env.JWT_ACCESS_EXPIRES,
    })

    const refreshToken = this.fastify.jwt.sign(
      { sub: entity.id, type: 'refresh' },
      { expiresIn: env.JWT_REFRESH_EXPIRES }
    )

    const expiresAt = new Date(Date.now() + msFromExpiry(env.JWT_REFRESH_EXPIRES))
    await this.repository.saveRefreshToken({ token: refreshToken, userId: entity.id, expiresAt })

    return { accessToken, refreshToken }
  }
}
