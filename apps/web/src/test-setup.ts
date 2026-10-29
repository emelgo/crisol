// Sin globales de Vitest, Testing Library no limpia sola el DOM entre pruebas
import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(cleanup)

// findBy y waitFor esperan hasta 3 s (1 s por defecto): con todos los paquetes probándose a la vez, la máquina va
// cargada y un segundo no siempre basta. Lo que se comprueba no cambia
configure({ asyncUtilTimeout: 3000 })
