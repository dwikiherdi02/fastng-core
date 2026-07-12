import type { PrismaClient } from '@prisma/client'
import type { IPermissionRepository, PermissionRecord } from './permission.repository.js'

export class PermissionPrismaRepository implements IPermissionRepository {
  constructor(private prisma: PrismaClient) {}

  async list(): Promise<PermissionRecord[]> {
    const rows = await this.prisma.permission.findMany({ orderBy: { code: 'asc' } })
    return rows.map((p) => ({ id: p.id, code: p.code, name: p.name, description: p.description }))
  }
}
