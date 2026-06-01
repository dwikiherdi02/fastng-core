export interface SuccessResponse<T> {
  success: true
  data: T
  meta?: Record<string, unknown>
}

export interface ErrorResponse {
  success: false
  message: string
}

export function successResponse<T>(data: T, meta?: Record<string, unknown>): SuccessResponse<T> {
  const response: SuccessResponse<T> = { success: true, data }
  if (meta) response.meta = meta
  return response
}

export function errorResponse(message: string): ErrorResponse {
  return { success: false, message }
}
