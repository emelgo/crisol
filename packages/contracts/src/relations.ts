/**
 * Las relaciones del mundo (módulo 10, docs/specs/modulo-10.md): salen de los campos de enlace de las páginas y de los
 * enlaces de su texto («menciona»). Se calculan en el servidor con lo que ve quien las pide (ADR-0017)
 */
import { z } from 'zod'
import { defineAction } from './action.ts'
import { relationRole, templateRef } from './pages.ts'
import { readAs } from './read-as.ts'

/** Una página del grafo */
export const relationNode = z.object({
  id: z.uuid(),
  title: z.string(),
  icon: z.string().nullable(),
  template: templateRef.nullable().describe('La plantilla de la que salió: el color del nodo'),
  subtitle: z.string().optional().describe('Bajo el nombre en las tarjetas: su primer campo de texto con algo escrito'),
  generation: z
    .number()
    .int()
    .optional()
    .describe('En el árbol genealógico: su generación respecto a la página (-1 sus padres, 1 sus hijos)')
})

export type RelationNode = z.infer<typeof relationNode>

/** La clave de una relación: «mention», la de su campo (field:<id>, o name:<nombre> sin id) o la de un árbol (tree:<tipo>) */
export const relationKey = z.string().min(1).max(80)

/** Una arista: de la página source a la target, por un campo suyo o por enlazarla en su texto */
export const relationEdge = z.object({
  source: z.uuid(),
  target: z.uuid(),
  kind: z
    .enum(['field', 'mention', 'tree'])
    .describe(
      'field: un campo de enlace de source; mention: source la enlaza en su texto; tree: una línea de un árbol genealógico u organigrama'
    ),
  key: relationKey,
  name: z.string().describe('El nombre del campo (vacío en mention)'),
  inverseName: z.string().optional().describe('Cómo se lee desde target'),
  role: relationRole.optional(),
  secret: z
    .literal(true)
    .optional()
    .describe('Solo el máster: sale de un secreto o de una nota oculta (trazo discontinuo)')
})

export type RelationEdge = z.infer<typeof relationEdge>

export const RELATION_MODES = ['links', 'family', 'org'] as const
export const relationMode = z.enum(RELATION_MODES)
export type RelationMode = z.infer<typeof relationMode>

export const getRelations = defineAction({
  name: 'getRelations',
  kind: 'read',
  description:
    'Las relaciones de una página: con quién se relaciona por sus campos de enlace, por los enlaces de su texto (menciona) y por los árboles genealógicos en los que está, en ambos sentidos. mode links: el vecindario hasta depth saltos; family: el árbol genealógico (campos con papel parent o partner, ±3 generaciones); org: el organigrama de su grupo (papel member-of y leads; desde un miembro, el de su grupo). modes dice cuáles tiene',
  input: z.object({
    pageId: z.uuid(),
    depth: z.number().int().min(1).max(3).default(1).describe('Con mode links: cuántos saltos (1 a 3)'),
    mode: relationMode.default('links'),
    fieldsOnly: z.boolean().optional().describe('Solo los campos, sin «menciona»'),
    ...readAs
  }),
  output: z.object({
    pageId: z.uuid(),
    mode: relationMode,
    modes: z.array(relationMode).describe('Los modos que tiene: links si tiene alguna relación'),
    nodes: z.array(relationNode),
    edges: z.array(relationEdge),
    groups: z.array(z.uuid()).describe('Con mode org: los grupos del organigrama'),
    truncated: z.boolean().describe('Había más: se cortó en las 500 páginas más cercanas')
  })
})

export const getWorldGraph = defineAction({
  name: 'getWorldGraph',
  kind: 'read',
  description:
    'El grafo de relaciones de todo el mundo: las páginas y sus relaciones (campos de enlace, menciones del texto y líneas de los árboles genealógicos), con filtros por plantilla, por relación (relations: «mention», la key de un campo o tree:parent, tree:partner, tree:member, tree:leads) y por etiqueta. Las páginas sin relaciones, solo con orphans. relations lista cada relación que hay, con cuántas aristas',
  input: z.object({
    worldId: z.uuid(),
    templates: z
      .array(z.string().trim().min(1).max(200))
      .max(50)
      .optional()
      .describe('Solo páginas de estas plantillas (o de sus copias): su id o su nombre'),
    relations: z
      .array(relationKey)
      .max(100)
      .optional()
      .describe('Solo estas relaciones: «mention» o la key de un campo'),
    tags: z
      .array(z.string().trim().min(1).max(100))
      .max(50)
      .optional()
      .describe('Solo páginas con alguna (o una hija)'),
    orphans: z.boolean().default(false).describe('También las páginas sin relaciones'),
    ...readAs
  }),
  output: z.object({
    nodes: z.array(relationNode.omit({ generation: true })),
    edges: z
      .array(
        z.object({
          // Ids sin comprobar su forma: con 20.000 aristas, comprobarlos se nota (salen del servidor, no de fuera)
          source: z.string().describe('El id de la página de la que sale'),
          target: z.string().describe('El id de la página a la que va'),
          key: relationKey,
          secret: relationEdge.shape.secret
        })
      )
      .describe('Cortas: el nombre, el papel y el nombre al revés de cada key, en relations'),
    relations: z
      .array(
        z.object({
          key: relationKey,
          kind: z.enum(['field', 'mention', 'tree']),
          name: z.string(),
          inverseName: z.string().optional(),
          role: relationRole.optional(),
          count: z.number().int()
        })
      )
      .describe('Las relaciones que hay entre las páginas que salen, para filtrar')
  })
})
