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
  async upsertPermission(code: string, name: string): Promise<void> {
    await PermissionModel.updateOne({ code }, { $set: { code, name } }, { upsert: true })
  }

  async upsertMenu(menu: MenuInput): Promise<void> {
    for (const code of menu.permissions) {
      await this.upsertPermission(code, humanizePermission(code))
    }
    await MenuModel.updateOne(
      { code: menu.code },
      {
        $set: {
          code: menu.code,
          name: menu.name,
          icon: menu.icon,
          path: menu.path,
          parentCode: menu.parentCode ?? null,
          orderIndex: menu.orderIndex,
          isActive: true,
          permissions: menu.permissions,
        },
      },
      { upsert: true }
    )
  }

  async removeMenu(code: string): Promise<void> {
    await MenuModel.deleteOne({ code })
    // Bidirectional teardown: pull any embedded grants referencing this menu.
    await RoleModel.updateMany({}, { $pull: { menuPermissions: { menuCode: code } } })
  }

  async listMenusWithPermissions(): Promise<MenuWithPermissions[]> {
    const menus = await MenuModel.find().lean()
    return menus.map((m) => ({ code: m.code, permissions: m.permissions ?? [] }))
  }

  async upsertRole(code: string, name: string, description?: string): Promise<void> {
    await RoleModel.updateOne(
      { code },
      { $set: { code, name, description }, $setOnInsert: { menuPermissions: [] } },
      { upsert: true }
    )
  }

  async setRoleGrants(roleCode: string, grants: RoleGrant[]): Promise<void> {
    const result = await RoleModel.updateOne({ code: roleCode }, { $set: { menuPermissions: grants } })
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
      { $set: { username: data.username, password: data.passwordHash, roleIds } },
      { upsert: true }
    )
  }
}
