// Admin service: dynamically connects to the real ProBridge backend API (MongoDB).
// - If connected to database: shows ONLY real database values (no dummy data mixed in).
// - If database is not connected / server offline / static live preview: seamlessly falls back to dummy data.
import api, { USE_MOCK } from './api.js';
import { localService } from './localDataService.js';

export { USE_MOCK };

// Normalizers
const normalizeProperty = (p) => {
  if (!p) return p;
  const sellerPhone =
    p.phone ||
    p.ownerPhone ||
    p.owner?.phone ||
    p.rawFormData?.phone ||
    p.rawFormData?.contactPhone ||
    '';
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
    lat: p.lat != null ? Number(p.lat) : p.rawFormData?.lat != null ? Number(p.rawFormData.lat) : null,
    lng: p.lng != null ? Number(p.lng) : p.rawFormData?.lng != null ? Number(p.rawFormData.lng) : null,
    address: p.address || p.rawFormData?.address || '',
    locality: p.locality || p.rawFormData?.locality || '',
    city: p.city || p.rawFormData?.city || '',
    postalCode: p.postalCode || p.rawFormData?.postalCode || '',
  };
};

const normalizeUser = (u) => ({ ...u, id: u.id || u._id });
const one = (p) => (p ? normalizeProperty(p) : p);

// Detect if an error is due to backend / database connectivity issues
export function isConnectionError(err) {
  if (!err) return false;
  // Network unreachable, DNS failure, CORS failure, connection refused, or timeout
  if (
    err.code === 'ERR_NETWORK' ||
    err.code === 'ECONNABORTED' ||
    err.code === 'ETIMEDOUT' ||
    err.code === 'ENOTFOUND' ||
    err.code === 'ECONNREFUSED'
  ) {
    return true;
  }
  // No response at all from backend server
  if (!err.response) return true;
  // 503 Service Unavailable (e.g. backend reported "Database is not connected"), 502 Bad Gateway, 504 Gateway Timeout
  if (err.response.status === 503 || err.response.status === 502 || err.response.status === 504) {
    return true;
  }
  return false;
}

// Global database connection tracker (for UI indicators if needed)
let isDbConnected = false;
export const getDatabaseStatus = () => isDbConnected;

function notifyDbStatus(connected) {
  isDbConnected = connected;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('probridge:db_status', { detail: { connected } }));
  }
}

// Dispatcher: If DB is connected, return ONLY DB values.
// If DB is disconnected or unreachable, fall back to dummy data (localService).
export async function callWithFallback(realFn, fallbackFn) {
  if (USE_MOCK) {
    notifyDbStatus(false);
    return await fallbackFn();
  }
  try {
    const result = await realFn();
    notifyDbStatus(true);
    return result;
  } catch (err) {
    if (isConnectionError(err)) {
      notifyDbStatus(false);
      return await fallbackFn();
    }
    // Application-level error from connected DB (e.g. 400 Bad Request, 401 Unauthorized, 403 Forbidden, 409 Conflict)
    // Re-throw so we never hide genuine database errors
    throw err;
  }
}

