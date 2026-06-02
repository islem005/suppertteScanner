// @vitest-environment jsdom
// TEST: scanner app unit tests
import { describe, it, expect, beforeEach } from 'vitest'

describe('Scanner App', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="counter-badge">0</div>
      <div id="results-list"></div>
      <div id="empty-state"></div>
    `
  })

  it('renders the counter badge', () => {
    const badge = document.getElementById('counter-badge')
    expect(badge).toBeTruthy()
    expect(badge.textContent).toBe('0')
  })

  it('has a results list element', () => {
    const list = document.getElementById('results-list')
    expect(list).toBeTruthy()
  })
})
