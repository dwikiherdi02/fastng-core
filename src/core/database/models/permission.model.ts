import mongoose, { type Document, type Model } from 'mongoose'

/** Global permission catalog (dynamic). Adding a permission is just one document. */
export interface IPermissionDocument extends Document {
  code: string
  name: string
  description?: string
  created_at: Date
}

const permissionSchema = new mongoose.Schema<IPermissionDocument>(
  {
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true },
    description: { type: String },
  },
  {
    collection: 'permissions',
    timestamps: { createdAt: 'created_at', updatedAt: false },
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

export const PermissionModel: Model<IPermissionDocument> = mongoose.model<IPermissionDocument>(
  'Permission',
  permissionSchema
)
