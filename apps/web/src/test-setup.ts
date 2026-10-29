// Sin globales de Vitest, Testing Library no limpia sola el DOM entre pruebas
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(cleanup)
