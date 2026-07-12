import type { Types } from 'mongoose'
import type { TransactionClient } from '../../../core/database/transaction.js'
import { RoleModel } from '../../../core/database/models/role.model.js'
import type { IRoleRepository, RoleRecord, RoleGrant } from './role.repository.js'

interface LeanRole {
  _id: Types.ObjectId
  code: string
  name: string
  description?: string
  is_active: boolean
  menu_permissions?: { menu_code: string; permissions: string[] }[]
  created_at: Date
  updated_at: Date
}

function toRecord(r: LeanRole): RoleRecord {
  return {
    id: r._id.toString(),
    code: r.code,
    name: r.name,
    description: r.description ?? null,
    isActive: r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export class RoleMongoRepository implements IRoleRepository {
  async list(): Promise<RoleRecord[]> {
    const rows = await RoleModel.find().sort({ code: 1 }).lean<LeanRole[]>()
    return rows.map(toRecord)
  }

  async findById(id: string): Promise<RoleRecord | null> {
    const row = await RoleModel.findById(id).lean<LeanRole>()
    return row ? toRecord(row) : null
  }

  async findByCode(code: string): Promise<RoleRecord | null> {
    const row = await RoleModel.findOne({ code }).lean<LeanRole>()
    return row ? toRecord(row) : null
  }

  async create(data: { code: string; name: string; description?: string }): Promise<RoleRecord> {
    const created = await RoleModel.create({ ...data, menu_permissions: [] })
    return toRecord(created.toObject() as unknown as LeanRole)
  }

  async update(
    id: string,
    data: { name?: string; description?: string; isActive?: boolean }
  ): Promise<RoleRecord | null> {
    const set: Record<string, unknown> = {}
    if (data.name !== undefined) set.name = data.name
    if (data.description !== undefined) set.description = data.description
    if (data.isActive !== undefined) set.is_active = data.isActive
    const row = await RoleModel.findByIdAndUpdate(id, { $set: set }, { new: true }).lean<LeanRole>()
    return row ? toRecord(row) : null
  }

  async delete(id: string): Promise<void> {
    await RoleModel.findByIdAndDelete(id)
  }

  async getGrants(roleId: string): Promise<RoleGrant[]> {
    const role = await RoleModel.findById(roleId).lean<LeanRole>()
    if (!role) return []
    return (role.menu_permissions ?? []).map((mp) => ({
      menuCode: mp.menu_code,
      permissions: mp.permissions,
    }))
  }

  async setGrants(roleId: string, grants: RoleGrant[]): Promise<void> {
    await RoleModel.updateOne(
      { _id: roleId },
      {
        $set: {
          menu_permissions: grants.map((g) => ({ menu_code: g.menuCode, permissions: g.permissions })),
        },
      }
    )
  }

  withClient(_tx: TransactionClient): IRoleRepository {
    return this
  }
}
