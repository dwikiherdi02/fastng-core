import mongoose, { type Document, type Model } from 'mongoose'

/** A role's grant: for a menu (by code), which permission codes it holds. */
export interface IRoleMenuPermission {
  menu_code: string
  permissions: string[]
}

export interface IRoleDocument extends Document {
  code: string
  name: string
  description?: string
  is_active: boolean
  menu_permissions: IRoleMenuPermission[]
  created_at: Date
  updated_at: Date
}

const roleSchema = new mongoose.Schema<IRoleDocument>(
  {
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true },
    description: { type: String },
    is_active: { type: Boolean, default: true },
    menu_permissions: [
      {
        _id: false,
        menu_code: { type: String, required: true },
        permissions: { type: [String], default: [] },
      },
    ],
  },
  {
    collection: 'roles',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
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
