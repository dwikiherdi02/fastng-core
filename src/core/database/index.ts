import type { PrismaClient } from '@prisma/client'
import env from '../config/env.config.js'
import { getPrismaClient, disconnectPrisma } from './drivers/prisma.driver.js'
import { connectMongoose, disconnectMongoose } from './drivers/mongoose.driver.js'

export async function connectDb(): Promise<void> {
  if (env.DB_DRIVER === 'mongodb') {
    await connectMongoose()
  } else {
    await getPrismaClient().$connect()
  }
}

export async function disconnectDb(): Promise<void> {
  if (env.DB_DRIVER === 'mongodb') {
    await disconnectMongoose()
  } else {
    await disconnectPrisma()
  }
}

export function getDbClient(): PrismaClient | null {
  if (env.DB_DRIVER === 'mongodb') {
    return null
  }
  return getPrismaClient()
}
