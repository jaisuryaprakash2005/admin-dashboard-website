// One place the UI calls. Switches between the real backend and demo data
// with VITE_USE_MOCK. Endpoints marked NEW do not exist yet in your backend:
// see BACKEND_CHANGES.md.
import api, { USE_MOCK } from './api.js';
import { mock } from './mockApi.js';

export { USE_MOCK };

// Older properties in your database have no approvalStatus -> treat them as approved.
const normalizeProperty = (p) => {
  if (!p) return p;
  const sellerPhone = p.phone || p.ownerPhone || p.owner?.phone || p.rawFormData?.phone || p.rawFormData?.contactPhone || '';
  return {
    ...p,
    id: p.id || p._id,
    approvalStatus: p.approvalStatus || 'approved',
    rejectionReason: p.rejectionReason || '',
    images: p.images?.length ? p.images : p.image ? [p.image] : [],
    ownerName: p.owner?.name || p.ownerName || '',
    ownerEmail: p.owner?.email || p.ownerEmail || '',
    ownerPhone: p.owner?.phone || p.ownerPhone || sellerPhone,
    phone: sellerPhone,
    lat: p.lat != null ? Number(p.lat) : (p.rawFormData?.lat != null ? Number(p.rawFormData.lat) : null),
    lng: p.lng != null ? Number(p.lng) : (p.rawFormData?.lng != null ? Number(p.rawFormData.lng) : null),
    address: p.address || p.rawFormData?.address || '',
    locality: p.locality || p.rawFormData?.locality || '',
    city: p.city || p.rawFormData?.city || '',
    postalCode: p.postalCode || p.rawFormData?.postalCode || '',
  };
};
const normalizeUser = (u) => ({ ...u, id: u.id || u._id });

