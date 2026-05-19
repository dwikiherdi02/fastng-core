/**
 * @param {unknown} data
 * @param {Record<string, unknown>} [meta]
 */
export function successResponse(data, meta) {
  const response = { success: true, data }
  if (meta) response.meta = meta
  return response
}

/**
 * @param {string} message
 */
export function errorResponse(message) {
  return { success: false, message }
}
