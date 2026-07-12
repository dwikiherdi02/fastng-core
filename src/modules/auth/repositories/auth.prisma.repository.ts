import type { PrismaClient } from '@prisma/client'
import type { TransactionClient } from '../../../core/database/transaction.js'
import { AuthEntity } from '../entities/auth.entity.js'
import type { IAuthRepository, UserPermissionOverride } from './auth.repository.js'

interface UserRow {
  id: string
  username: string
  email: string
  password: string
  isActive: boolean
  createdAt: Date
}

export class AuthPrismaRepository implements IAuthRepository {
  constructor(private prisma: PrismaClient | TransactionClient) {}

  private async roleCodesFor(userId: string): Promise<string[]> {
    const userRoles = await this.prisma.userRole.findMany({ where: { userId } })
    if (userRoles.length === 0) return []
    const roles = await this.prisma.role.findMany({
      where: { id: { in: userRoles.map((ur) => ur.roleId) } },
    })
    return roles.map((r) => r.code)
  }

  private toEntity(row: UserRow, roles: string[]): AuthEntity {
    return new AuthEntity({
      id: row.id,
      username: row.username,
      email: row.email,
      roles,
      isActive: row.isActive,
      createdAt: row.createdAt,
    })
  }

  async findByEmail(email: string): Promise<{ entity: AuthEntity; passwordHash: string } | null> {
    const row = await this.prisma.user.findUnique({ where: { email } })
    if (!row) return null
    const roles = await this.roleCodesFor(row.id)
    return { entity: this.toEntity(row, roles), passwordHash: row.password }
  }

  async findById(id: string): Promise<AuthEntity | null> {
    const row = await this.prisma.user.findUnique({ where: { id } })
    if (!row) return null
    return this.toEntity(row, await this.roleCodesFor(row.id))
  }

  async createUser(data: {
    username: string
    email: string
    passwordHash: string
  }): Promise<AuthEntity> {
    const row = await this.prisma.user.create({
      data: { username: data.username, email: data.email, password: data.passwordHash },
    })
    const defaultRole = await this.prisma.role.findUnique({ where: { code: 'user' } })
    if (defaultRole) {
      await this.prisma.userRole.create({ data: { userId: row.id, roleId: defaultRole.id } })
    }
    return this.toEntity(row, defaultRole ? ['user'] : [])
  }

  async getUserRoleCodes(userId: string): Promise<string[]> {
    return this.roleCodesFor(userId)
  }

  async setUserRoles(userId: string, roleCodes: string[]): Promise<void> {
    const roles = await this.prisma.role.findMany({ where: { code: { in: roleCodes } } })
    await this.prisma.userRole.deleteMany({ where: { userId } })
    for (const role of roles) {
      await this.prisma.userRole.create({ data: { userId, roleId: role.id } })
    }
  }

  async getUserPermissionOverrides(userId: string): Promise<UserPermissionOverride[]> {
    const overrides = await this.prisma.userMenuPermission.findMany({ where: { userId } })
    if (overrides.length === 0) return []
    const menuPermissions = await this.prisma.menuPermission.findMany({
      where: { id: { in: overrides.map((o) => o.menuPermissionId) } },
    })
    const [menus, permissions] = await Promise.all([
      this.prisma.menu.findMany({ where: { id: { in: menuPermissions.map((mp) => mp.menuId) } } }),
      this.prisma.permission.findMany({
        where: { id: { in: menuPermissions.map((mp) => mp.permissionId) } },
      }),
    ])
    const menuCodeById = new Map(menus.map((m) => [m.id, m.code]))
    const permCodeById = new Map(permissions.map((p) => [p.id, p.code]))
    const mpById = new Map(menuPermissions.map((mp) => [mp.id, mp]))

    const result: UserPermissionOverride[] = []
    for (const o of overrides) {
      const mp = mpById.get(o.menuPermissionId)
      if (!mp) continue
      const menuCode = menuCodeById.get(mp.menuId)
      const permissionCode = permCodeById.get(mp.permissionId)
      if (!menuCode || !permissionCode) continue
      result.push({ menuCode, permissionCode, effect: o.effect === 'deny' ? 'deny' : 'allow' })
    }
    return result
  }

  async setUserPermissionOverrides(
    userId: string,
    overrides: UserPermissionOverride[]
  ): Promise<void> {
    await this.prisma.userMenuPermission.deleteMany({ where: { userId } })
    for (const ov of overrides) {
      const menu = await this.prisma.menu.findUnique({ where: { code: ov.menuCode } })
      if (!menu) continue
      const perm = await this.prisma.permission.findUnique({ where: { code: ov.permissionCode } })
      if (!perm) continue
      const mp = await this.prisma.menuPermission.findUnique({
        where: { menuId_permissionId: { menuId: menu.id, permissionId: perm.id } },
      })
      if (!mp) continue
      await this.prisma.userMenuPermission.create({
        data: { userId, menuPermissionId: mp.id, effect: ov.effect },
      })
    }
  }

  withClient(tx: TransactionClient): IAuthRepository {
    return new AuthPrismaRepository(tx)
  }
}
