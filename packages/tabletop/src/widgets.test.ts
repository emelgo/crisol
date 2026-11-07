// Portado de packages/tabletop/src/mesa/widgets/modelo.test.ts y tiempo.test.ts (Crisol actual, commit 3f68f11)
import { describe, expect, it } from 'vitest'
import {
  clampCounter,
  clockFace,
  clockStep,
  counterStep,
  formatDuration,
  msToNextSecond,
  nextWidgetSort,
  parseDuration,
  pauseTimer,
  resetTimer,
  secondsShown,
  sortWidgets,
  startTimer,
  timerDone,
  valueOnClick
} from './widgets.ts'

describe('widgets', () => {
  it('orden', () => {
    const list = [
      { id: 'c', sort: 1, label: 'Suerte' },
      { id: 'r', sort: 0, label: 'Alarma' },
      { id: 'b', sort: 1, label: 'Oro' }
    ]
    expect(sortWidgets(list).map((w) => w.id)).toEqual(['r', 'b', 'c'])
    expect(nextWidgetSort(list)).toBe(2)
    expect(nextWidgetSort([])).toBe(0)
  })

  it('contadores con límites y relojes', () => {
    const limits = { min: 0, max: 5 }
    expect(counterStep(limits, 5, 1)).toBe(5)
    expect(counterStep(limits, 0, -1)).toBe(0)
    expect(counterStep({}, 0, -1)).toBe(-1)
    expect(clampCounter({ max: 3 }, 7)).toBe(3)
    expect(clockStep(6, 6, 1)).toBe(6)
    expect(clockStep(6, 0, -1)).toBe(0)
    // Pulsar el tercer segmento rellena tres; volver a pulsarlo lo vacía
    expect(valueOnClick(2, 1)).toBe(3)
    expect(valueOnClick(2, 3)).toBe(2)
  })

  it('duraciones', () => {
    expect(parseDuration('05:00')).toBe(300)
    expect(parseDuration('1:02:03')).toBe(3723)
    expect(parseDuration('90')).toBe(90)
    expect(parseDuration('1:75')).toBeNull()
    expect(parseDuration('a:00')).toBeNull()
    expect(formatDuration(125)).toBe('02:05')
    expect(formatDuration(3723)).toBe('1:02:03')
  })

  it('temporizador: corre con el reloj, se pausa y vuelve a empezar', () => {
    const timer = { value: 300, duration: 300 }
    const running = { ...timer, ...startTimer(timer, 1000) }
    expect(secondsShown(running, 1000)).toBe(300)
    expect(secondsShown(running, 1500)).toBe(300)
    expect(secondsShown(running, 2001)).toBe(299)
    expect(msToNextSecond(running, 1500)).toBe(500)
    expect(timerDone(running, 1000 + 301_000)).toBe(true)
    expect(msToNextSecond(running, 1000 + 301_000)).toBe(Number.POSITIVE_INFINITY)
    expect(pauseTimer(running, 61_000)).toEqual({ value: 240, running: null })
    expect(resetTimer(running)).toEqual({ value: 300, running: null })
    // Acabado, vuelve a empezar desde su duración entera
    expect(startTimer({ value: 0, duration: 300 }, 5)).toEqual({ value: 300, running: { since: 5, remaining: 300 } })
  })

  it('reloj: una cuña por segmento y la cuenta en el centro', () => {
    const face = clockFace(6, 2, true)
    expect(face.wedges).toHaveLength(6)
    expect(face.count?.text).toBe('2/6')
    expect(clockFace(4, 0, false).count).toBeNull()
    expect(clockFace(1, 1, false).wedges).toHaveLength(1)
  })
})
