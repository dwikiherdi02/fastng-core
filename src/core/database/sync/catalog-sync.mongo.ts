import {
  type ICatalogSyncRepository,
  type MenuInput,
  type MenuWithPermissions,
  type RoleGrant,
  humanizePermission,
} from './catalog-sync.repository.js'
import { MenuModel } from '../models/menu.model.js'
import { PermissionModel } from '../models/permission.model.js'
import { RoleModel } from '../models/role.model.js'
import { UserModel } from '../models/user.model.js'

export class CatalogSyncMongoRepository implements ICatalogSyncRepository {
  async upsertPermission(code: string, name: string, description: string | null): Promise<void> {
    await PermissionModel.updateOne({ code }, { $set: { code, name, description } }, { upsert: true })
  }

  async upsertMenu(menu: MenuInput): Promise<void> {
    for (const perm of menu.permissions) {
      await this.upsertPermission(perm.code, perm.name ?? humanizePermission(perm.code), perm.description)
    }
    await MenuModel.updateOne(
      { code: menu.code },
      {
        $set: {
          code: menu.code,
          name: menu.name,
          icon: menu.icon,
          path: menu.path,
          parent_code: menu.parentCode ?? null,
          order_index: menu.orderIndex,
          is_active: true,
          permissions: menu.permissions.map((p) => p.code),
        },
      },
      { upsert: true }
    )
  }

  async removeMenu(code: string): Promise<void> {
    await MenuModel.deleteOne({ code })
    await RoleModel.updateMany({}, { $pull: { menu_permissions: { menu_code: code } } })
    await UserModel.updateMany({}, { $pull: { permission_overrides: { menu_code: code } } })
  }

  async listMenusWithPermissions(): Promise<MenuWithPermissions[]> {
    const menus = await MenuModel.find().lean()
    return menus.map((m) => ({ code: m.code, permissions: m.permissions ?? [] }))
  }

  async upsertRole(code: string, name: string, description?: string): Promise<void> {
    await RoleModel.updateOne(
      { code },
      { $set: { code, name, description }, $setOnInsert: { menu_permissions: [] } },
      { upsert: true }
    )
  }

  async setRoleGrants(roleCode: string, grants: RoleGrant[]): Promise<void> {
    const result = await RoleModel.updateOne(
      { code: roleCode },
      {
        $set: {
          menu_permissions: grants.map((g) => ({ menu_code: g.menuCode, permissions: g.permissions })),
        },
      }
    )
    if (result.matchedCount === 0) throw new Error(`Cannot set grants: role "${roleCode}" not found.`)
  }

  async upsertUserWithRoles(
    data: { username: string; email: string; passwordHash: string },
    roleCodes: string[]
  ): Promise<void> {
    const roles = await RoleModel.find({ code: { $in: roleCodes } })
      .select('_id')
      .lean()
    const roleIds = roles.map((r) => r._id)
    await UserModel.updateOne(
      { email: data.email },
      { $set: { username: data.username, password: data.passwordHash, role_ids: roleIds } },
      { upsert: true }
    )
  }
}
