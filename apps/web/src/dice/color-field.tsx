/** El color de tus dados (Ajustes › Jugabilidad): automático (uno de la paleta, siempre el mismo) o uno de ellos */
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './color-field.module.css'
import { DICE_COLORS } from './rolls.ts'

export function DiceColorField({
  name,
  value,
  onChange
}: {
  name: string
  value: string | null | undefined
  /** Al elegir uno (null: automático) */
  onChange?: (color: string | null) => void
}) {
  const { t } = useTranslation()
  const id = useId()
  return (
    <div className={styles.field} role="radiogroup" aria-labelledby={`${id}-label`}>
      <p id={`${id}-label`} className={styles.label}>
        {t('dice.color.title')}
      </p>
      <div className={styles.swatches}>
        <label className={styles.option}>
          <input
            type="radio"
            className={styles.input}
            name={name}
            value="auto"
            defaultChecked={!value}
            onChange={() => onChange?.(null)}
          />
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
              onChange={() => onChange?.(color.value)}
            />
            <span className={styles.swatch} style={{ background: color.value }} aria-hidden="true" />
            {t(`dice.color.${color.key}`)}
          </label>
        ))}
      </div>
    </div>
  )
}
