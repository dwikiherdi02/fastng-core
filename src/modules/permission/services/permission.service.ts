import type {
  IPermissionRepository,
  PermissionRecord,
} from '../repositories/permission.repository.js'

export class PermissionService {
  constructor(private repository: IPermissionRepository) {}

  list(): Promise<PermissionRecord[]> {
    return this.repository.list()
  }
}
