import type { IMenuRepository, MenuCatalogItem } from '../repositories/menu.repository.js'

export class MenuService {
  constructor(private repository: IMenuRepository) {}

  listCatalog(): Promise<MenuCatalogItem[]> {
    return this.repository.listCatalog()
  }
}
