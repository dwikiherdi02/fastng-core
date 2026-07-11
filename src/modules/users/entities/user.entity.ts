export interface UserEntityProps {
  id: string
  username: string
  email: string
  roles: string[]
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export class UserEntity {
  id: string
  username: string
  email: string
  roles: string[]
  isActive: boolean
  createdAt: Date
  updatedAt: Date

  constructor({ id, username, email, roles, isActive, createdAt, updatedAt }: UserEntityProps) {
    this.id = id
    this.username = username
    this.email = email
    this.roles = roles
    this.isActive = isActive
    this.createdAt = createdAt
    this.updatedAt = updatedAt
  }

  isAdmin(): boolean {
    return this.roles.includes('admin')
  }
}
