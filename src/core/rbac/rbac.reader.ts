import type { PrismaClient } from '@prisma/client'
import env from '../config/env.config.js'
import { RoleModel } from '../database/models/role.model.js'
import { MenuModel } from '../database/models/menu.model.js'

export interface MenuNode {
  code: string
  name: string
  icon: string | null
  path: string | null
  orderIndex: number
  children: MenuNode[]
}

/**
 * Read-side of the RBAC catalog. Lives in `core` (not the auth module) so the
 * auth-guard plugin can use it without core→module imports. The tables it reads
 * are owned by the auth module's Prisma fragment / Mongoose models.
 */
export interface IRbacReader {
  /** True if any of the given role codes grants `permissionCode` on `menuCode` (union / most-permissive). */
  hasPermission(roleCodes: string[], menuCode: string, permissionCode: string): Promise<boolean>
  /** Sidebar tree of menus these roles can access (permission `can_access`), ordered by orderIndex. */
  getAccessibleMenus(roleCodes: string[]): Promise<MenuNode[]>
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

/** Build a nested menu tree from a flat list; a menu whose parent is absent becomes a root. */
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

  async hasPermission(roleCodes: string[], menuCode: string, permissionCode: string): Promise<boolean> {
    if (roleCodes.length === 0) return false
    const count = await this.prisma.roleMenuPermission.count({
      where: {
        role: { code: { in: roleCodes } },
        menuPermission: { menu: { code: menuCode }, permission: { code: permissionCode } },
      },
    })
    return count > 0
  }

  async getAccessibleMenus(roleCodes: string[]): Promise<MenuNode[]> {
    if (roleCodes.length === 0) return []
    const grants = await this.prisma.roleMenuPermission.findMany({
      where: {
        role: { code: { in: roleCodes } },
        menuPermission: { permission: { code: 'can_access' } },
      },
      select: { menuPermission: { select: { menu: true } } },
    })
    const menus = new Map<string, RawMenu>()
    for (const g of grants) {
      const m = g.menuPermission.menu
      menus.set(m.id, {
        key: m.id,
        parentKey: m.parentId,
        code: m.code,
        name: m.name,
        icon: m.icon,
        path: m.path,
        orderIndex: m.orderIndex,
      })
    }
    return buildTree([...menus.values()])
  }
}

class MongoRbacReader implements IRbacReader {
  async hasPermission(roleCodes: string[], menuCode: string, permissionCode: string): Promise<boolean> {
    if (roleCodes.length === 0) return false
    const role = await RoleModel.findOne({
      code: { $in: roleCodes },
      menuPermissions: { $elemMatch: { menuCode, permissions: permissionCode } },
    }).lean()
    return role !== null
  }

  async getAccessibleMenus(roleCodes: string[]): Promise<MenuNode[]> {
    if (roleCodes.length === 0) return []
    const roles = await RoleModel.find({ code: { $in: roleCodes } }).lean()
    const accessibleCodes = new Set<string>()
    for (const role of roles) {
      for (const mp of role.menuPermissions ?? []) {
        if (mp.permissions.includes('can_access')) accessibleCodes.add(mp.menuCode)
      }
    }
    if (accessibleCodes.size === 0) return []
    const menus = await MenuModel.find({ code: { $in: [...accessibleCodes] } }).lean()
    return buildTree(
      menus.map((m) => ({
        key: m.code,
        parentKey: m.parentCode ?? null,
        code: m.code,
        name: m.name,
        icon: m.icon ?? null,
        path: m.path ?? null,
        orderIndex: m.orderIndex,
      }))
    )
  }
}

export function createRbacReader(db: PrismaClient | null): IRbacReader {
  if (env.DB_DRIVER === 'mongodb') {
    return new MongoRbacReader()
  }
  return new PrismaRbacReader(db!)
}
