const API = (() => {
  const BASE = localStorage.getItem('api_base') || '/api'

  async function req(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } }
    const token = localStorage.getItem('token')
    if (token) opts.headers.Authorization = `Bearer ${token}`
    if (body) opts.body = JSON.stringify(body)
    const res = await fetch(`${BASE}${path}`, opts)
    if (res.status === 401) { localStorage.removeItem('token'); localStorage.removeItem('user'); location.reload() }
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Request failed')
    return data
  }

  function get(path) { return req('GET', path) }
  function post(path, body) { return req('POST', path, body) }
  function put(path, body) { return req('PUT', path, body) }
  function del(path) { return req('DELETE', path) }

  return {
    login: (email, password) => post('/auth/login', { email, password }),
    register: (fields) => post('/auth/register', fields),
    getStores: () => get('/stores'),
    createStore: (name, slug) => post('/stores', { name, slug }),
    getStore: (id) => get(`/stores/${id}`),
    getStoreBySlug: (slug) => get(`/stores/slug/${slug}`),
    getProducts: (storeId) => get(`/products?store_id=${storeId}`),
    uploadCsv: (csv, storeId) => post('/products/upload', { csv }),
    deleteProduct: (id) => del(`/products/${id}`),
    getScanStats: (storeId) => get(`/scans/stats?store_id=${storeId}`),
    getBranding: (storeId) => get(`/branding/${storeId}`),
    updateBranding: (storeId, data) => put(`/branding/${storeId}`, data),
    getAdminStats: () => get('/admin/stats'),
    getAdminUsers: () => get('/admin/users'),
    createUser: (fields) => post('/admin/users', fields),
    deleteUser: (id) => del(`/admin/users/${id}`),
    getAdminActivity: (limit) => get(`/admin/activity?limit=${limit || 30}`),

    // Imports
    uploadImport: (content, filename) => post('/imports/upload', { content, filename }),
    getPendingImports: () => get('/imports/pending'),
    getStoreImports: (storeId) => get(`/imports/store/${storeId}`),
    getImport: (id) => get(`/imports/${id}`),
    getImportPreview: (id) => get(`/imports/${id}/preview`),
    previewMappedImport: (id) => post(`/imports/${id}/preview-mapped`),
    confirmImport: (id) => post(`/imports/${id}/confirm`),
    mapImport: (id, cm, po) => post(`/imports/${id}/map`, { column_mapping: cm, parser_options: po }),
    remapImport: (id, cm, po) => post(`/imports/${id}/re-map`, { column_mapping: cm, parser_options: po }),
    testImport: (id, cm) => post(`/imports/${id}/test`, { column_mapping: cm }),
    verifyImport: (id) => post(`/imports/${id}/verify`),
    rejectImport: (id) => post(`/imports/${id}/reject`),
    getMapping: (storeId) => get(`/imports/mapping/${storeId}`),
    saveMapping: (storeId, cm, po) => post(`/imports/mapping/${storeId}`, { column_mapping: cm, parser_options: po }),
    deleteMapping: (storeId) => del(`/imports/mapping/${storeId}`),
    del: (path) => del(path)
  }
})()
