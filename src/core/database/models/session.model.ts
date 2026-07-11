import mongoose, { type Document, type Model, type Types } from 'mongoose'

export interface ISessionDocument extends Document {
  userId: Types.ObjectId
  refreshTokenHash: string
  accessTokenJti: string
  deviceInfo?: string
  ipAddress?: string
  isRevoked: boolean
  expiresAt: Date
  createdAt: Date
  lastUsedAt: Date
}

const sessionSchema = new mongoose.Schema<ISessionDocument>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    refreshTokenHash: { type: String, required: true, unique: true },
    accessTokenJti: { type: String, required: true },
    deviceInfo: { type: String },
    ipAddress: { type: String },
    isRevoked: { type: Boolean, default: false },
    expiresAt: { type: Date, required: true },
    lastUsedAt: { type: Date, default: () => new Date() },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
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

sessionSchema.index({ userId: 1 })
// Auto-remove expired sessions (Mongo TTL monitor).
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const SessionModel: Model<ISessionDocument> = mongoose.model<ISessionDocument>(
  'Session',
  sessionSchema
)
