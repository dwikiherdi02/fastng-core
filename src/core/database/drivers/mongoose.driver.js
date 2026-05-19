import mongoose from 'mongoose'
import env from '../../config/env.config.js'

export async function connectMongoose() {
  await mongoose.connect(env.MONGODB_URI)
}

export async function disconnectMongoose() {
  await mongoose.disconnect()
}
