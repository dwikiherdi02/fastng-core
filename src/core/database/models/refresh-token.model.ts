import mongoose, { type Document, type Model, type Types } from 'mongoose'

export interface IRefreshTokenDocument extends Document {
  token: string
  userId: Types.ObjectId
  expiresAt: Date
  createdAt: Date
}

const refreshTokenSchema = new mongoose.Schema<IRefreshTokenDocument>(
  {
    token: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
)

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const RefreshTokenModel: Model<IRefreshTokenDocument> =
  mongoose.model<IRefreshTokenDocument>('RefreshToken', refreshTokenSchema)
