// @vitest-environment jsdom
// TEST: scanner storage unit tests
import { describe, it, expect, beforeEach } from 'vitest'
import { mockLocalStorage } from '../helpers/test-setup.js'

describe('Scanner Storage', () => {
  beforeEach(() => {
    mockLocalStorage()
  })

  it('stores and retrieves an item', () => {
    const item = { id: '1', barcode: '123', qty: 1 }
    localStorage.setItem('scanned-item-1', JSON.stringify(item))
    const retrieved = JSON.parse(localStorage.getItem('scanned-item-1'))
    expect(retrieved.barcode).toBe('123')
    expect(retrieved.qty).toBe(1)
  })

  it('removes an item', () => {
    localStorage.setItem('scanned-item-1', JSON.stringify({ id: '1' }))
    localStorage.removeItem('scanned-item-1')
    expect(localStorage.getItem('scanned-item-1')).toBeNull()
  })

  it('clears all items', () => {
    localStorage.setItem('scanned-item-1', JSON.stringify({ id: '1' }))
    localStorage.setItem('scanned-item-2', JSON.stringify({ id: '2' }))
    localStorage.clear()
    expect(localStorage.getItem('scanned-item-1')).toBeNull()
    expect(localStorage.getItem('scanned-item-2')).toBeNull()
  })
})
