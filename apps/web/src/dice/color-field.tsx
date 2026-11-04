/** El color de tus dados, en el perfil: automático (uno de la paleta, siempre el mismo) o uno de ellos */
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './color-field.module.css'
import { DICE_COLORS } from './rolls.ts'

export function DiceColorField({ name, value }: { name: string; value: string | null | undefined }) {
  const { t } = useTranslation()
  const id = useId()
  return (
    <div className={styles.field} role="radiogroup" aria-labelledby={`${id}-label`}>
      <p id={`${id}-label`} className={styles.label}>
        {t('dice.color.title')}
      </p>
      <div className={styles.swatches}>
        <label className={styles.option}>
          <input type="radio" className={styles.input} name={name} value="auto" defaultChecked={!value} />
          <span className={styles.auto} aria-hidden="true" />
          {t('dice.color.auto')}
        </label>
        {DICE_COLORS.map((color) => (
          <label key={color.key} className={styles.option}>
            <input
              type="radio"
              className={styles.input}
              name={name}
              value={color.value}
              defaultChecked={value === color.value}
            />
            <span className={styles.swatch} style={{ background: color.value }} aria-hidden="true" />
            {t(`dice.color.${color.key}`)}
          </label>
        ))}
      </div>
    </div>
  )
}
