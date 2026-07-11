export interface AuthEntityProps {
  id: string
  username: string
  email: string
  roles: string[]
  isActive: boolean
  createdAt: Date
}

export class AuthEntity {
  id: string
  username: string
  email: string
  roles: string[]
  isActive: boolean
  createdAt: Date

  constructor({ id, username, email, roles, isActive, createdAt }: AuthEntityProps) {
    this.id = id
    this.username = username
    this.email = email
    this.roles = roles
    this.isActive = isActive
    this.createdAt = createdAt
  }

  isAdmin(): boolean {
    return this.roles.includes('admin')
  }

  hasRole(code: string): boolean {
    return this.roles.includes(code)
  }
}
