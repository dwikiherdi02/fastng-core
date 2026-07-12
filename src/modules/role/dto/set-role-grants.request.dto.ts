import { z } from 'zod'

export const setRoleGrantsSchema = z.object({
  grants: z.array(
    z.object({
      menuCode: z.string(),
      permissions: z.array(z.string()),
    })
  ),
})

export type SetRoleGrantsDto = z.infer<typeof setRoleGrantsSchema>

export const setRoleGrantsRouteSchema = {
  tags: ['Roles'],
  summary: 'Replace a role permission grants (role-level checklist)',
  security: [{ BearerAuth: [] }],
  params: { type: 'object', properties: { id: { type: 'string' } } },
  body: {
    type: 'object',
    required: ['grants'],
    properties: {
      grants: {
        type: 'array',
        items: {
          type: 'object',
          required: ['menuCode', 'permissions'],
          properties: {
            menuCode: { type: 'string' },
            permissions: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  },
}
