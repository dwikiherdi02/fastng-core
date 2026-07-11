import mongoose, { type Document, type Model, type Types } from 'mongoose'

export interface IUserDocument extends Document {
  username: string
  email: string
  password: string
  isActive: boolean
  roleIds: Types.ObjectId[]
  createdAt: Date
  updatedAt: Date
}

const userSchema = new mongoose.Schema<IUserDocument>(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    roleIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Role' }],
  },
  {
    timestamps: true,
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
