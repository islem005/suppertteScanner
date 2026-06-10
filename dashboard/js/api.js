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

  /**
   * Convert a data URL to a File object suitable for multipart upload.
   * @param {string} dataUrl — e.g. "data:image/webp;base64,UklGR..."
   * @param {string} filename — desired filename
   * @returns {File}
   */
  function dataUrlToFile(dataUrl, filename) {
    const [meta, b64] = dataUrl.split(',', 2)
    const mime = meta.match(/:(.*?);/)?.[1] || 'image/png'
    const byteStr = atob(b64)
    const ab = new ArrayBuffer(byteStr.length)
    const ia = new Uint8Array(ab)
    for (let i = 0; i < byteStr.length; i++) ia[i] = byteStr.charCodeAt(i)
    return new File([ab], filename, { type: mime })
  }

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
    getProductByBarcode: (storeId, barcode) => get(`/products/lookup/${storeId}?barcode=${encodeURIComponent(barcode)}`),
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
    getPromotion: (id) => get(`/promotions/single/${id}`),
    createPromotion: (data) => post('/promotions', data),
    updatePromotion: (id, data) => put(`/promotions/${id}`, data),
    deletePromotion: (id) => del(`/promotions/${id}`),
    getBanner: (storeId) => get(`/promotions/banners/${storeId}`),

    // Discounts
    getDiscounts: (storeId) => get(`/discounts/store/${storeId}`),
    getDiscount: (id) => get(`/discounts/item/${id}`),
    createDiscount: (data) => post('/discounts', data),
    updateDiscount: (id, data) => put(`/discounts/${id}`, data),
    deleteDiscount: (id) => del(`/discounts/${id}`),

    // Analytics
    getAnalytics: (days) => get(`/analytics/store?days=${days || 30}`),
    exportAnalytics: async (days) => {
      const res = await fetch(`/api/analytics/store/export?days=${days || 30}`, { credentials: 'include' })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `analytics-${days || 30}d.csv`; a.click()
      URL.revokeObjectURL(url)
    },

    // Team management
    getTeam: (storeId) => get(`/team/${storeId}`),
    createAssociate: (storeId, data) => post(`/team/${storeId}`, data),
    deleteAssociate: (storeId, userId) => del(`/team/${storeId}/${userId}`),

    // Audit log
    getAuditLog: (storeId, limit, offset) => get(`/audit/${storeId}?limit=${limit || 50}&offset=${offset || 0}`),

    // File upload to R2
    /**
     * Upload a data URL (cropped image) to R2 storage.
     * @param {string} dataUrl — cropped image as data:image/...;base64,...
     * @param {string} storeId — store UUID
     * @param {string} type — 'promotion', 'discount', 'banner'
     * @param {string} [refId] — optional reference ID
     * @returns {Promise<{url:string,key:string,filename:string,size:number,contentType:string}>}
     */
    uploadImage: async (dataUrl, storeId, type, refId) => {
      // Derive MIME and extension from data URL
      const mime = dataUrl.match(/:(.*?);/)?.[1] || 'image/png'
      const ext = mime.split('/')[1] || 'png'
      const filename = `${type}-${Date.now()}.${ext}`
      const file = dataUrlToFile(dataUrl, filename)

      const formData = new FormData()
      formData.append('file', file)
      formData.append('store_id', storeId)
      formData.append('type', type === 'banner' ? 'promotion' : type)
      if (refId) formData.append('ref_id', refId)

      const res = await fetch(`${BASE}/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      return data
    }
  }
})()
