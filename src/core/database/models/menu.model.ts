import mongoose, { type Document, type Model } from 'mongoose'

export interface IMenuDocument extends Document {
  code: string
  name: string
  icon?: string
  path?: string
  /** `code` of the parent menu (self-referencing tree), null for top-level. */
  parentCode?: string | null
  orderIndex: number
  isActive: boolean
  /** Catalog of permission codes this menu supports (mirrors relational menu_permissions). */
  permissions: string[]
  createdAt: Date
  updatedAt: Date
}

const menuSchema = new mongoose.Schema<IMenuDocument>(
  {
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true },
    icon: { type: String },
    path: { type: String },
    parentCode: { type: String, default: null },
    orderIndex: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    permissions: { type: [String], default: [] },
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

export const MenuModel: Model<IMenuDocument> = mongoose.model<IMenuDocument>('Menu', menuSchema)
