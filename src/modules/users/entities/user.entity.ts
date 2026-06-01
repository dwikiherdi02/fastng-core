export interface UserEntityProps {
  id: string
  username: string
  email: string
  role: string
  createdAt: Date
  updatedAt: Date
}

export class UserEntity {
  id: string
  username: string
  email: string
  role: string
  createdAt: Date
  updatedAt: Date

  constructor({ id, username, email, role, createdAt, updatedAt }: UserEntityProps) {
    this.id = id
    this.username = username
    this.email = email
    this.role = role
    this.createdAt = createdAt
    this.updatedAt = updatedAt
  }

  isAdmin(): boolean {
    return this.role === 'admin'
  }
}
