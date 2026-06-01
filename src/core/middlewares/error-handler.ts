import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify'
import { AppError } from '../utils/errors.js'
import { errorResponse } from '../utils/response.js'

export default function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  if (error.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER' || error.statusCode === 401) {
    reply.code(401).send(errorResponse('Unauthorized'))
    return
  }

  if (error.validation) {
    reply.code(422).send(errorResponse(error.message))
    return
  }

  if (error instanceof AppError) {
    reply.code(error.statusCode).send(errorResponse(error.message))
    return
  }

  if (error.statusCode && error.statusCode < 500) {
    reply.code(error.statusCode).send(errorResponse(error.message))
    return
  }

  request.log.error(error)
  reply.code(500).send(errorResponse('Internal server error'))
}
