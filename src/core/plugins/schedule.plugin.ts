import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import fastifySchedule from '@fastify/schedule'
import env from '../config/env.config.js'

const schedulePlugin: FastifyPluginAsync = async (fastify) => {
  if (!env.SCHEDULER_ENABLED) {
    fastify.log.info('Scheduler is disabled via environment variable')
    return
  }

  await fastify.register(fastifySchedule)

  fastify.log.info('Scheduler plugin registered successfully')
}

export default fp(schedulePlugin, { name: 'schedule-plugin' })
