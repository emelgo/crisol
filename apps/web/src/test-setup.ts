// Sin globales de Vitest, Testing Library no limpia sola el DOM entre pruebas
import { cleanup, configure } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach } from 'vitest'
import { loadGameIcons } from './components/game-icons.ts'

afterEach(cleanup)

// La lista de los iconos de rol se pide aparte (import dinámico): en las pruebas, ya está, como tras la primera vez
beforeAll(async () => {
  await loadGameIcons()
})

// El tutorial del mundo sale en todas sus páginas (y se lleva el foco): en las pruebas, ya visto, salvo que una lo
// quiera ver (pone su propia lista de vistos)
beforeEach(() => {
  try {
    localStorage.setItem('crisol.recorridos.enrique@crisol.test', JSON.stringify({ seen: ['mundo'] }))
    // La barra de la Mesa recuerda su pestaña y si está plegada: cada prueba empieza como la primera vez
    localStorage.removeItem('crisol.mesa.pestana')
    localStorage.removeItem('crisol.mesa.plegada')
    localStorage.removeItem('crisol.ventanas')
  } catch {
    // Sin almacenamiento (entorno sin DOM), no hay tutorial
  }
})

// findBy y waitFor esperan hasta 3 s (1 s por defecto): con todos los paquetes probándose a la vez, la máquina va
// cargada y un segundo no siempre basta. Lo que se comprueba no cambia
configure({ asyncUtilTimeout: 3000 })
