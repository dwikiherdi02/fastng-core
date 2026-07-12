import type { PrismaClient } from '@prisma/client'
import env from '../../../core/config/env.config.js'
import { PermissionPrismaRepository } from './permission.prisma.repository.js'
import { PermissionMongoRepository } from './permission.mongo.repository.js'

export interface PermissionRecord {
  id: string
  code: string
  name: string
  description: string | null
}

export interface IPermissionRepository {
  list(): Promise<PermissionRecord[]>
}

export function createPermissionRepository(prisma: PrismaClient | null): IPermissionRepository {
  if (env.DB_DRIVER === 'mongodb') {
    return new PermissionMongoRepository()
  }
  return new PermissionPrismaRepository(prisma!)
}