// ─── Real Database API Calls (MongoDB) ───
export const real = {
  login: async (email, password) => (await api.post('/api/auth/login', { email, password })).data,
  me: async () => (await api.get('/api/auth/me')).data.user,

  listProperties: async () =>
    ((await api.get('/api/admin/properties')).data.results || []).map(normalizeProperty),

  listArchivedProperties: async () => {
    try {
      const res = await api.get('/api/admin/properties/archived');
      return (res.data?.results || []).map(normalizeProperty);
    } catch (err) {
      if (err.response?.status === 404) {
        const res = await api.get('/api/admin/properties');
        const all = res.data?.results || [];
        return all
          .filter((p) => p.status === 'inactive' || p.status === 'archived' || p.isArchived === true)
          .map(normalizeProperty);
      }
      throw err;
    }
  },

  getProperty: async (id) => normalizeProperty((await api.get(`/api/properties/${id}`)).data.result),
  createProperty: async (d) => (await api.post('/api/properties', d)).data.result,
  updateProperty: async (id, d) => (await api.patch(`/api/properties/${id}`, d)).data.result,
  deleteProperty: async (id) => (await api.delete(`/api/properties/${id}`)).data,
  archiveProperty: async (id) => {
    try {
      return (await api.patch(`/api/admin/properties/${id}/archive`)).data;
    } catch (err) {
      if (err.response?.status === 404) {
        const prop = (await api.get(`/api/properties/${id}`)).data.result;
        const next =
          prop?.status === 'inactive' || prop?.status === 'archived' ? 'active' : 'inactive';
        return (await api.patch(`/api/properties/${id}`, { status: next })).data;
      }
      throw err;
    }
  },
  setApproval: async (id, action, remarks, targetStatus) =>
    (await api.patch(`/api/admin/properties/${id}/approval`, { action, remarks, targetStatus }))
      .data.result,

  listUsers: async (q) => {
    const params = q ? { params: { q } } : undefined;
    const res = await api.get('/api/admin/users', params);
    return (res.data?.results || []).map(normalizeUser);
  },
  deleteUser: async (id) => (await api.delete(`/api/admin/users/${id}`)).data,
  updateUser: async (id, updates) => (await api.patch(`/api/admin/users/${id}`, updates)).data,
  updateProfile: async (updates) => (await api.patch('/api/auth/profile', updates)).data,

  listAdmins: async () => {
    const res = await api.get('/api/admin/admins');
    return (res.data?.results || []).map(normalizeUser);
  },
  createAdmin: async (d) => normalizeUser((await api.post('/api/admin/admins', d)).data.result),
  updateAdmin: async (id, d) => normalizeUser((await api.patch(`/api/admin/admins/${id}`, d)).data.result),
  deleteAdmin: async (id, permanent = false) =>
    (await api.delete(`/api/admin/admins/${id}${permanent ? '?deletePermanently=true' : ''}`)).data,
  changeUserRole: async (id, role) =>
    normalizeUser((await api.patch(`/api/admin/users/${id}/role`, { role })).data.result),
  changeUserStatus: async (id, status, statusReason) =>
    (await api.patch(`/api/admin/users/${id}/status`, { status, statusReason })).data,

  listLeads: async () => {
    const res = await api.get('/api/admin/leads');
    const d = res.data;
    return Array.isArray(d) ? d : (d?.results || []);
  },
  updateLeadStatus: async (id, status) =>
    (await api.patch(`/api/admin/leads/${id}/status`, { status })).data,
  listLeadsByUsers: async () => (await api.get('/api/admin/leads/users')).data,
  deleteLead: async (id) => (await api.delete(`/api/admin/leads/${id}`)).data,
  deleteUserEnquiryHistory: async (userKey) =>
    (await api.delete(`/api/admin/leads/user/${encodeURIComponent(userKey)}`)).data,

  listAds: async () => {
    const res = await api.get('/api/admin/ads');
    const d = res.data;
    return Array.isArray(d?.results) ? d.results : (Array.isArray(d) ? d : []);
  },
  createAd: async (d) => (await api.post('/api/admin/ads', d)).data.result,
  publishAd: async (id) => (await api.patch(`/api/admin/ads/${id}/publish`)).data.result,
  rejectAd: async (id, reason) => (await api.patch(`/api/admin/ads/${id}/reject`, { reason })).data.result,
  deleteAd: async (id) => (await api.delete(`/api/admin/ads/${id}`)).data,

  listTopBanners: async () => {
    const res = await api.get('/api/admin/top-banners');
    const d = res.data;
    return Array.isArray(d?.results) ? d.results : (Array.isArray(d) ? d : []);
  },
  createTopBanner: async (d) => (await api.post('/api/admin/top-banners', d)).data.result,
  updateTopBanner: async (id, d) => (await api.patch(`/api/admin/top-banners/${id}`, d)).data.result,
  deleteTopBanner: async (id) => (await api.delete(`/api/admin/top-banners/${id}`)).data,

  listCareers: async () => {
    const res = await api.get('/api/careers/admin/all');
    const d = res.data;
    return Array.isArray(d?.results) ? d.results : (Array.isArray(d) ? d : []);
  },
  createCareer: async (d) => (await api.post('/api/careers/admin', d)).data.result,
  updateCareer: async (id, d) => (await api.patch(`/api/careers/admin/${id}`, d)).data.result,
  deleteCareer: async (id) => (await api.delete(`/api/careers/admin/${id}`)).data,
  listCareerApplications: async (params) => {
    const res = await api.get('/api/careers/admin/applications', { params });
    const d = res.data;
    return Array.isArray(d?.results) ? d.results : (Array.isArray(d) ? d : []);
  },
  updateCareerApplicationStatus: async (id, status, notes) =>
    (await api.patch(`/api/careers/admin/applications/${id}`, { status, notes })).data.result,
  deleteCareerApplication: async (id) =>
    (await api.delete(`/api/careers/admin/applications/${id}`)).data,

  listBuilders: async () => {
    const res = await api.get('/api/admin/builders');
    const d = res.data;
    return Array.isArray(d?.results) ? d.results : (Array.isArray(d) ? d : []);
  },
  createBuilder: async (d) => (await api.post('/api/admin/builders', d)).data.result,
  updateBuilder: async (id, d) => (await api.patch(`/api/admin/builders/${id}`, d)).data.result,
  deleteBuilder: async (id) => (await api.delete(`/api/admin/builders/${id}`)).data,
  toggleBuilderStatus: async (id, status) =>
    (await api.patch(`/api/admin/builders/${id}/status`, { status })).data.result,

  listYoutubeLinks: async () => {
    const res = await api.get('/api/youtube-links/admin');
    const d = res.data;
    return Array.isArray(d) ? d : (d?.results || []);
  },
  createYoutubeLink: async (d) => (await api.post('/api/youtube-links/admin', d)).data,
  updateYoutubeLink: async (id, d) => (await api.patch(`/api/youtube-links/admin/${id}`, d)).data,
  deleteYoutubeLink: async (id) => (await api.delete(`/api/youtube-links/admin/${id}`)).data,
  toggleYoutubeLinkStatus: async (id, status) =>
    (await api.patch(`/api/youtube-links/admin/${id}`, { status })).data,

  listBlogs: async () => {
    const res = await api.get('/api/blogs/admin');
    const d = res.data;
    return Array.isArray(d) ? d : (d?.results || []);
  },
  createBlog: async (d) => (await api.post('/api/blogs/admin', d)).data,
  updateBlog: async (id, d) => (await api.patch(`/api/blogs/admin/${id}`, d)).data,
  deleteBlog: async (id) => (await api.delete(`/api/blogs/admin/${id}`)).data,
  toggleBlogStatus: async (id, status) =>
    (await api.patch(`/api/blogs/admin/${id}`, { status })).data,

  listBridgeGuides: async () => {
    const res = await api.get('/api/bridge-guides/admin');
    const d = res.data;
    return Array.isArray(d) ? d : (d?.results || []);
  },
  createBridgeGuide: async (d) => (await api.post('/api/bridge-guides/admin', d)).data,
  updateBridgeGuide: async (id, d) => (await api.patch(`/api/bridge-guides/admin/${id}`, d)).data,
  deleteBridgeGuide: async (id) => (await api.delete(`/api/bridge-guides/admin/${id}`)).data,
  toggleBridgeGuideStatus: async (id, status) =>
    (await api.patch(`/api/bridge-guides/admin/${id}`, { status })).data,
};

