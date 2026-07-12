import { NotFoundError, ConflictError } from '../../../core/utils/errors.js'
import type { IRoleRepository, RoleRecord, RoleGrant } from '../repositories/role.repository.js'

export class RoleService {
  constructor(private repository: IRoleRepository) {}

  list(): Promise<RoleRecord[]> {
    return this.repository.list()
  }

  async getById(id: string): Promise<RoleRecord> {
    const role = await this.repository.findById(id)
    if (!role) throw new NotFoundError('Role not found')
    return role
  }

  async create(data: { code: string; name: string; description?: string }): Promise<RoleRecord> {
    const existing = await this.repository.findByCode(data.code)
    if (existing) throw new ConflictError(`Role "${data.code}" already exists`)
    return this.repository.create(data)
  }

  async update(
    id: string,
    data: { name?: string; description?: string; isActive?: boolean }
  ): Promise<RoleRecord> {
    const updated = await this.repository.update(id, data)
    if (!updated) throw new NotFoundError('Role not found')
    return updated
  }

  async delete(id: string): Promise<void> {
    await this.getById(id)
    await this.repository.delete(id)
  }

  async getGrants(id: string): Promise<RoleGrant[]> {
    await this.getById(id)
    return this.repository.getGrants(id)
  }

  async setGrants(id: string, grants: RoleGrant[]): Promise<RoleGrant[]> {
    await this.getById(id)
    await this.repository.setGrants(id, grants)
    return this.repository.getGrants(id)
  }
}
