/**
 * Lo que el servidor manda por el canal en tiempo real, ya proyectado para quien lo recibe. Solo avisa: los datos se
 * vuelven a pedir por la API, que decide qué ve cada cuenta.
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
  | { type: 'changed'; what: 'members' | 'invitation'; campaignId: string }
  /** Alguien ha entrado en la campaña con el enlace (al máster, con «Expulsar» a mano) */
  | { type: 'joined'; worldId: string; campaignId: string; campaign: string; member: { userId: string; name: string } }
  /** La cuenta ya no está en la campaña: la han expulsado o ha salido desde otra pestaña */
  | { type: 'revoked'; worldId: string; campaignId: string }
