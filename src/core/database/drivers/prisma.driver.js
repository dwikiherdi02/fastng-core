import { PrismaClient } from '@prisma/client'

let prismaInstance

export function getPrismaClient() {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient()
  }
  return prismaInstance
}

export async function disconnectPrisma() {
  if (prismaInstance) {
    await prismaInstance.$disconnect()
    prismaInstance = undefined
  }
}
