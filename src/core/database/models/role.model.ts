import mongoose, { type Document, type Model } from 'mongoose'

/** A role's actual grant: for a menu (by code), which permission codes it holds. */
export interface IRoleMenuPermission {
  menuCode: string
  permissions: string[]
}

export interface IRoleDocument extends Document {
  code: string
  name: string
  description?: string
  isActive: boolean
  /** Permissions embedded per role (concept §4.3) — rarely changes, always read together. */
  menuPermissions: IRoleMenuPermission[]
  createdAt: Date
  updatedAt: Date
}

const roleSchema = new mongoose.Schema<IRoleDocument>(
  {
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true },
    description: { type: String },
    isActive: { type: Boolean, default: true },
    menuPermissions: [
      {
        _id: false,
        menuCode: { type: String, required: true },
        permissions: { type: [String], default: [] },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc: Document, ret: Record<string, unknown>) {
        ret.id = (ret._id as { toString(): string }).toString()
        delete ret._id
        delete ret.__v
        return ret
      },
    },
  }
)

export const RoleModel: Model<IRoleDocument> = mongoose.model<IRoleDocument>('Role', roleSchema)
