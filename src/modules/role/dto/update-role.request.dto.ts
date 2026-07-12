import { z } from 'zod'

export const updateRoleSchema = z
  .object({
    name: z.string().min(2).max(100).optional(),
    description: z.string().max(255).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: 'At least one field must be provided',
  })

export type UpdateRoleDto = z.infer<typeof updateRoleSchema>

export const updateRoleRouteSchema = {
  tags: ['Roles'],
  summary: 'Update a role',
  security: [{ BearerAuth: [] }],
  params: { type: 'object', properties: { id: { type: 'string' } } },
  body: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      isActive: { type: 'boolean' },
    },
  },
}
