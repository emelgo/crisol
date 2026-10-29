import { campaignActions } from './campaigns.ts'
import { organizationActions } from './organizations.ts'
import type { Implementation } from './registry.ts'
import { worldActions } from './worlds.ts'

/** Los servicios de todas las acciones del contrato: los usan la API y el MCP */
export const IMPLEMENTATIONS: Implementation[] = [...organizationActions, ...worldActions, ...campaignActions]

export const implementationsByName = new Map(IMPLEMENTATIONS.map((impl) => [impl.action.name, impl]))
