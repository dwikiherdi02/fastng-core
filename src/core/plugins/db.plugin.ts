import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import { connectDb, disconnectDb, getDbClient } from '../database/index.js'
import env from '../config/env.config.js'

const dbPlugin: FastifyPluginAsync = async (fastify) => {
  await connectDb()
  fastify.decorate('db', getDbClient())
  fastify.decorate('dbDriver', env.DB_DRIVER)
  fastify.addHook('onClose', async () => {
    await disconnectDb()
  })
}

export default fp(dbPlugin, { name: 'db-plugin' })
