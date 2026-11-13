import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { closeFileTab, FILE_TABS, openFileTab, readFileTabs, useFileTabs } from './file-tabs.ts'

afterEach(() => localStorage.clear())

describe('los archivos abiertos en el centro', () => {
  it('se abren al final, sin repetirse, y se cierran', () => {
    openFileTab('m', 'a')
    openFileTab('m', 'b')
    openFileTab('m', 'a')
    expect(readFileTabs('m')).toEqual(['a', 'b'])
    expect(closeFileTab('m', 'a')).toEqual(['b'])
    // Cada mundo, los suyos
    expect(readFileTabs('otro')).toEqual([])
  })

  it('si sobran, se va el más antiguo', () => {
    for (let i = 0; i <= FILE_TABS; i++) openFileTab('m', `f${i}`)
    const ids = readFileTabs('m')
    expect(ids).toHaveLength(FILE_TABS)
    expect(ids[0]).toBe('f1')
  })

  it('lo guardado roto no rompe nada', () => {
    localStorage.setItem('crisol.mundo.archivos.m', '{no')
    expect(readFileTabs('m')).toEqual([])
  })

  it('quien los enseña se entera al momento', () => {
    const { result } = renderHook(() => useFileTabs('m'))
    expect(result.current).toEqual([])
    act(() => openFileTab('m', 'a'))
    expect(result.current).toEqual(['a'])
  })
})
