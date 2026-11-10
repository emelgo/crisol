import type { DiceRoll } from './dice.ts'
import type { LogEntry } from './log.ts'

/**
 * Lo que el servidor manda por el canal en tiempo real, ya proyectado para quien lo recibe. Casi todo solo avisa: los
 * datos se vuelven a pedir por la API, que decide qué ve cada cuenta. Las tiradas llegan enteras (ADR-0010): solo a
 * quien la puede ver, y así los dados caen al momento
 */
export type RealtimeMessage =
  /**
   * Lo primero al conectar: la versión de la web que sirve el servidor (su script de entrada; null en desarrollo). Si
   * la pestaña tiene otra, es que hubo un despliegue: hay que recargar
   */
  | { type: 'hello'; build: string | null }
  /** Algo de eso ha cambiado: la web lo vuelve a pedir */
  | { type: 'changed'; what: 'worlds' }
  /** La cola de la IA de esa cuenta */
  | { type: 'changed'; what: 'approvals' }
  | { type: 'changed'; what: 'campaigns'; worldId: string }
  /** El árbol o la fila de alguna página de la wiki de ese mundo */
  | { type: 'changed'; what: 'pages'; worldId: string }
  /** El texto de una página (su cuerpo o un secreto) se guardó: lo que lo enseña en otra (vista previa, incrustado) */
  | { type: 'changed'; what: 'pageContent'; worldId: string; pageId: string }
  /** Los archivos de ese mundo */
  | { type: 'changed'; what: 'files'; worldId: string }
  /** Los archivos comunes de esa organización (los ven todos sus mundos) */
  | { type: 'changed'; what: 'commonFiles'; organizationId: string }
  /** Las etiquetas de esa organización */
  | { type: 'changed'; what: 'tags'; organizationId: string }
  /** Las plantillas de página de esa organización */
  | { type: 'changed'; what: 'templates'; organizationId: string }
  /** Los sistemas de la cuenta */
  | { type: 'changed'; what: 'systems'; organizationId: string }
  /** El compendio de ese mundo (lo que ven sus campañas en su compendio y en las hojas) */
  | { type: 'changed'; what: 'worldContent'; worldId: string }
  | { type: 'changed'; what: 'members' | 'invitation'; campaignId: string }
  /** Las criaturas en juego de esa campaña (al máster) */
  | { type: 'changed'; what: 'creatures'; campaignId: string }
  /** Quién está en la Mesa de esa campaña (entra, sale o cambia de pestaña) */
  | { type: 'changed'; what: 'tablePresence'; campaignId: string }
  /** El máster vació el registro o borró tiradas: se vuelven a pedir */
  | { type: 'changed'; what: 'log' | 'rolls'; campaignId: string }
  /** Las carpetas de la pestaña Actores (solo al máster) */
  | { type: 'changed'; what: 'actorFolders'; campaignId: string }
  /** Se le reveló algo a quien lo recibe (solo a él): el aviso, con lo que ya ve (docs/specs/revelar.md) */
  | {
      type: 'revealed'
      worldId: string
      campaignId: string
      kind: 'page' | 'secret' | 'tab' | 'pin' | 'element' | 'content'
      /** Lo revelado: su id (una entrada del compendio del mundo, su clave) */
      targetId?: string
      pageId: string | null
      title: string
    }
  /** El máster le enseña una página (que ya conoce): se le abre al momento */
  | { type: 'shown'; worldId: string; campaignId: string; pageId: string; title: string }
  /** Una imagen que enseña el máster (docs/specs/ensenar.md): se abre en grande */
  | { type: 'shownImage'; worldId: string; campaignId: string; fileId: string; title: string }
  /** Lo que sabe una campaña (o todo el mundo, sin campaña) cambió: cada uno vuelve a pedir lo que tenga abierto */
  | { type: 'changed'; what: 'knowledge'; worldId: string; campaignId: string | null }
  /** El inventario del grupo de esa campaña (y lo que llevan sus personajes, si se movió algo) */
  | { type: 'changed'; what: 'party'; campaignId: string; characters?: string[] }
  /** Alguien ha entrado en la campaña con el enlace (al máster, con «Expulsar» a mano) */
  | { type: 'joined'; worldId: string; campaignId: string; campaign: string; member: { userId: string; name: string } }
  /** La cuenta ya no está en la campaña: la han expulsado o ha salido desde otra pestaña */
  | { type: 'revoked'; worldId: string; campaignId: string }
  /** Una tirada nueva en el registro de la campaña */
  | { type: 'rolled'; campaignId: string; roll: DiceRoll }
  /** Algo nuevo en el registro de la partida (docs/specs/registro.md), solo a quien lo puede ver */
  | { type: 'logged'; campaignId: string; entry: LogEntry }
  /** Un mensaje borrado del registro */
  | { type: 'unlogged'; campaignId: string; id: string }
