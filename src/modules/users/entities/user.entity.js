/**
 * Pure domain object — no ORM, no framework dependency.
 */
export class UserEntity {
  /**
   * @param {{id: string, username: string, email: string, role: string, createdAt: Date, updatedAt: Date}} props
   */
  constructor({ id, username, email, role, createdAt, updatedAt }) {
    this.id = id
    this.username = username
    this.email = email
    this.role = role
    this.createdAt = createdAt
    this.updatedAt = updatedAt
  }

  isAdmin() {
    return this.role === 'admin'
  }
}
