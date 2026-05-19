import env from '../config/env.config.js'
import { getPrismaClient, disconnectPrisma } from './drivers/prisma.driver.js'
import { connectMongoose, disconnectMongoose } from './drivers/mongoose.driver.js'

export async function connectDb() {
  if (env.DB_DRIVER === 'mongodb') {
    await connectMongoose()
  } else {
    // Prisma connects lazily; call $connect to verify the connection at boot
    await getPrismaClient().$connect()
  }
}

export async function disconnectDb() {
  if (env.DB_DRIVER === 'mongodb') {
    await disconnectMongoose()
  } else {
    await disconnectPrisma()
  }
}

/**
 * Returns the active DB client.
 * For Prisma drivers: PrismaClient instance.
 * For MongoDB: mongoose (connection managed globally via models).
 */
export function getDbClient() {
  if (env.DB_DRIVER === 'mongodb') {
    return null // Mongoose models are used directly
  }
  return getPrismaClient()
}
