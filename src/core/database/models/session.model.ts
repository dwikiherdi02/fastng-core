import mongoose, { type Document, type Model, type Types } from 'mongoose'

export interface ISessionDocument extends Document {
  user_id: Types.ObjectId
  refresh_token_hash: string
  access_token_jti: string
  device_info?: string
  ip_address?: string
  is_revoked: boolean
  expires_at: Date
  created_at: Date
  last_used_at: Date
}

const sessionSchema = new mongoose.Schema<ISessionDocument>(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    refresh_token_hash: { type: String, required: true, unique: true },
    access_token_jti: { type: String, required: true },
    device_info: { type: String },
    ip_address: { type: String },
    is_revoked: { type: Boolean, default: false },
    expires_at: { type: Date, required: true },
    last_used_at: { type: Date, default: () => new Date() },
  },
  {
    collection: 'sessions',
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

sessionSchema.index({ user_id: 1 })
sessionSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 })

export const SessionModel: Model<ISessionDocument> = mongoose.model<ISessionDocument>(
  'Session',
  sessionSchema
)
