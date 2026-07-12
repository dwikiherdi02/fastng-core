import { MenuModel } from '../../../core/database/models/menu.model.js'
import { PermissionModel } from '../../../core/database/models/permission.model.js'
import type { IMenuRepository, MenuCatalogItem } from './menu.repository.js'

export class MenuMongoRepository implements IMenuRepository {
  async listCatalog(): Promise<MenuCatalogItem[]> {
    const [menus, permissions] = await Promise.all([
      MenuModel.find().sort({ order_index: 1 }).lean(),
      PermissionModel.find().lean(),
    ])
    const permByCode = new Map(permissions.map((p) => [p.code, p]))
    return menus.map((m) => ({
      code: m.code,
      name: m.name,
      icon: m.icon ?? null,
      path: m.path ?? null,
      parentCode: m.parent_code ?? null,
      orderIndex: m.order_index,
      permissions: (m.permissions ?? []).map((code) => {
        const perm = permByCode.get(code)
        return { code, name: perm?.name ?? code, description: perm?.description ?? null }
      }),
    }))
  }
}
