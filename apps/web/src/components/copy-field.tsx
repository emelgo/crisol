import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAnnounce } from './announcer.tsx'
import compactStyles from './copy-field.module.css'
import form from './form.module.css'
import styles from './list.module.css'

type Props = {
  label: string
  value: string
  /** Compacto: la etiqueta, solo para los lectores de pantalla (el título de su sección ya dice qué es), y «Copiar», secundario */
  compact?: boolean
}

/** Un valor para copiar (un enlace, una dirección), con su etiqueta y «Copiar». Al cambiar el valor, vuelve a empezar */
export function CopyField(props: Props) {
  return <Copyable key={props.value} {...props} />
}

function Copyable({ label, value, compact = false }: Props) {
  const { t } = useTranslation()
  const announce = useAnnounce()
  const input = useRef<HTMLInputElement>(null)
  const [result, setResult] = useState<'copied' | 'manual' | null>(null)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setResult('copied')
      announce(t('invitation.copied'))
    } catch {
      // Sin permiso o sin portapapeles (fuera de HTTPS): queda seleccionado, para copiarlo a mano
      input.current?.focus()
      input.current?.select()
      setResult('manual')
      announce(t('invitation.copyManually'))
    }
  }

  return (
    <>
      <div className={compact ? `${styles.actions} ${compactStyles.compact}` : styles.actions}>
        <label className={styles.linkField}>
          <span className={compact ? compactStyles.hidden : undefined}>{label}</span>
          <input ref={input} readOnly value={value} onFocus={(event) => event.currentTarget.select()} />
        </label>
        <button type="button" className={compact ? styles.secondary : form.button} onClick={copy}>
          {t('invitation.copy')}
        </button>
      </div>
      {result === 'copied' && <p>{t('invitation.copied')}</p>}
      {result === 'manual' && <p>{t('invitation.copyManually')}</p>}
    </>
  )
}
