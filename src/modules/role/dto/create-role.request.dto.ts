import { z } from 'zod'

export const createRoleSchema = z.object({
  code: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9_]+$/, 'code must be lowercase letters, numbers, or underscores'),
  name: z.string().min(2).max(100),
  description: z.string().max(255).optional(),
})

export type CreateRoleDto = z.infer<typeof createRoleSchema>

export const createRoleRouteSchema = {
  tags: ['Roles'],
  summary: 'Create a role',
  security: [{ BearerAuth: [] }],
  body: {
    type: 'object',
    required: ['code', 'name'],
    properties: {
      code: { type: 'string' },
      name: { type: 'string' },
      description: { type: 'string' },
    },
  },
}
