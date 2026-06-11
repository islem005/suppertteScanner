// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import '../../js/shared.js'

describe('escapeHtml', () => {
  it('escapes HTML special characters', () => {
    const result = window.escapeHtml('<script>alert("xss")</script>')
    expect(result).toContain('&lt;script&gt;')
    expect(result).toContain('&lt;/script&gt;')
    expect(result).not.toContain('<script>')
  })

  it('returns empty string for empty input', () => {
    expect(window.escapeHtml('')).toBe('')
  })

  it('passes through safe strings', () => {
    expect(window.escapeHtml('hello world')).toBe('hello world')
  })

  it('handles ampersands', () => {
    expect(window.escapeHtml('a & b')).toBe('a &amp; b')
  })
})

describe('showToast', () => {
  beforeEach(() => {
    const existing = document.getElementById('toast')
    if (existing) existing.remove()
  })

  it('creates a toast element if not present', () => {
    expect(document.getElementById('toast')).toBeNull()
    window.showToast('Test message')
    const toast = document.getElementById('toast')
    expect(toast).toBeTruthy()
    expect(toast.textContent).toBe('Test message')
  })

  it('adds and removes show class', async () => {
    window.showToast('Hello')
    const toast = document.getElementById('toast')
    expect(toast.classList.contains('show')).toBe(true)
    await new Promise(r => setTimeout(r, 2100))
    expect(toast.classList.contains('show')).toBe(false)
  })

  it('reuses existing toast element', () => {
    window.showToast('First')
    window.showToast('Second')
    const toasts = document.querySelectorAll('#toast')
    expect(toasts.length).toBe(1)
    expect(toasts[0].textContent).toBe('Second')
  })
})
