import { PermissionModel } from '../../../core/database/models/permission.model.js'
import type { IPermissionRepository, PermissionRecord } from './permission.repository.js'

export class PermissionMongoRepository implements IPermissionRepository {
  async list(): Promise<PermissionRecord[]> {
    const rows = await PermissionModel.find().sort({ code: 1 }).lean()
    return rows.map((p) => ({
      id: p._id.toString(),
      code: p.code,
      name: p.name,
      description: p.description ?? null,
    }))
  }
}
