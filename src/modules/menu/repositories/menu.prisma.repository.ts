import type { PrismaClient } from '@prisma/client'
import type { IMenuRepository, MenuCatalogItem } from './menu.repository.js'

export class MenuPrismaRepository implements IMenuRepository {
  constructor(private prisma: PrismaClient) {}

  async listCatalog(): Promise<MenuCatalogItem[]> {
    // Step-wise joins (menu_permissions.permission_id is a scalar FK to another module).
    const [menus, menuPermissions, permissions] = await Promise.all([
      this.prisma.menu.findMany({ orderBy: { orderIndex: 'asc' } }),
      this.prisma.menuPermission.findMany(),
      this.prisma.permission.findMany(),
    ])
    const permById = new Map(permissions.map((p) => [p.id, p]))
    const permsByMenuId = new Map<string, MenuCatalogItem['permissions']>()
    for (const mp of menuPermissions) {
      const perm = permById.get(mp.permissionId)
      if (!perm) continue
      const list = permsByMenuId.get(mp.menuId) ?? []
      list.push({ code: perm.code, name: perm.name, description: perm.description })
      permsByMenuId.set(mp.menuId, list)
    }
    return menus.map((m) => ({
      code: m.code,
      name: m.name,
      icon: m.icon,
      path: m.path,
      parentCode: m.parentId ? (menus.find((x) => x.id === m.parentId)?.code ?? null) : null,
      orderIndex: m.orderIndex,
      permissions: permsByMenuId.get(m.id) ?? [],
    }))
  }
}
