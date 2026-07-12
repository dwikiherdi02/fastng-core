import mongoose, { type Document, type Model, type Types } from 'mongoose'

/** User-level permission override (allow/deny) keyed by menu + permission code. */
export interface IUserPermissionOverride {
  menu_code: string
  permission_code: string
  effect: 'allow' | 'deny'
}

export interface IUserDocument extends Document {
  username: string
  email: string
  password: string
  is_active: boolean
  role_ids: Types.ObjectId[]
  permission_overrides: IUserPermissionOverride[]
  created_at: Date
  updated_at: Date
}

const userSchema = new mongoose.Schema<IUserDocument>(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    is_active: { type: Boolean, default: true },
    role_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Role' }],
    permission_overrides: [
      {
        _id: false,
        menu_code: { type: String, required: true },
        permission_code: { type: String, required: true },
        effect: { type: String, enum: ['allow', 'deny'], default: 'allow' },
      },
    ],
  },
  {
    collection: 'users',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: {
      virtuals: true,
      transform(_doc: Document, ret: Record<string, unknown>) {
        ret.id = (ret._id as { toString(): string }).toString()
        delete ret._id
        delete ret.__v
        delete ret.password
        return ret
      },
    },
  }
)

export const UserModel: Model<IUserDocument> = mongoose.model<IUserDocument>('User', userSchema)
