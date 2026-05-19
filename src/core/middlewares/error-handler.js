import { AppError } from '../utils/errors.js'
import { errorResponse } from '../utils/response.js'

export default function errorHandler(error, request, reply) {
  // JWT errors
  if (error.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER' || error.statusCode === 401) {
    return reply.code(401).send(errorResponse('Unauthorized'))
  }

  // Fastify validation error (JSON Schema)
  if (error.validation) {
    return reply.code(422).send(errorResponse(error.message))
  }

  // Typed domain errors
  if (error instanceof AppError) {
    return reply.code(error.statusCode).send(errorResponse(error.message))
  }

  // Fastify HTTP errors (@fastify/sensible)
  if (error.statusCode && error.statusCode < 500) {
    return reply.code(error.statusCode).send(errorResponse(error.message))
  }

  // Unexpected server error
  request.log.error(error)
  return reply.code(500).send(errorResponse('Internal server error'))
}
