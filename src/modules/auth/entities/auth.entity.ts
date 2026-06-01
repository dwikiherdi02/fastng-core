export interface AuthEntityProps {
  id: string
  username: string
  email: string
  role: string
  createdAt: Date
}

export class AuthEntity {
  id: string
  username: string
  email: string
  role: string
  createdAt: Date

  constructor({ id, username, email, role, createdAt }: AuthEntityProps) {
    this.id = id
    this.username = username
    this.email = email
    this.role = role
    this.createdAt = createdAt
  }

  isAdmin(): boolean {
    return this.role === 'admin'
  }
}
