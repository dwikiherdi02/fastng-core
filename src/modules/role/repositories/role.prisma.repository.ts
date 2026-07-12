import type { PrismaClient } from '@prisma/client'
import type { TransactionClient } from '../../../core/database/transaction.js'
import type { IRoleRepository, RoleRecord, RoleGrant } from './role.repository.js'

interface RoleRow {
  id: string
  code: string
  name: string
  description: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

function toRecord(r: RoleRow): RoleRecord {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    description: r.description,
    isActive: r.isActive,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
}

export class RolePrismaRepository implements IRoleRepository {
  constructor(private prisma: PrismaClient | TransactionClient) {}

  async list(): Promise<RoleRecord[]> {
    const rows = await this.prisma.role.findMany({ orderBy: { code: 'asc' } })
    return rows.map(toRecord)
  }

  async findById(id: string): Promise<RoleRecord | null> {
    const row = await this.prisma.role.findUnique({ where: { id } })
    return row ? toRecord(row) : null
  }

  async findByCode(code: string): Promise<RoleRecord | null> {
    const row = await this.prisma.role.findUnique({ where: { code } })
    return row ? toRecord(row) : null
  }

  async create(data: { code: string; name: string; description?: string }): Promise<RoleRecord> {
    const row = await this.prisma.role.create({ data })
    return toRecord(row)
  }

  async update(
    id: string,
    data: { name?: string; description?: string; isActive?: boolean }
  ): Promise<RoleRecord | null> {
    const row = await this.prisma.role.update({ where: { id }, data }).catch(() => null)
    return row ? toRecord(row) : null
  }

  async delete(id: string): Promise<void> {
    // role_menu_permissions cascade via the intra-module relation.
    await this.prisma.role.delete({ where: { id } }).catch(() => {})
  }

  async getGrants(roleId: string): Promise<RoleGrant[]> {
    const rmps = await this.prisma.roleMenuPermission.findMany({ where: { roleId } })
    if (rmps.length === 0) return []
    const menuPermissionIds = rmps.map((r) => r.menuPermissionId)
    const menuPermissions = await this.prisma.menuPermission.findMany({
      where: { id: { in: menuPermissionIds } },
    })
    const [menus, permissions] = await Promise.all([
      this.prisma.menu.findMany({ where: { id: { in: menuPermissions.map((mp) => mp.menuId) } } }),
      this.prisma.permission.findMany({
        where: { id: { in: menuPermissions.map((mp) => mp.permissionId) } },
      }),
    ])
    const menuCodeById = new Map(menus.map((m) => [m.id, m.code]))
    const permCodeById = new Map(permissions.map((p) => [p.id, p.code]))

    const byMenu = new Map<string, string[]>()
    for (const mp of menuPermissions) {
      const menuCode = menuCodeById.get(mp.menuId)
      const permCode = permCodeById.get(mp.permissionId)
      if (!menuCode || !permCode) continue
      const list = byMenu.get(menuCode) ?? []
      list.push(permCode)
      byMenu.set(menuCode, list)
    }
    return [...byMenu.entries()].map(([menuCode, permissions]) => ({ menuCode, permissions }))
  }

  /** Resolve (menuCode, permCode) grants to menu_permission ids. */
  private async resolveMenuPermissionIds(grants: RoleGrant[]): Promise<string[]> {
    const ids: string[] = []
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
        if (mp) ids.push(mp.id)
      }
    }
    return ids
  }

  async setGrants(roleId: string, grants: RoleGrant[]): Promise<void> {
    const wanted = new Set(await this.resolveMenuPermissionIds(grants))
    const existing = await this.prisma.roleMenuPermission.findMany({ where: { roleId } })
    const existingIds = new Set(existing.map((r) => r.menuPermissionId))

    for (const mpId of wanted) {
      if (!existingIds.has(mpId)) {
        await this.prisma.roleMenuPermission.create({ data: { roleId, menuPermissionId: mpId } })
      }
    }
    for (const rmp of existing) {
      if (!wanted.has(rmp.menuPermissionId)) {
        await this.prisma.roleMenuPermission.delete({ where: { id: rmp.id } })
      }
    }
  }

  withClient(tx: TransactionClient): IRoleRepository {
    return new RolePrismaRepository(tx)
  }
}
