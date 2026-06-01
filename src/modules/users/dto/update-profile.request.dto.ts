import { z } from 'zod'

export const updateProfileRequestSchema = z
  .object({
    username: z
      .string()
      .min(3, 'Username must be at least 3 characters')
      .max(30, 'Username must not exceed 30 characters')
      .regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers, and underscores')
      .optional(),
    email: z.string().email('Invalid email address').optional(),
  })
  .refine((data) => data.username !== undefined || data.email !== undefined, {
    message: 'At least one field (username or email) must be provided',
  })

export type UpdateProfileDto = z.infer<typeof updateProfileRequestSchema>

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
