import type { PrismaClient } from '@prisma/client'
import env from '../../../core/config/env.config.js'
import { MenuPrismaRepository } from './menu.prisma.repository.js'
import { MenuMongoRepository } from './menu.mongo.repository.js'

export interface MenuPermissionCatalog {
  code: string
  name: string
  description: string | null
}

export interface MenuCatalogItem {
  code: string
  name: string
  icon: string | null
  path: string | null
  parentCode: string | null
  orderIndex: number
  permissions: MenuPermissionCatalog[]
}

export interface IMenuRepository {
  /** Full menu × permission catalog (drives the admin permission checklist). */
  listCatalog(): Promise<MenuCatalogItem[]>
}

export function createMenuRepository(prisma: PrismaClient | null): IMenuRepository {
  if (env.DB_DRIVER === 'mongodb') {
    return new MenuMongoRepository()
  }
  return new MenuPrismaRepository(prisma!)
}
