/** Los tipos de recuadro: aparte, para que el nodo y su Markdown los usen sin depender el uno del otro */
export const CALLOUT_KINDS = ['note', 'tip', 'warning', 'danger', 'read-aloud'] as const
export type CalloutKind = (typeof CALLOUT_KINDS)[number]

export const isCalloutKind = (value: unknown): value is CalloutKind => CALLOUT_KINDS.includes(value as CalloutKind)
