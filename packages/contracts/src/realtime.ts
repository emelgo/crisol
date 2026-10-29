/**
 * Lo que el servidor manda por el canal en tiempo real, ya proyectado para quien lo recibe. Solo avisa: los datos se
 * vuelven a pedir por la API, que decide qué ve cada cuenta.
 */
export type RealtimeMessage =
  /** Algo de eso ha cambiado: la web lo vuelve a pedir */
  | { type: 'changed'; what: 'worlds' }
  | { type: 'changed'; what: 'campaigns'; worldId: string }
  | { type: 'changed'; what: 'members' | 'invitation'; campaignId: string }
  /** Alguien ha entrado en la campaña con el enlace (al máster, con «Expulsar» a mano) */
  | { type: 'joined'; worldId: string; campaignId: string; campaign: string; member: { userId: string; name: string } }
  /** La cuenta ya no está en la campaña: la han expulsado o ha salido desde otra pestaña */
  | { type: 'revoked'; worldId: string; campaignId: string }
