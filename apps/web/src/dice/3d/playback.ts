/**
 * El ritmo de una tirada en pantalla. Aparte de la física (throw.ts, con cannon-es): la bandeja lo usa sin cargarla,
 * que va en su worker
 */

/** Lo que se enseña: como mucho, 1,8 s de tirada (a 60 fotogramas por segundo); más, y se hace larga */
export const MAX_FRAMES = 108

/**
 * A qué ritmo se reproduce una tirada de tantos fotogramas: la suya; si pasa de 1,8 s, algo más deprisa, entera y suave
 * (la bandeja interpola entre fotogramas), en vez de saltarse fotogramas, que se veía a tirones
 */
export const playbackRate = (frames: number) => Math.max(1, (frames - 1) / (MAX_FRAMES - 1))