// ─── Public Admin Service (With Dynamic Fallback) ───
export const adminService = {
  // Auth
  login: async (email, password) => {
    return callWithFallback(
      () => real.login(email, password),
      () => localService.login(email, password)
    );
  },
  me: async () => {
    return callWithFallback(
      real.me,
      localService.me
    );
  },

  // Properties
  listProperties: () =>
    callWithFallback(
      real.listProperties,
      async () => (await localService.listProperties()).map(normalizeProperty)
    ),

  listArchivedProperties: () =>
    callWithFallback(
      real.listArchivedProperties,
      async () => (await localService.listArchivedProperties()).map(normalizeProperty)
    ),

  getProperty: (id) =>
    callWithFallback(
      () => real.getProperty(id),
      () => one(localService.getProperty(id))
    ),

  createProperty: (d) =>
    callWithFallback(
      () => real.createProperty(d),
      () => one(localService.createProperty(d))
    ),

  updateProperty: (id, d) =>
    callWithFallback(
      () => real.updateProperty(id, d),
      () => one(localService.updateProperty(id, d))
    ),

  deleteProperty: (id) =>
    callWithFallback(
      () => real.deleteProperty(id),
      () => localService.deleteProperty(id)
    ),

  archiveProperty: (id) =>
    callWithFallback(
      () => real.archiveProperty(id),
      () => localService.archiveProperty(id)
    ),

  setApproval: (id, action, remarks, targetStatus) =>
    callWithFallback(
      () => real.setApproval(id, action, remarks, targetStatus),
      () => one(localService.setApproval(id, action, remarks, targetStatus))
    ),

  // Users & Admins
  listUsers: (q) =>
    callWithFallback(
      () => real.listUsers(q),
      async () => (await localService.listUsers(q)).map(normalizeUser)
    ),

  deleteUser: (id) =>
    callWithFallback(
      () => real.deleteUser(id),
      () => localService.deleteUser(id)
    ),

  updateUser: (id, updates) =>
    callWithFallback(
      () => real.updateUser(id, updates),
      () => localService.updateUser(id, updates)
    ),

  updateProfile: (updates) =>
    callWithFallback(
      () => real.updateProfile(updates),
      () => localService.updateProfile(updates)
    ),

  listAdmins: () =>
    callWithFallback(
      real.listAdmins,
      async () => (await localService.listAdmins()).map(normalizeUser)
    ),

  createAdmin: (d) =>
    callWithFallback(
      () => real.createAdmin(d),
      () => localService.createAdmin(d)
    ),

  updateAdmin: (id, d) =>
    callWithFallback(
      () => real.updateAdmin(id, d),
      () => localService.updateAdmin(id, d)
    ),

  deleteAdmin: (id, permanent) =>
    callWithFallback(
      () => real.deleteAdmin(id, permanent),
      () => localService.deleteAdmin(id, permanent)
    ),

  changeUserRole: (id, role) =>
    callWithFallback(
      () => real.changeUserRole(id, role),
      () => localService.changeUserRole(id, role)
    ),

  changeUserStatus: (id, status, statusReason) =>
    callWithFallback(
      () => real.changeUserStatus(id, status, statusReason),
      () => localService.changeUserStatus(id, status, statusReason)
    ),

  // Leads & Enquiries
  listLeads: () =>
    callWithFallback(
      real.listLeads,
      localService.listLeads
    ),

  updateLeadStatus: (id, status) =>
    callWithFallback(
      () => real.updateLeadStatus(id, status),
      () => localService.updateLeadStatus(id, status)
    ),

  listLeadsByUsers: () =>
    callWithFallback(
      real.listLeadsByUsers,
      localService.listLeadsByUsers
    ),

  deleteLead: (id) =>
    callWithFallback(
      () => real.deleteLead(id),
      () => localService.deleteLead(id)
    ),

  deleteUserEnquiryHistory: (userKey) =>
    callWithFallback(
      () => real.deleteUserEnquiryHistory(userKey),
      () => localService.deleteUserEnquiryHistory(userKey)
    ),

  // Ads
  listAds: () =>
    callWithFallback(
      real.listAds,
      localService.listAds
    ),

  createAd: (d) =>
    callWithFallback(
      () => real.createAd(d),
      () => localService.createAd(d)
    ),

  publishAd: (id) =>
    callWithFallback(
      () => real.publishAd(id),
      () => localService.publishAd(id)
    ),

  rejectAd: (id, reason) =>
    callWithFallback(
      () => real.rejectAd(id, reason),
      () => localService.rejectAd(id, reason)
    ),

  deleteAd: (id) =>
    callWithFallback(
      () => real.deleteAd(id),
      () => localService.deleteAd(id)
    ),

  // Top Banners
  listTopBanners: () =>
    callWithFallback(
      real.listTopBanners,
      localService.listTopBanners
    ),

  createTopBanner: (d) =>
    callWithFallback(
      () => real.createTopBanner(d),
      () => localService.createTopBanner(d)
    ),

  updateTopBanner: (id, d) =>
    callWithFallback(
      () => real.updateTopBanner(id, d),
      () => localService.updateTopBanner(id, d)
    ),

  deleteTopBanner: (id) =>
    callWithFallback(
      () => real.deleteTopBanner(id),
      () => localService.deleteTopBanner(id)
    ),

  // Careers & Applications
  listCareers: () =>
    callWithFallback(
      real.listCareers,
      localService.listCareers
    ),

  createCareer: (d) =>
    callWithFallback(
      () => real.createCareer(d),
      () => localService.createCareer(d)
    ),

  updateCareer: (id, d) =>
    callWithFallback(
      () => real.updateCareer(id, d),
      () => localService.updateCareer(id, d)
    ),

  deleteCareer: (id) =>
    callWithFallback(
      () => real.deleteCareer(id),
      () => localService.deleteCareer(id)
    ),

  listCareerApplications: (params) =>
    callWithFallback(
      () => real.listCareerApplications(params),
      () => localService.listCareerApplications(params)
    ),

  updateCareerApplicationStatus: (id, status, notes) =>
    callWithFallback(
      () => real.updateCareerApplicationStatus(id, status, notes),
      () => localService.updateCareerApplicationStatus(id, status, notes)
    ),

  deleteCareerApplication: (id) =>
    callWithFallback(
      () => real.deleteCareerApplication(id),
      () => localService.deleteCareerApplication(id)
    ),

  // Builders
  listBuilders: () =>
    callWithFallback(
      real.listBuilders,
      localService.listBuilders
    ),

  createBuilder: (d) =>
    callWithFallback(
      () => real.createBuilder(d),
      () => localService.createBuilder(d)
    ),

  updateBuilder: (id, d) =>
    callWithFallback(
      () => real.updateBuilder(id, d),
      () => localService.updateBuilder(id, d)
    ),

  deleteBuilder: (id) =>
    callWithFallback(
      () => real.deleteBuilder(id),
      () => localService.deleteBuilder(id)
    ),

  toggleBuilderStatus: (id, status) =>
    callWithFallback(
      () => real.toggleBuilderStatus(id, status),
      () => localService.toggleBuilderStatus(id, status)
    ),

  // YouTube Links
  listYoutubeLinks: () =>
    callWithFallback(
      real.listYoutubeLinks,
      localService.listYoutubeLinks
    ),

  createYoutubeLink: (d) =>
    callWithFallback(
      () => real.createYoutubeLink(d),
      () => localService.createYoutubeLink(d)
    ),

  updateYoutubeLink: (id, d) =>
    callWithFallback(
      () => real.updateYoutubeLink(id, d),
      () => localService.updateYoutubeLink(id, d)
    ),

  deleteYoutubeLink: (id) =>
    callWithFallback(
      () => real.deleteYoutubeLink(id),
      () => localService.deleteYoutubeLink(id)
    ),

  toggleYoutubeLinkStatus: (id, status) =>
    callWithFallback(
      () => real.toggleYoutubeLinkStatus(id, status),
      () => localService.toggleYoutubeLinkStatus(id, status)
    ),

  // Blogs
  listBlogs: () =>
    callWithFallback(
      real.listBlogs,
      localService.listBlogs
    ),

  createBlog: (d) =>
    callWithFallback(
      () => real.createBlog(d),
      () => localService.createBlog(d)
    ),

  updateBlog: (id, d) =>
    callWithFallback(
      () => real.updateBlog(id, d),
      () => localService.updateBlog(id, d)
    ),

  deleteBlog: (id) =>
    callWithFallback(
      () => real.deleteBlog(id),
      () => localService.deleteBlog(id)
    ),

  toggleBlogStatus: (id, status) =>
    callWithFallback(
      () => real.toggleBlogStatus(id, status),
      () => localService.toggleBlogStatus(id, status)
    ),

  // Bridge Guides
  listBridgeGuides: () =>
    callWithFallback(
      real.listBridgeGuides,
      localService.listBridgeGuides
    ),

  createBridgeGuide: (d) =>
    callWithFallback(
      () => real.createBridgeGuide(d),
      () => localService.createBridgeGuide(d)
    ),

  updateBridgeGuide: (id, d) =>
    callWithFallback(
      () => real.updateBridgeGuide(id, d),
      () => localService.updateBridgeGuide(id, d)
    ),

  deleteBridgeGuide: (id) =>
    callWithFallback(
      () => real.deleteBridgeGuide(id),
      () => localService.deleteBridgeGuide(id)
    ),

  toggleBridgeGuideStatus: (id, status) =>
    callWithFallback(
      () => real.toggleBridgeGuideStatus(id, status),
      () => localService.toggleBridgeGuideStatus(id, status)
    ),
};
