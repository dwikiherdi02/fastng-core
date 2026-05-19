import { z } from 'zod'

export const updateProfileRequestSchema = z
  .object({
    username: z
      .string()
      .min(3)
      .max(30)
      .regex(/^[a-zA-Z0-9_]+$/)
      .optional(),
    email: z.string().email().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field (username or email) must be provided',
  })

export const updateProfileRouteSchema = {
  tags: ['Users'],
  summary: 'Update own profile',
  security: [{ BearerAuth: [] }],
  body: {
    type: 'object',
    properties: {
      username: { type: 'string', minLength: 3, maxLength: 30 },
      email: { type: 'string', format: 'email' },
    },
  },
}
