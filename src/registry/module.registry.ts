export interface ModuleConfig {
  name: string
  enabled: boolean
  path: string
  dependsOn: string[]
}

const modules: ModuleConfig[] = [
  {
    name: 'auth',
    enabled: true,
    path: '../modules/auth/module.js',
    dependsOn: [],
  },
  {
    name: 'users',
    enabled: true,
    path: '../modules/users/module.js',
    dependsOn: ['auth'],
  },
  {
    name: 'welcome',
    enabled: true,
    path: '../modules/welcome/module.js',
    dependsOn: ['auth'],
  },
]

export default modules
