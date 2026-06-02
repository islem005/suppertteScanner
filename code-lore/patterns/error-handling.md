# Error Handling Patterns

## Toast Notifications

Used for non-blocking feedback (success, errors, info). Shared across scanner, dashboard, and admin:

```js
function showToast(msg) {
  let el = document.getElementById('toast')
  if (!el) {
    el = document.createElement('div')
    el.id = 'toast'
    document.body.appendChild(el)
  }
  el.textContent = msg
  el.classList.add('show')
  clearTimeout(el._h)
  el._h = setTimeout(() => el.classList.remove('show'), 2000)
}
```

- Standard duration: 2000ms (dashboard/admin), 1500ms (scanner)
- Auto-dismisses; no close button needed
- Positioned at bottom-center via CSS

## Modal Errors

For critical confirmations (deletes, destructive actions):

```js
showModal('Delete Store', `Delete <strong>${name}</strong> and all its data?`, async () => {
  await API.del(`/stores/${id}`)
  closeModal()
  loadStores()
}, true)  // ← true = danger mode (red "Delete" button)
```

The 4th parameter `danger` switches the confirm button to `btn-danger`.

## Inline Error Elements

For forms and login views, errors appear inline:

```html
<div id="admin-login-error" class="error-msg"></div>
```

Set via JS:
```js
errorEl.textContent = err.message
```

## API Error Handling

All API calls follow this pattern:

```js
try {
  const result = await API.someMethod()
  // success: update UI
} catch (err) {
  showToast('Error: ' + err.message)    // toast for actions
  // OR
  errorEl.textContent = err.message     // inline for forms
  // OR
  $('some-element').innerHTML = '<div class="empty-state">Could not load data.</div>'  // silent fallback for data loading
}
```

## Unhandled Rejection Handler

Both dashboard and admin include a global handler:

```js
window.addEventListener('unhandledrejection', e => {
  console.warn('Unhandled:', e.reason)
})
```

## Scanner App Silent Failures

In the scanner app, non-critical fetches use silent catch:

```js
try {
  const br = await fetch(`${apiBase}/branding/${store.id}`)
  const brand = await br.json()
  // apply branding
} catch {}  // ← silent: branding is non-critical
```

Only critical failures (store not found, camera unavailable) show user-facing messages.
