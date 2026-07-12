import type { PrismaClient } from '@prisma/client'
import {
  type ICatalogSyncRepository,
  type MenuInput,
  type MenuWithPermissions,
  type RoleGrant,
  humanizePermission,
} from './catalog-sync.repository.js'

export class CatalogSyncPrismaRepository implements ICatalogSyncRepository {
  constructor(private prisma: PrismaClient) {}

  async upsertPermission(code: string, name: string, description: string | null): Promise<void> {
    await this.prisma.permission.upsert({
      where: { code },
      create: { code, name, description },
      update: { name, description },
    })
  }

  async upsertMenu(menu: MenuInput): Promise<void> {
    for (const perm of menu.permissions) {
      await this.upsertPermission(perm.code, perm.name ?? humanizePermission(perm.code), perm.description)
    }

    const parentId = menu.parentCode
      ? ((await this.prisma.menu.findUnique({ where: { code: menu.parentCode } }))?.id ?? null)
      : null

    const record = await this.prisma.menu.upsert({
      where: { code: menu.code },
      create: {
        code: menu.code,
        name: menu.name,
        icon: menu.icon,
        path: menu.path,
        orderIndex: menu.orderIndex,
        parentId,
        isActive: true,
      },
      update: {
        name: menu.name,
        icon: menu.icon,
        path: menu.path,
        orderIndex: menu.orderIndex,
        parentId,
        isActive: true,
      },
    })

    // Reconcile menu_permissions (scalar permission_id): add missing, drop removed.
    const permissions = await this.prisma.permission.findMany({
      where: { code: { in: menu.permissions.map((p) => p.code) } },
    })
    const wantedPermissionIds = new Set(permissions.map((p) => p.id))
    const existing = await this.prisma.menuPermission.findMany({ where: { menuId: record.id } })
    const existingPermIds = new Set(existing.map((mp) => mp.permissionId))

    for (const permId of wantedPermissionIds) {
      if (!existingPermIds.has(permId)) {
        await this.prisma.menuPermission.create({
          data: { menuId: record.id, permissionId: permId },
        })
      }
    }
    for (const mp of existing) {
      if (!wantedPermissionIds.has(mp.permissionId)) {
        await this.deleteMenuPermission(mp.id)
      }
    }
  }

  /** Delete a menu_permission and the cross-module grants referencing it (scalar FKs). */
  private async deleteMenuPermission(menuPermissionId: string): Promise<void> {
    await this.prisma.roleMenuPermission.deleteMany({ where: { menuPermissionId } })
    await this.prisma.userMenuPermission.deleteMany({ where: { menuPermissionId } })
    await this.prisma.menuPermission.delete({ where: { id: menuPermissionId } })
  }

  async removeMenu(code: string): Promise<void> {
    const menu = await this.prisma.menu.findUnique({ where: { code } })
    if (!menu) return
    const menuPermissions = await this.prisma.menuPermission.findMany({ where: { menuId: menu.id } })
    for (const mp of menuPermissions) await this.deleteMenuPermission(mp.id)
    await this.prisma.menu.delete({ where: { id: menu.id } })
  }

  async listMenusWithPermissions(): Promise<MenuWithPermissions[]> {
    const [menus, menuPermissions, permissions] = await Promise.all([
      this.prisma.menu.findMany(),
      this.prisma.menuPermission.findMany(),
      this.prisma.permission.findMany(),
    ])
    const permCodeById = new Map(permissions.map((p) => [p.id, p.code]))
    const codesByMenuId = new Map<string, string[]>()
    for (const mp of menuPermissions) {
      const permCode = permCodeById.get(mp.permissionId)
      if (!permCode) continue
      const list = codesByMenuId.get(mp.menuId) ?? []
      list.push(permCode)
      codesByMenuId.set(mp.menuId, list)
    }
    return menus.map((m) => ({ code: m.code, permissions: codesByMenuId.get(m.id) ?? [] }))
  }

  async upsertRole(code: string, name: string, description?: string): Promise<void> {
    await this.prisma.role.upsert({
      where: { code },
      create: { code, name, description },
      update: { name, description },
    })
  }

  private async resolveMenuPermissionIds(grants: RoleGrant[]): Promise<Set<string>> {
    const ids = new Set<string>()
    for (const grant of grants) {
      const menu = await this.prisma.menu.findUnique({ where: { code: grant.menuCode } })
      if (!menu) continue
      const permissions = await this.prisma.permission.findMany({
        where: { code: { in: grant.permissions } },
      })
      for (const perm of permissions) {
        const mp = await this.prisma.menuPermission.findUnique({
          where: { menuId_permissionId: { menuId: menu.id, permissionId: perm.id } },
        })
        if (mp) ids.add(mp.id)
      }
    }
    return ids
  }

  async setRoleGrants(roleCode: string, grants: RoleGrant[]): Promise<void> {
    const role = await this.prisma.role.findUnique({ where: { code: roleCode } })
    if (!role) throw new Error(`Cannot set grants: role "${roleCode}" not found.`)
    const wanted = await this.resolveMenuPermissionIds(grants)
    const existing = await this.prisma.roleMenuPermission.findMany({ where: { roleId: role.id } })
    const existingIds = new Set(existing.map((r) => r.menuPermissionId))

    for (const mpId of wanted) {
      if (!existingIds.has(mpId)) {
        await this.prisma.roleMenuPermission.create({
          data: { roleId: role.id, menuPermissionId: mpId },
        })
      }
    }
    for (const rmp of existing) {
      if (!wanted.has(rmp.menuPermissionId)) {
        await this.prisma.roleMenuPermission.delete({ where: { id: rmp.id } })
      }
    }
  }

  async upsertUserWithRoles(
    data: { username: string; email: string; passwordHash: string },
    roleCodes: string[]
  ): Promise<void> {
    const user = await this.prisma.user.upsert({
      where: { email: data.email },
      create: { username: data.username, email: data.email, password: data.passwordHash },
      update: { username: data.username },
    })
    const roles = await this.prisma.role.findMany({ where: { code: { in: roleCodes } } })
    await this.prisma.userRole.deleteMany({ where: { userId: user.id } })
    for (const role of roles) {
      await this.prisma.userRole.create({ data: { userId: user.id, roleId: role.id } })
    }
  }
}
