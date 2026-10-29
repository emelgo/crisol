import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import form from './form.module.css'
import styles from './list.module.css'

/** Un valor para copiar (un enlace, una dirección), con su etiqueta y «Copiar». Al cambiar el valor, vuelve a empezar */
export function CopyField({ label, value }: { label: string; value: string }) {
  return <Copyable key={value} label={label} value={value} />
}

function Copyable({ label, value }: { label: string; value: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  return (
    <>
      <div className={styles.actions}>
        <label className={styles.linkField}>
          <span>{label}</span>
          <input readOnly value={value} onFocus={(event) => event.currentTarget.select()} />
        </label>
        <button
          type="button"
          className={form.button}
          onClick={async () => {
            await navigator.clipboard.writeText(value)
            setCopied(true)
          }}
        >
          {t('invitation.copy')}
        </button>
      </div>
      {copied && <p role="status">{t('invitation.copied')}</p>}
    </>
  )
}
