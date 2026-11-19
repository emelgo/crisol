/**
 * Los árboles (la pestaña tree de una página; bloque B de los ajustes tras los módulos 8 a 10, como la genealogía de
 * Everlore): nodos que son una página del mundo o solo un nombre (que se convierte en página cuando haga falta) y líneas
 * entre ellos, hechas a mano y de tipos que no son fijos (un organigrama es un árbol con «dirige» y «miembro de»). Las
 * líneas entre dos nodos con página cuentan como relaciones del grafo. Un jugador ve el árbol si ve su pestaña, con los
 * nodos de páginas que conoce y los sueltos (ADR-0017)
 */
import { z } from 'zod'
import { defineAction } from './action.ts'
import { readAs } from './read-as.ts'

export const TREE_EDGE_TYPES = [
  'parent',
  'stepparent',
  'adoptive',
  'partner',
  'ex-partner',
  'sibling',
  'leads',
  'member',
  'other'
] as const

const EDGE_TYPES_TEXT =
  'parent: from es padre o madre de to; stepparent: from es su padrastro o madrastra; adoptive: from lo adoptó; partner: pareja; ex-partner: expareja; sibling: hermanos; leads: from dirige to; member: from es miembro de to; other: la que diga label (from encima de to o, con beside, al lado). No se deduce ninguna: cada una se pone'
/** Lo más que lleva un árbol (como TREE_LIMITS del dominio) */
export const TREE_MAX = { nodes: 400, edges: 800 } as const

const nodeId = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .describe('Corto y propio del árbol (el que quieras: «a», «abuela»…); las líneas lo usan')

export const treeNodeInput = z.object({
  id: nodeId,
  pageId: z.uuid().nullable().optional().describe('Su página del mundo; sin ella, un nodo suelto con su nombre'),
  name: z.string().trim().max(200).default('').describe('Su nombre; con página, se lee el de la página'),
  note: z.string().trim().max(300).optional().describe('Una línea bajo el nombre (fechas, un apodo)')
})

export const treeEdge = z.object({
  from: nodeId,
  to: nodeId,
  type: z.enum(TREE_EDGE_TYPES).describe(EDGE_TYPES_TEXT),
  label: z.string().trim().max(60).optional().describe('Con type other: su nombre («Padrino», «Rival», «Mentor»)'),
  beside: z.boolean().optional().describe('Con type other: al lado (si no, from va encima de to)')
})

export type TreeEdgeView = z.infer<typeof treeEdge>

/** Un nodo tal como se lee: con su página, el título y el icono de ella */
export const treeNodeView = z.object({
  id: z.string(),
  pageId: z.uuid().nullable(),
  name: z.string().describe('El de su página, si la tiene; si no, el suyo'),
  note: z.string().optional(),
  icon: z.string().nullable(),
  template: z.string().nullable().describe('La plantilla de su página (el color de su tarjeta)')
})

export type TreeNodeView = z.infer<typeof treeNodeView>

export const treeView = z.object({
  tabId: z.uuid(),
  pageId: z.uuid(),
  nodes: z.array(treeNodeView),
  edges: z.array(treeEdge),
  version: z.int()
})

export type TreeView = z.infer<typeof treeView>

export const getTree = defineAction({
  name: 'getTree',
  kind: 'read',
  description: `Un árbol (la pestaña tree de una página: genealógico, un organigrama…): sus nodos (con su página o sueltos, solo con su nombre) y sus líneas (${EDGE_TYPES_TEXT})`,
  input: z.object({ tabId: z.uuid(), ...readAs }),
  output: treeView
})

const treeLists = {
  nodes: z.array(treeNodeInput).max(TREE_MAX.nodes).optional().describe('La lista entera (sustituye a la que había)'),
  edges: z.array(treeEdge).max(TREE_MAX.edges).optional().describe('La lista entera (sustituye a la que había)')
}

export const updateTree = defineAction({
  name: 'updateTree',
  kind: 'write',
  description:
    'Cambia un árbol: su forma y sus listas de nodos y de líneas, enteras (lo que no se dé, se queda; mira antes getTree). Un nodo con pageId es esa página del mundo (una sola vez por árbol); sin ella, un nodo suelto con su nombre. Si algo no vale (una línea a un nodo que no está, alguien antepasado de sí mismo), dice qué y no cambia nada. Se deshace',
  input: z.object({ tabId: z.uuid(), ...treeLists }),
  output: treeView
})

export const createTree = defineAction({
  name: 'createTree',
  kind: 'write',
  description:
    'Crea un árbol (genealógico, un organigrama…) como pestaña de una página: con pageId, en esa página; sin él, en una página nueva con ese nombre (dentro de parentId, o en el primer nivel). Con sus nodos y sus líneas, si se dan (como en updateTree). Se deshace',
  input: z.object({
    worldId: z.uuid(),
    name: z
      .string()
      .trim()
      .min(1)
      .max(60)
      .describe('El de la página nueva, o el de la pestaña si va en una que ya hay'),
    pageId: z.uuid().optional(),
    parentId: z.uuid().nullable().optional(),
    ...treeLists
  }),
  output: treeView
})

export const convertTreeNodeToPage = defineAction({
  name: 'convertTreeNodeToPage',
  kind: 'write',
  description:
    'Convierte un nodo suelto de un árbol en página: la crea con su nombre (dentro de parentId; sin él, como subpágina de la página del árbol) y el nodo queda enlazado a ella. Se deshace',
  input: z.object({
    tabId: z.uuid(),
    nodeId: nodeId,
    parentId: z.uuid().nullable().optional().describe('Dónde va la página; sin él, bajo la página del árbol')
  }),
  output: z.object({ pageId: z.uuid(), tree: treeView })
})
