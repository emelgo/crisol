import { E2E_PORT } from './servidor.ts'

/**
 * Las pruebas, en «Sin desenfoque» (Ajustes): en Chromium sin GPU (aquí y en la CI) el cristal (backdrop-filter) las
 * hace lentas e inestables, y miden lo que hace la app, no su aspecto. Las que miran el cristal o el fondo de ambiente
 * (la portada, la accesibilidad) lo quitan con `CON_DESENFOQUE`
 */
export const SIN_DESENFOQUE = {
  cookies: [],
  origins: [{ origin: `http://127.0.0.1:${E2E_PORT}`, localStorage: [{ name: 'crisol.sin-desenfoque', value: '1' }] }]
}

export const CON_DESENFOQUE = { cookies: [], origins: [] }
