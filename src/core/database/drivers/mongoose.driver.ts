import mongoose from 'mongoose'
import env from '../../config/env.config.js'

export async function connectMongoose(): Promise<void> {
  await mongoose.connect(env.MONGODB_URI!)
}

export async function disconnectMongoose(): Promise<void> {
  await mongoose.disconnect()
}
