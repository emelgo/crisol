/**
 * El barrido de los dados de la wiki (revisión, tanda 7): en todos los documentos guardados, las tiradas escritas (el
 * nodo `diceRoll`, que ya no existe) pasan a texto en código. Lo que se abre o se lee ya se convierte solo; esto deja
 * la base limpia
 */
import { type Database, documentsRepo } from '@crisol/db'
import { BODY_FIELD } from '@crisol/editor'
import * as Y from 'yjs'
import { diceRollsToText } from '../wiki/dice-text.ts'

export async function diceToText(db: Database) {
  let rolls = 0
  let documents = 0
  for await (const batch of documentsRepo.allStates(db)) {
    for (const row of batch) {
      const doc = new Y.Doc()
      Y.applyUpdate(doc, row.state)
      const found = diceRollsToText(doc.getXmlFragment(BODY_FIELD))
      if (found > 0) {
        await documentsRepo.replaceState(db, row.id, Y.encodeStateAsUpdate(doc))
        rolls += found
        documents += 1
      }
      doc.destroy()
    }
  }
  return { rolls, documents }
}
