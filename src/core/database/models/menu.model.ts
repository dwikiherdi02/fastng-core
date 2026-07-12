import mongoose, { type Document, type Model } from 'mongoose'

export interface IMenuDocument extends Document {
  code: string
  name: string
  icon?: string
  path?: string
  /** `code` of the parent menu (self-referencing tree), null for top-level. */
  parent_code?: string | null
  order_index: number
  is_active: boolean
  /** Catalog of permission codes this menu supports (mirrors relational menu_permissions). */
  permissions: string[]
  created_at: Date
  updated_at: Date
}

const menuSchema = new mongoose.Schema<IMenuDocument>(
  {
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true },
    icon: { type: String },
    path: { type: String },
    parent_code: { type: String, default: null },
    order_index: { type: Number, default: 0 },
    is_active: { type: Boolean, default: true },
    permissions: { type: [String], default: [] },
  },
  {
    collection: 'menus',
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

export const MenuModel: Model<IMenuDocument> = mongoose.model<IMenuDocument>('Menu', menuSchema)
