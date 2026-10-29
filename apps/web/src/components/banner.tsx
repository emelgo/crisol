import type { ReactNode } from 'react'
import styles from './banner.module.css'
import { PageTitle } from './page-title.tsx'

export interface Stat {
  label: string
  value: number
}

/** La franja de arriba de un mundo, una campaña o una invitación: de dónde cuelga, su nombre, tu papel y sus casillas */
export function Banner({
  crumb,
  title,
  detail,
  stats
}: {
  crumb: ReactNode
  title: string
  detail?: string | undefined
  stats: Stat[]
}) {
  return (
    <div className={styles.banner}>
      <div className={styles.heading}>
        <p className={styles.crumb}>{crumb}</p>
        <PageTitle>{title}</PageTitle>
        {detail && <p className={styles.detail}>{detail}</p>}
      </div>
      {stats.length > 0 && (
        <dl className={styles.stats}>
          {stats.map((stat) => (
            <div key={stat.label} className={styles.stat}>
              <dt>{stat.label}</dt>
              <dd>{stat.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}
