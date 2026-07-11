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

  async upsertPermission(code: string, name: string): Promise<void> {
    await this.prisma.permission.upsert({
      where: { code },
      create: { code, name },
      update: { name },
    })
  }

  async upsertMenu(menu: MenuInput): Promise<void> {
    // Ensure every supported permission exists in the global catalog first.
    for (const code of menu.permissions) {
      await this.upsertPermission(code, humanizePermission(code))
    }

    const parentId = menu.parentCode
      ? (await this.prisma.menu.findUnique({ where: { code: menu.parentCode } }))?.id ?? null
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

    // Reconcile menu_permissions: add missing links, drop links no longer declared.
    const permissions = await this.prisma.permission.findMany({
      where: { code: { in: menu.permissions } },
    })
    const wantedPermissionIds = new Set(permissions.map((p) => p.id))

    const existing = await this.prisma.menuPermission.findMany({ where: { menuId: record.id } })
    const existingByPermId = new Map(existing.map((mp) => [mp.permissionId, mp]))

    for (const permId of wantedPermissionIds) {
      if (!existingByPermId.has(permId)) {
        await this.prisma.menuPermission.create({
          data: { menuId: record.id, permissionId: permId },
        })
      }
    }
    for (const mp of existing) {
      if (!wantedPermissionIds.has(mp.permissionId)) {
        // Cascades to role_menu_permissions.
        await this.prisma.menuPermission.delete({ where: { id: mp.id } })
      }
    }
  }

  async removeMenu(code: string): Promise<void> {
    const menu = await this.prisma.menu.findUnique({ where: { code } })
    if (!menu) return
    // onDelete: Cascade removes menu_permissions → role_menu_permissions.
    await this.prisma.menu.delete({ where: { id: menu.id } })
  }

  async listMenusWithPermissions(): Promise<MenuWithPermissions[]> {
    const menus = await this.prisma.menu.findMany({
      include: { menuPermissions: { include: { permission: true } } },
    })
    return menus.map((m) => ({
      code: m.code,
      permissions: m.menuPermissions.map((mp) => mp.permission.code),
    }))
  }

  async upsertRole(code: string, name: string, description?: string): Promise<void> {
    await this.prisma.role.upsert({
      where: { code },
      create: { code, name, description },
      update: { name, description },
    })
  }

  async setRoleGrants(roleCode: string, grants: RoleGrant[]): Promise<void> {
    const role = await this.prisma.role.findUnique({ where: { code: roleCode } })
    if (!role) throw new Error(`Cannot set grants: role "${roleCode}" not found.`)

    // Resolve every (menuCode, permissionCode) grant to a menu_permission id.
    const wantedMenuPermissionIds = new Set<string>()
    for (const grant of grants) {
      const menu = await this.prisma.menu.findUnique({ where: { code: grant.menuCode } })
      if (!menu) continue
      const menuPermissions = await this.prisma.menuPermission.findMany({
        where: { menuId: menu.id, permission: { code: { in: grant.permissions } } },
      })
      for (const mp of menuPermissions) wantedMenuPermissionIds.add(mp.id)
    }

    const existing = await this.prisma.roleMenuPermission.findMany({ where: { roleId: role.id } })
    const existingIds = new Set(existing.map((r) => r.menuPermissionId))

    for (const mpId of wantedMenuPermissionIds) {
      if (!existingIds.has(mpId)) {
        await this.prisma.roleMenuPermission.create({
          data: { roleId: role.id, menuPermissionId: mpId },
        })
      }
    }
    for (const rmp of existing) {
      if (!wantedMenuPermissionIds.has(rmp.menuPermissionId)) {
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
