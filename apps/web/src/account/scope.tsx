import { useQueryClient } from '@tanstack/react-query'
import { Fragment, type ReactNode, useState } from 'react'
import { useAccounts } from './context.tsx'

/**
 * Lo de una cuenta no sigue a la vista con otra ni sin ninguna. Al cambiar la cuenta (salir, entrar, salir desde otra
 * pestaña, acabarse la sesión) se vacía la caché y se vuelve a montar lo de dentro, que pierde su estado
 */
export function AccountScope({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const { account, pending } = useAccounts().useAccount()
  const email = account?.email ?? null
  // undefined: aún no se sabe cuál es (la primera vez no hay nada de otra cuenta que quitar)
  const [scope, setScope] = useState<{ email: string | null | undefined; generation: number }>({
    email: pending ? undefined : email,
    generation: 0
  })
  if (!pending && email !== scope.email) {
    const changed = scope.email !== undefined
    // Aquí, durante el render: lo de dentro no llega a pintarse con la caché de la cuenta anterior
    if (changed) queryClient.clear()
    setScope({ email, generation: scope.generation + (changed ? 1 : 0) })
  }
  return <Fragment key={scope.generation}>{children}</Fragment>
}
