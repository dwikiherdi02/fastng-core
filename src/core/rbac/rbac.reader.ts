import type { PrismaClient } from '@prisma/client'
import env from '../config/env.config.js'
import { RoleModel } from '../database/models/role.model.js'
import { MenuModel } from '../database/models/menu.model.js'
import { UserModel } from '../database/models/user.model.js'

export interface MenuNode {
  code: string
  name: string
  icon: string | null
  path: string | null
  orderIndex: number
  children: MenuNode[]
}

/**
 * Read-side of the RBAC catalog. Lives in `core` (not a module) so the auth-guard
 * plugin can use it without core→module imports. Resolves effective permissions
 * as: user override (allow/deny) wins over role grant (union of the user's roles).
 * `can_access` acts as a master gate — any non-`can_access` check also requires
 * effective `can_access` on the same menu.
 */
export interface IRbacReader {
  hasPermission(
    userId: string,
    roleCodes: string[],
    menuCode: string,
    permissionCode: string
  ): Promise<boolean>
  getAccessibleMenus(userId: string, roleCodes: string[]): Promise<MenuNode[]>
}

interface RawMenu {
  key: string
  parentKey: string | null
  code: string
  name: string
  icon: string | null
  path: string | null
  orderIndex: number
}

function buildTree(items: RawMenu[]): MenuNode[] {
  const nodes = new Map<string, MenuNode>()
  for (const i of items) {
    nodes.set(i.key, {
      code: i.code,
      name: i.name,
      icon: i.icon,
      path: i.path,
      orderIndex: i.orderIndex,
      children: [],
    })
  }
  const roots: MenuNode[] = []
  for (const i of items) {
    const node = nodes.get(i.key)!
    const parent = i.parentKey ? nodes.get(i.parentKey) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  const sortRec = (list: MenuNode[]): void => {
    list.sort((a, b) => a.orderIndex - b.orderIndex)
    list.forEach((n) => sortRec(n.children))
  }
  sortRec(roots)
  return roots
}

class PrismaRbacReader implements IRbacReader {
  constructor(private prisma: PrismaClient) {}

  /** Resolve the menu_permission id for (menuCode, permCode), or null if not in the catalog. */
  private async menuPermissionId(menuCode: string, permCode: string): Promise<string | null> {
    const [menu, perm] = await Promise.all([
      this.prisma.menu.findUnique({ where: { code: menuCode } }),
      this.prisma.permission.findUnique({ where: { code: permCode } }),
    ])
    if (!menu || !perm) return null
    const mp = await this.prisma.menuPermission.findUnique({
      where: { menuId_permissionId: { menuId: menu.id, permissionId: perm.id } },
    })
    return mp?.id ?? null
  }

  /** Effective grant for a menu_permission: user override wins, else role grant. */
  private async isEffective(
    userId: string,
    roleCodes: string[],
    menuPermissionId: string
  ): Promise<boolean> {
    const override = await this.prisma.userMenuPermission.findUnique({
      where: { userId_menuPermissionId: { userId, menuPermissionId } },
    })
    if (override) return override.effect === 'allow'
    if (roleCodes.length === 0) return false
    const count = await this.prisma.roleMenuPermission.count({
      where: { menuPermissionId, role: { code: { in: roleCodes } } },
    })
    return count > 0
  }

  async hasPermission(
    userId: string,
    roleCodes: string[],
    menuCode: string,
    permCode: string
  ): Promise<boolean> {
    const mpId = await this.menuPermissionId(menuCode, permCode)
    if (!mpId) return false
    if (permCode !== 'can_access') {
      if (!(await this.hasPermission(userId, roleCodes, menuCode, 'can_access'))) return false
    }
    return this.isEffective(userId, roleCodes, mpId)
  }

  async getAccessibleMenus(userId: string, roleCodes: string[]): Promise<MenuNode[]> {
    const canAccess = await this.prisma.permission.findUnique({ where: { code: 'can_access' } })
    if (!canAccess) return []
    const menus = await this.prisma.menu.findMany()
    const accessible: RawMenu[] = []
    for (const m of menus) {
      const mp = await this.prisma.menuPermission.findUnique({
        where: { menuId_permissionId: { menuId: m.id, permissionId: canAccess.id } },
      })
      if (!mp) continue
      if (await this.isEffective(userId, roleCodes, mp.id)) {
        accessible.push({
          key: m.id,
          parentKey: m.parentId,
          code: m.code,
          name: m.name,
          icon: m.icon,
          path: m.path,
          orderIndex: m.orderIndex,
        })
      }
    }
    return buildTree(accessible)
  }
}

class MongoRbacReader implements IRbacReader {
  private async isEffective(
    userId: string,
    roleCodes: string[],
    menuCode: string,
    permCode: string
  ): Promise<boolean> {
    const user = await UserModel.findById(userId).select('permission_overrides').lean()
    const override = user?.permission_overrides?.find(
      (o) => o.menu_code === menuCode && o.permission_code === permCode
    )
    if (override) return override.effect === 'allow'
    if (roleCodes.length === 0) return false
    const role = await RoleModel.findOne({
      code: { $in: roleCodes },
      menu_permissions: { $elemMatch: { menu_code: menuCode, permissions: permCode } },
    }).lean()
    return role !== null
  }

  async hasPermission(
    userId: string,
    roleCodes: string[],
    menuCode: string,
    permCode: string
  ): Promise<boolean> {
    const menu = await MenuModel.findOne({ code: menuCode }).lean()
    if (!menu || !(menu.permissions ?? []).includes(permCode)) return false
    if (permCode !== 'can_access') {
      if (!(await this.hasPermission(userId, roleCodes, menuCode, 'can_access'))) return false
    }
    return this.isEffective(userId, roleCodes, menuCode, permCode)
  }

  async getAccessibleMenus(userId: string, roleCodes: string[]): Promise<MenuNode[]> {
    const menus = await MenuModel.find().lean()
    const accessible: RawMenu[] = []
    for (const m of menus) {
      if (!(m.permissions ?? []).includes('can_access')) continue
      if (await this.isEffective(userId, roleCodes, m.code, 'can_access')) {
        accessible.push({
          key: m.code,
          parentKey: m.parent_code ?? null,
          code: m.code,
          name: m.name,
          icon: m.icon ?? null,
          path: m.path ?? null,
          orderIndex: m.order_index,
        })
      }
    }
    return buildTree(accessible)
  }
}

export function createRbacReader(db: PrismaClient | null): IRbacReader {
  if (env.DB_DRIVER === 'mongodb') {
    return new MongoRbacReader()
  }
  return new PrismaRbacReader(db!)
}
