import fp from 'fastify-plugin'
import { connectDb, disconnectDb, getDbClient } from '../database/index.js'
import env from '../config/env.config.js'

async function dbPlugin(fastify) {
  await connectDb()

  // Decorate with prisma client (null for mongodb — use models directly)
  fastify.decorate('db', getDbClient())
  fastify.decorate('dbDriver', env.DB_DRIVER)

  fastify.addHook('onClose', async () => {
    await disconnectDb()
  })
}

export default fp(dbPlugin, { name: 'db-plugin' })
