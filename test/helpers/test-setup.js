// TEST/MOCK: localStorage mock for unit tests
export function mockLocalStorage() {
  const store = {}
  vi.stubGlobal('localStorage', {
    getItem: key => store[key] ?? null,
    setItem: (key, val) => { store[key] = String(val) },
    removeItem: key => { delete store[key] },
    clear: () => { Object.keys(store).forEach(k => delete store[k]) },
  })
}

// TEST/MOCK: fetch mock for unit tests
export function mockFetch(data) {
  vi.stubGlobal('fetch', vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(data) })
  ))
}
