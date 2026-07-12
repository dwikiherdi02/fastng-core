import type { SessionInfo } from '../../session/index.js'

export interface SessionResponse {
  id: string
  deviceInfo: string | null
  ipAddress: string | null
  isRevoked: boolean
  createdAt: Date
  lastUsedAt: Date
  expiresAt: Date
}

export function toSessionResponse(session: SessionInfo): SessionResponse {
  return {
    id: session.id,
    deviceInfo: session.deviceInfo,
    ipAddress: session.ipAddress,
    isRevoked: session.isRevoked,
    createdAt: session.createdAt,
    lastUsedAt: session.lastUsedAt,
    expiresAt: session.expiresAt,
  }
}