const real = {
  login: async (email, password) => (await api.post('/api/auth/login', { email, password })).data, // exists
  me: async () => (await api.get('/api/auth/me')).data.user,                                         // exists
  listProperties: async () => ((await api.get('/api/admin/properties')).data.results || []).map(normalizeProperty),
  listArchivedProperties: async () => {
    try {
      const res = await api.get('/api/admin/properties/archived');
      return (res.data?.results || []).map(normalizeProperty);
    } catch (err) {
      if (err.response?.status === 404) {
        // Fallback: fetch from /api/admin/properties and filter for archived items
        const res = await api.get('/api/admin/properties');
        const all = res.data?.results || [];
        return all
          .filter((p) => p.status === 'inactive' || p.status === 'archived' || p.isArchived === true)
          .map(normalizeProperty);
      }
      throw err;
    }
  },
  getProperty: async (id) => normalizeProperty((await api.get(`/api/properties/${id}`)).data.result),                   // exists
  createProperty: async (d) => (await api.post('/api/properties', d)).data.result,                  // exists, needs admin tweaks
  updateProperty: async (id, d) => (await api.patch(`/api/properties/${id}`, d)).data.result,        // exists, needs admin tweaks
  deleteProperty: async (id) => (await api.delete(`/api/properties/${id}`)).data,                    // exists, needs admin tweaks
  archiveProperty: async (id) => {
    try {
      return (await api.patch(`/api/admin/properties/${id}/archive`)).data;
    } catch (err) {
      if (err.response?.status === 404) {
        const prop = (await api.get(`/api/properties/${id}`)).data.result;
        const next = prop?.status === 'inactive' || prop?.status === 'archived' ? 'active' : 'inactive';
        return (await api.patch(`/api/properties/${id}`, { status: next })).data;
      }
      throw err;
    }
  },
  setApproval: async (id, action, remarks, targetStatus) =>
    (await api.patch(`/api/admin/properties/${id}/approval`, { action, remarks, targetStatus })).data.result,      // NEW
  listUsers: async (q) => {
    const params = q ? { params: { q } } : undefined;
    return (await api.get('/api/admin/users', params)).data.results;
  },                           // NEW
  deleteUser: async (id) => (await api.delete(`/api/admin/users/${id}`)).data,                       // NEW
  updateUser: async (id, updates) => (await api.patch(`/api/admin/users/${id}`, updates)).data,      // NEW
  updateProfile: async (updates) => (await api.patch('/api/auth/profile', updates)).data,            // exists
  listAdmins: async () => (await api.get('/api/admin/admins')).data.results,
  createAdmin: async (d) => (await api.post('/api/admin/admins', d)).data.result,
  updateAdmin: async (id, d) => (await api.patch(`/api/admin/admins/${id}`, d)).data.result,
  deleteAdmin: async (id, permanent = false) =>
    (await api.delete(`/api/admin/admins/${id}${permanent ? '?deletePermanently=true' : ''}`)).data,
  changeUserRole: async (id, role) =>
    (await api.patch(`/api/admin/users/${id}/role`, { role })).data.result,
  changeUserStatus: async (id, status, statusReason) =>
    (await api.patch(`/api/admin/users/${id}/status`, { status, statusReason })).data,
  listLeads: async () => (await api.get('/api/admin/leads')).data,
  updateLeadStatus: async (id, status) => (await api.patch(`/api/admin/leads/${id}/status`, { status })).data,
  listLeadsByUsers: async () => (await api.get('/api/admin/leads/users')).data,
  deleteLead: async (id) => (await api.delete(`/api/admin/leads/${id}`)).data,
  deleteUserEnquiryHistory: async (userKey) =>
    (await api.delete(`/api/admin/leads/user/${encodeURIComponent(userKey)}`)).data,
  listAds: async () => (await api.get('/api/admin/ads')).data.results || [],
  createAd: async (d) => (await api.post('/api/admin/ads', d)).data.result,
  publishAd: async (id) => (await api.patch(`/api/admin/ads/${id}/publish`)).data.result,
  rejectAd: async (id, reason) => (await api.patch(`/api/admin/ads/${id}/reject`, { reason })).data.result,
  deleteAd: async (id) => (await api.delete(`/api/admin/ads/${id}`)).data,
  listTopBanners: async () => (await api.get('/api/admin/top-banners')).data.results || [],
  createTopBanner: async (d) => (await api.post('/api/admin/top-banners', d)).data.result,
  updateTopBanner: async (id, d) => (await api.patch(`/api/admin/top-banners/${id}`, d)).data.result,
  deleteTopBanner: async (id) => (await api.delete(`/api/admin/top-banners/${id}`)).data,
  listCareers: async () => (await api.get('/api/careers/admin/all')).data.results || [],
  createCareer: async (d) => (await api.post('/api/careers/admin', d)).data.result,
  updateCareer: async (id, d) => (await api.patch(`/api/careers/admin/${id}`, d)).data.result,
  deleteCareer: async (id) => (await api.delete(`/api/careers/admin/${id}`)).data,
  listCareerApplications: async (params) => (await api.get('/api/careers/admin/applications', { params })).data.results || [],
  updateCareerApplicationStatus: async (id, status, notes) => (await api.patch(`/api/careers/admin/applications/${id}`, { status, notes })).data.result,
  listBuilders: async () => (await api.get('/api/admin/builders')).data.results || [],
  createBuilder: async (d) => (await api.post('/api/admin/builders', d)).data.result,
  updateBuilder: async (id, d) => (await api.patch(`/api/admin/builders/${id}`, d)).data.result,
  deleteBuilder: async (id) => (await api.delete(`/api/admin/builders/${id}`)).data,
  toggleBuilderStatus: async (id, status) => (await api.patch(`/api/admin/builders/${id}/status`, { status })).data.result,
  deleteCareerApplication: async (id) => (await api.delete(`/api/careers/admin/applications/${id}`)).data,
};

const s = USE_MOCK ? mock : real;
const one = (p) => (p ? normalizeProperty(p) : p);

