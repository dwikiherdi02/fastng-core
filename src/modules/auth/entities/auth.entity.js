/**
 * Pure domain object — no ORM, no framework dependency.
 */
export class AuthEntity {
  /**
   * @param {{id: string, username: string, email: string, role: string, createdAt: Date}} props
   */
  constructor({ id, username, email, role, createdAt }) {
    this.id = id
    this.username = username
    this.email = email
    this.role = role
    this.createdAt = createdAt
  }

  isAdmin() {
    return this.role === 'admin'
  }
}
