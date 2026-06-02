const API = (() => {
  const BASE = localStorage.getItem('api_base') || '/api'

  async function req(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' }, credentials: 'include' }
    if (body) opts.body = JSON.stringify(body)
    const res = await fetch(`${BASE}${path}`, opts)
    if (res.status === 401) { localStorage.removeItem('user'); window.location.href = '/auth/' }
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Request failed')
    return data
  }

  function get(path) { return req('GET', path) }
  function post(path, body) { return req('POST', path, body) }
  function put(path, body) { return req('PUT', path, body) }
  function del(path) { return req('DELETE', path) }

  return {
    // Auth
    login: (email, password) => post('/auth/sign-in/email', { email, password }),
    register: (fields) => post('/auth/setup', fields),

    // Stores
    getStores: () => get('/stores'),
    createStore: (name, slug) => post('/stores', { name, slug }),
    getStore: (id) => get(`/stores/${id}`),
    getStoreBySlug: (slug) => get(`/stores/slug/${slug}`),

    // Products
    getProducts: (storeId) => get(`/products?store_id=${storeId}`),
    uploadCsv: (csv, storeId) => post('/products/upload', { csv }),
    deleteProduct: (id) => del(`/products/${id}`),

    // Scans
    getScanStats: (storeId) => get(`/scans/stats?store_id=${storeId}`),

    // Branding
    getBranding: (storeId) => get(`/branding/${storeId}`),
    updateBranding: (storeId, data) => put(`/branding/${storeId}`, data),

    // Admin only
    getAdminStats: () => get('/admin/stats'),
    getAdminUsers: () => get('/admin/users'),
    createUser: (fields) => post('/admin/users', fields),
    deleteUser: (id) => del(`/admin/users/${id}`),
    getAdminActivity: (limit) => get(`/admin/activity?limit=${limit || 30}`),

    // Imports
    uploadImport: (content, filename) => post('/imports/upload', { content, filename }),
    getStoreImports: (storeId) => get(`/imports/store/${storeId}`),
    getImport: (id) => get(`/imports/${id}`),
    getImportPreview: (id) => get(`/imports/${id}/preview`),
    previewMappedImport: (id) => post(`/imports/${id}/preview-mapped`),
    confirmImport: (id) => post(`/imports/${id}/confirm`),
    getMapping: (storeId) => get(`/imports/mapping/${storeId}`),

    // Promotions
    getStorePromotions: (storeId) => get(`/promotions/store/${storeId}`),
    getPromotion: (id) => get(`/promotions/${id}`),
    createPromotion: (data) => post('/promotions', data),
    updatePromotion: (id, data) => put(`/promotions/${id}`, data),
    deletePromotion: (id) => del(`/promotions/${id}`),
    getBanner: (storeId) => get(`/promotions/banner/${storeId}`),

    // Discounts
    getDiscounts: (storeId) => get(`/discounts/store/${storeId}`),
    getDiscount: (id) => get(`/discounts/item/${id}`),
    createDiscount: (data) => post('/discounts', data),
    updateDiscount: (id, data) => put(`/discounts/${id}`, data),
    deleteDiscount: (id) => del(`/discounts/${id}`)
  }
})()
