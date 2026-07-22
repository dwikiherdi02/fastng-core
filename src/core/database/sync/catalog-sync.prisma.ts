import type { PrismaClient } from '@prisma/client'
import {
  type ICatalogSyncRepository,
  type MenuInput,
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
      await this.upsertPermission(
        perm.code,
        perm.name ?? humanizePermission(perm.code),
        perm.description
      )
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
    const menuPermissions = await this.prisma.menuPermission.findMany({
      where: { menuId: menu.id },
    })
    for (const mp of menuPermissions) await this.deleteMenuPermission(mp.id)
    await this.prisma.menu.delete({ where: { id: menu.id } })
  }
}