export const adminService = {
  login: (email, password) => s.login(email, password),
  me: () => s.me(),
  listProperties: async () => (await s.listProperties()).map(normalizeProperty),
  listArchivedProperties: async () => {
    if (USE_MOCK) {
      // Mock: filter properties where status === 'inactive'
      const all = await s.listProperties();
      return all.filter((p) => p.status === 'inactive').map(normalizeProperty);
    }
    return (await s.listArchivedProperties()).map(normalizeProperty);
  },
  getProperty: async (id) => one(await s.getProperty(id)),
  createProperty: async (d) => one(await s.createProperty(d)),
  updateProperty: async (id, d) => one(await s.updateProperty(id, d)),
  deleteProperty: (id) => s.deleteProperty(id),
  archiveProperty: async (id) => {
    if (USE_MOCK) {
      // Mock toggle — simply call updateProperty with opposite status
      return { success: true };
    }
    return s.archiveProperty(id);
  },
  setApproval: async (id, action, remarks, targetStatus) => one(await s.setApproval(id, action, remarks, targetStatus)),
  listUsers: async (q) => (await s.listUsers(q)).map(normalizeUser),
  deleteUser: (id) => s.deleteUser(id),
  updateUser: (id, updates) => s.updateUser(id, updates),
  updateProfile: (updates) => s.updateProfile(updates),
  listAdmins: async () => (await s.listAdmins()).map(normalizeUser),
  createAdmin: async (d) => normalizeUser(await s.createAdmin(d)),
  updateAdmin: async (id, d) => normalizeUser(await s.updateAdmin(id, d)),
  deleteAdmin: (id, permanent) => s.deleteAdmin(id, permanent),
  changeUserRole: async (id, role) => normalizeUser(await s.changeUserRole(id, role)),
  changeUserStatus: async (id, status, statusReason) => s.changeUserStatus(id, status, statusReason),
  listLeads: () => s.listLeads(),
  updateLeadStatus: (id, status) => s.updateLeadStatus(id, status),
  listLeadsByUsers: () => s.listLeadsByUsers(),
  deleteLead: (id) => s.deleteLead(id),
  deleteUserEnquiryHistory: (userKey) => s.deleteUserEnquiryHistory(userKey),
  listAds: async () => {
    if (!s.listAds) return [];
    const res = await s.listAds();
    return Array.isArray(res) ? res : (Array.isArray(res?.results) ? res.results : []);
  },
  createAd: (d) => s.createAd(d),
  publishAd: (id) => s.publishAd(id),
  rejectAd: (id, reason) => s.rejectAd(id, reason),
  deleteAd: (id) => s.deleteAd(id),
  listTopBanners: async () => {
    if (!s.listTopBanners) return [];
    const res = await s.listTopBanners();
    return Array.isArray(res) ? res : (Array.isArray(res?.results) ? res.results : []);
  },
  createTopBanner: (d) => s.createTopBanner(d),
  updateTopBanner: (id, d) => s.updateTopBanner(id, d),
  deleteTopBanner: (id) => s.deleteTopBanner(id),
  listCareers: () => (s.listCareers ? s.listCareers() : []),
  createCareer: (d) => s.createCareer(d),
  updateCareer: (id, d) => s.updateCareer(id, d),
  deleteCareer: (id) => s.deleteCareer(id),
  listCareerApplications: (params) => (s.listCareerApplications ? s.listCareerApplications(params) : []),
  updateCareerApplicationStatus: (id, status, notes) => s.updateCareerApplicationStatus(id, status, notes),
  deleteCareerApplication: (id) => s.deleteCareerApplication(id),
  listBuilders: () => (s.listBuilders ? s.listBuilders() : []),
  createBuilder: (d) => s.createBuilder(d),
  updateBuilder: (id, d) => s.updateBuilder(id, d),
  deleteBuilder: (id) => s.deleteBuilder(id),
  toggleBuilderStatus: (id, status) => s.toggleBuilderStatus(id, status),
};

