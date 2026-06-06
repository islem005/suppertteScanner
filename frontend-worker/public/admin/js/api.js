const API = (() => {
  const BASE = localStorage.getItem('api_base') || '/api'

  async function req(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' }, credentials: 'include' }
    if (body) opts.body = JSON.stringify(body)
    const res = await fetch(`${BASE}${path}`, opts)
    if (res.status === 401) { localStorage.removeItem('user'); window.location.href = '/admin/' }
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
    login: (email, password) => post('/auth/sign-in/email', { email, password }),
    register: (fields) => post('/auth/setup', fields),
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
    setUserPassword: (id, password) => post(`/admin/users/${id}/password`, { password }),
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
    // Registrations
    getRegistrations: (status) => get(`/registrations${status ? '?status=' + status : ''}`),
    getRegistration: (id) => get(`/registrations/${id}`),
    approveRegistration: (id, data) => post(`/registrations/${id}/approve`, data),
    rejectRegistration: (id, data) => post(`/registrations/${id}/reject`, data),
    del: (path) => del(path),

    // Promotions
    getStorePromotions: (storeId) => get(`/promotions/store/${storeId}`),
    getPromotion: (id) => get(`/promotions/single/${id}`),
    createPromotion: (data) => post('/promotions', data),
    updatePromotion: (id, data) => put(`/promotions/${id}`, data),
    deletePromotion: (id) => del(`/promotions/${id}`),
    getBanner: (storeId) => get(`/promotions/banners/${storeId}`),
    getOffers: (storeId) => get(`/promotions/offers/${storeId}`),

    // Discounts
    getDiscounts: (storeId) => get(`/discounts/store/${storeId}`),
    getDiscount: (id) => get(`/discounts/item/${id}`),
    createDiscount: (data) => post('/discounts', data),
    updateDiscount: (id, data) => put(`/discounts/${id}`, data),
    deleteDiscount: (id) => del(`/discounts/${id}`),

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
