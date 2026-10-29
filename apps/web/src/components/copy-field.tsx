import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAnnounce } from './announcer.tsx'
import form from './form.module.css'
import styles from './list.module.css'

/** Un valor para copiar (un enlace, una dirección), con su etiqueta y «Copiar». Al cambiar el valor, vuelve a empezar */
export function CopyField({ label, value }: { label: string; value: string }) {
  return <Copyable key={value} label={label} value={value} />
}

function Copyable({ label, value }: { label: string; value: string }) {
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
      <div className={styles.actions}>
        <label className={styles.linkField}>
          <span>{label}</span>
          <input ref={input} readOnly value={value} onFocus={(event) => event.currentTarget.select()} />
        </label>
        <button type="button" className={form.button} onClick={copy}>
          {t('invitation.copy')}
        </button>
      </div>
      {result === 'copied' && <p>{t('invitation.copied')}</p>}
      {result === 'manual' && <p>{t('invitation.copyManually')}</p>}
    </>
  )
}
