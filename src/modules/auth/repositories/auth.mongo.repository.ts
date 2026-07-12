import type { Types } from 'mongoose'
import type { TransactionClient } from '../../../core/database/transaction.js'
import { UserModel } from '../../../core/database/models/user.model.js'
import { RoleModel } from '../../../core/database/models/role.model.js'
import { AuthEntity } from '../entities/auth.entity.js'
import type { IAuthRepository, UserPermissionOverride } from './auth.repository.js'

interface LeanUserDoc {
  _id: Types.ObjectId
  username: string
  email: string
  password: string
  is_active: boolean
  role_ids: Types.ObjectId[]
  permission_overrides?: { menu_code: string; permission_code: string; effect: 'allow' | 'deny' }[]
  created_at: Date
}

async function roleCodesFor(roleIds: Types.ObjectId[]): Promise<string[]> {
  if (!roleIds?.length) return []
  const roles = await RoleModel.find({ _id: { $in: roleIds } })
    .select('code')
    .lean()
  return roles.map((r) => r.code)
}

async function toEntity(doc: LeanUserDoc): Promise<AuthEntity> {
  return new AuthEntity({
    id: doc._id.toString(),
    username: doc.username,
    email: doc.email,
    roles: await roleCodesFor(doc.role_ids),
    isActive: doc.is_active,
    createdAt: doc.created_at,
  })
}

export class AuthMongoRepository implements IAuthRepository {
  async findByEmail(email: string): Promise<{ entity: AuthEntity; passwordHash: string } | null> {
    const doc = await UserModel.findOne({ email }).select('+password').lean<LeanUserDoc>()
    if (!doc) return null
    return { entity: await toEntity(doc), passwordHash: doc.password }
  }

  async findById(id: string): Promise<AuthEntity | null> {
    const doc = await UserModel.findById(id).lean<LeanUserDoc>()
    return doc ? toEntity(doc) : null
  }

  async createUser(data: {
    username: string
    email: string
    passwordHash: string
  }): Promise<AuthEntity> {
    const defaultRole = await RoleModel.findOne({ code: 'user' }).select('_id').lean()
    const created = await UserModel.create({
      username: data.username,
      email: data.email,
      password: data.passwordHash,
      role_ids: defaultRole ? [defaultRole._id] : [],
    })
    return new AuthEntity({
      id: (created._id as Types.ObjectId).toString(),
      username: created.username,
      email: created.email,
      roles: defaultRole ? ['user'] : [],
      isActive: created.is_active,
      createdAt: created.created_at,
    })
  }

  async getUserRoleCodes(userId: string): Promise<string[]> {
    const doc = await UserModel.findById(userId).select('role_ids').lean<LeanUserDoc>()
    return doc ? roleCodesFor(doc.role_ids) : []
  }

  async setUserRoles(userId: string, roleCodes: string[]): Promise<void> {
    const roles = await RoleModel.find({ code: { $in: roleCodes } })
      .select('_id')
      .lean()
    await UserModel.updateOne({ _id: userId }, { $set: { role_ids: roles.map((r) => r._id) } })
  }

  async getUserPermissionOverrides(userId: string): Promise<UserPermissionOverride[]> {
    const doc = await UserModel.findById(userId).select('permission_overrides').lean<LeanUserDoc>()
    return (doc?.permission_overrides ?? []).map((o) => ({
      menuCode: o.menu_code,
      permissionCode: o.permission_code,
      effect: o.effect,
    }))
  }

  async setUserPermissionOverrides(
    userId: string,
    overrides: UserPermissionOverride[]
  ): Promise<void> {
    await UserModel.updateOne(
      { _id: userId },
      {
        $set: {
          permission_overrides: overrides.map((o) => ({
            menu_code: o.menuCode,
            permission_code: o.permissionCode,
            effect: o.effect,
          })),
        },
      }
    )
  }

  withClient(_tx: TransactionClient): IAuthRepository {
    return this
  }
}
