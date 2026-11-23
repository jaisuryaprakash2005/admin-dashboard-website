// Standalone frontend data service with localStorage persistence.
// Allows the entire admin website to run without a live database or backend server.

const STORAGE_PREFIX = 'probridge_store_';

function loadStore(key, defaultVal) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.warn('[Storage load]', key, err);
  }
  return defaultVal;
}

function saveStore(key, val) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(val));
  } catch (err) {
    console.warn('[Storage save]', key, err);
  }
}

const day = 86400000;
const ago = (d) => new Date(Date.now() - d * day).toISOString();
const wait = (v) => new Promise((r) => setTimeout(() => r(structuredClone(v)), 150));

const names = [
  'Arun Kumar', 'Priya Lakshmi', 'Karthik Raja', 'Divya Bharathi', 'Suresh Babu', 'Meena Sundaram',
  'Vignesh Murugan', 'Anitha Selvam', 'Ramesh Chandran', 'Kavitha Devi', 'Manoj Prabhu', 'Nandhini Raj',
  'Senthil Nathan', 'Harini Priya', 'Ganesh Moorthy', 'Swetha Ravi'
];

const seedUsers = [
  {
    id: 'superadmin_1',
    name: 'Super Admin',
    email: 'superadmin@probridge.in',
    phone: '9876543210',
    phoneVerified: true,
    provider: 'email',
    role: 'superadmin',
    status: 'active',
    createdAt: ago(120),
  },
  {
    id: 'admin_2',
    name: 'Regional Admin Chennai',
    email: 'admin.chennai@probridge.in',
    phone: '9840123456',
    phoneVerified: true,
    provider: 'email',
    role: 'admin',
    status: 'active',
    createdAt: ago(90),
  },
  ...names.map((name, i) => ({
    id: `u${i + 1}`,
    name,
    email: `${name.toLowerCase().replace(/ /g, '.')}@example.com`,
    phone: i % 4 === 3 ? '' : `98${String(40000000 + i * 137913).slice(0, 8)}`,
    phoneVerified: i % 4 !== 3,
    provider: i % 3 === 0 ? 'google' : 'email',
    role: 'user',
    status: 'active',
    createdAt: ago(3 + i * 9),
  })),
];

const IMG = [
  'photo-1600585154340-be6161a56a0c', 'photo-1564013799919-ab600027ffc6', 'photo-1512917774080-9991f1c4c750',
  'photo-1568605114967-8130f3a36994', 'photo-1570129477492-45c003edd2be', 'photo-1613490493576-7fde63acd811',
].map((p) => `https://images.unsplash.com/${p}?w=800&q=80`);

const seeds = [
  ['3 BHK Apartment in Adyar', 'Chennai', 'Adyar', 'Apartment', 'Sell', '₹ 1.2 Cr', 12000000],
  ['Premium Villa near Race Course', 'Coimbatore', 'Race Course', 'Villa', 'Sell', '₹ 2.8 Cr', 28000000],
  ['Residential Plot 30×40', 'Madurai', 'K Pudur', 'Plot', 'Sell', '₹ 38 Lac', 3800000],
  ['2 BHK Flat for Rent', 'Chennai', 'Velachery', 'Apartment', 'Rent', '₹ 22,000', 22000],
  ['Independent House with Garden', 'Salem', 'Fairlands', 'Independent House', 'Sell', '₹ 85 Lac', 8500000],
  ['Gated Community Plot', 'Tiruchchirappalli', 'Thillai Nagar', 'Plot', 'Sell', '₹ 52 Lac', 5200000],
  ['Luxury 4 BHK Villa', 'Chennai', 'ECR', 'Villa', 'Sell', '₹ 4.5 Cr', 45000000],
  ['1 BHK Studio near IT Park', 'Coimbatore', 'Saravanampatti', 'Apartment', 'Rent', '₹ 11,500', 11500],
  ['Corner Plot 60×90', 'Tirunelveli', 'Palayamkottai', 'Plot', 'Sell', '₹ 96 Lac', 9600000],
  ['2 BHK Apartment Ready to Move', 'Madurai', 'Anna Nagar', 'Apartment', 'Sell', '₹ 58 Lac', 5800000],
  ['Spacious Independent House', 'Erode', 'Perundurai Road', 'Independent House', 'Sell', '₹ 72 Lac', 7200000],
  ['3 BHK Semi Furnished Flat', 'Chennai', 'Tambaram', 'Apartment', 'Rent', '₹ 28,000', 28000],
  ['Villa in Gated Layout', 'Hosur', 'Mathigiri', 'Villa', 'Sell', '₹ 1.5 Cr', 15000000],
  ['Residential Layout Plot', 'Vellore', 'Katpadi', 'Plot', 'Sell', '₹ 29 Lac', 2900000],
  ['2 BHK near Beach', 'Pondicherry', 'White Town', 'Apartment', 'Sell', '₹ 95 Lac', 9500000],
  ['4 BHK Independent House', 'Thanjavur', 'Medical College Rd', 'Independent House', 'Sell', '₹ 1.1 Cr', 11000000],
  ['Budget 1 BHK Flat', 'Salem', 'Suramangalam', 'Apartment', 'Rent', '₹ 7,500', 7500],
  ['Hill View Villa', 'Ooty', 'Fern Hill', 'Villa', 'Sell', '₹ 3.2 Cr', 32000000],
];
const approvals = ['approved', 'approved', 'approved', 'pending', 'approved', 'pending', 'approved', 'approved', 'rejected',
  'approved', 'approved', 'pending', 'approved', 'approved', 'pending', 'approved', 'rejected', 'approved'];
const avail = ['active', 'active', 'sold', 'active', 'active', 'active', 'active', 'rented', 'active', 'sold', 'active',
  'active', 'active', 'active', 'active', 'inactive', 'active', 'active'];

const seedProperties = seeds.map(([title, city, locality, propertyType, listingType, price, priceRaw], i) => {
  const owner = seedUsers[(i * 5) % seedUsers.length];
  const plot = propertyType === 'Plot';
  return {
    id: `p${i + 1}`,
    _id: `p${i + 1}`,
    owner: owner.id,
    ownerName: owner.name,
    ownerEmail: owner.email,
    ownerPhone: owner.phone,
    sellerPhone: owner.phone,
    phone: owner.phone,
    title,
    location: `${locality}, ${city}`,
    city,
    locality,
    address: `${10 + i}, Main Road, ${locality}`,
    postalCode: String(600001 + i * 311),
    lat: 13.0827 + (i * 0.01),
    lng: 80.2707 + (i * 0.01),
    price,
    priceRaw,
    listingType,
    propertyType,
    bedroom: plot ? '' : ['1 BHK', '2 BHK', '3 BHK', '4 BHK'][i % 4],
    bathroom: plot ? '' : String((i % 3) + 1),
    balconies: plot ? '' : String(i % 3),
    furnishingStatus: plot ? '' : ['Furnished', 'Semi Furnished', 'Unfurnished'][i % 3],
    propertyAge: plot ? '' : String(i % 8),
    description: 'Well-maintained property in a prime location with easy access to schools, markets and public transport.',
    amenities: ['Parking', 'Security', 'Water Supply', 'Power Backup'].slice(0, (i % 4) + 1),
    images: [IMG[i % IMG.length], IMG[(i + 2) % IMG.length]],
    image: IMG[i % IMG.length],
    status: avail[i],
    approvalStatus: approvals[i],
    rejectionReason: approvals[i] === 'rejected' ? 'Photos are unclear and the address looks incomplete.' : '',
    createdAt: ago(1 + i * 4),
  };
});

const seedBuilders = [
  {
    _id: 'b-brigade',
    name: 'Brigade Group',
    logo: 'https://im.proptiger.com/3/100376/13/brigade-9778458.jpeg?height=120&width=320',
    experience: '35+ Years',
    established: '1986',
    headquarters: 'Bengaluru',
    website: 'https://www.brigadegroup.com',
    status: 'active',
    order: 1,
  },
  {
    _id: 'b-puravankara',
    name: 'Puravankara Limited',
    logo: 'https://im.proptiger.com/3/100046/13/puravankara-4491843.jpeg?height=120&width=320',
    experience: '45+ Years',
    established: '1975',
    headquarters: 'Bengaluru',
    website: 'https://www.puravankara.com',
    status: 'active',
    order: 2,
  },
  {
    _id: 'b-godrej',
    name: 'Godrej Properties',
    logo: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=320&q=80',
    experience: '32+ Years',
    established: '1990',
    headquarters: 'Mumbai',
    website: 'https://www.godrejproperties.com',
    status: 'active',
    order: 3,
  },
  {
    _id: 'b-prestige',
    name: 'Prestige Group',
    logo: 'https://im.proptiger.com/3/365/13/prestige-183425.jpg?height=120&width=320',
    experience: '36+ Years',
    established: '1986',
    headquarters: 'Bengaluru',
    website: 'https://www.prestigeconstructions.com',
    status: 'active',
    order: 4,
  },
];

const seedLeads = [
  {
    _id: 'lead-1',
    propertyId: 'p1',
    propertyTitle: '3 BHK Apartment in Adyar',
    propertyLocation: 'Adyar, Chennai',
    listingType: 'Sell',
    propertyPrice: '₹ 1.2 Cr',
    senderName: 'Vignesh Murugan',
    senderEmail: 'vignesh.murugan@example.com',
    senderPhone: '9840213456',
    message: 'I am interested in scheduling a site visit this Saturday. Please contact me.',
    status: 'New',
    createdAt: ago(1),
  },
  {
    _id: 'lead-2',
    propertyId: 'p7',
    propertyTitle: 'Luxury 4 BHK Villa',
    propertyLocation: 'ECR, Chennai',
    listingType: 'Sell',
    propertyPrice: '₹ 4.5 Cr',
    senderName: 'Harini Priya',
    senderEmail: 'harini.priya@example.com',
    senderPhone: '9840987654',
    message: 'Could you share the floor plan and association maintenance fee details?',
    status: 'Contacted',
    createdAt: ago(2),
  },
  {
    _id: 'lead-3',
    propertyId: 'p4',
    propertyTitle: '2 BHK Flat for Rent',
    propertyLocation: 'Velachery, Chennai',
    listingType: 'Rent',
    propertyPrice: '₹ 22,000',
    senderName: 'Karthik Raja',
    senderEmail: 'karthik.raja@example.com',
    senderPhone: '9840112233',
    message: 'Is this flat pet friendly and available for immediate move-in?',
    status: 'Follow-up',
    createdAt: ago(3),
  },
];

const seedAds = [
  {
    _id: 'ad-1',
    title: 'Green Meadows Luxury Villas',
    placement: 'featured',
    bannerUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200',
    status: 'published',
    clicks: 42,
    impressions: 890,
    startDate: ago(5),
    endDate: ago(-25),
    createdByName: 'Super Admin',
    createdAt: ago(6),
  },
  {
    _id: 'ad-2',
    title: 'Skyline Commercial Towers',
    placement: 'home_slider',
    bannerUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200',
    status: 'pending_approval',
    clicks: 0,
    impressions: 0,
    startDate: ago(1),
    endDate: ago(-14),
    createdByName: 'Brigade Group',
    createdAt: ago(2),
  },
];

const seedTopBanners = [
  {
    _id: 'tb-1',
    title: 'Explore Verified Properties in Chennai & Bengaluru',
    subtitle: 'Zero brokerage, 100% verified documentation',
    imageUrl: 'https://images.unsplash.com/photo-1613977257363-707ba9348227?w=1200',
    targetUrl: 'https://probridge.in',
    displayOrder: 1,
    isActive: true,
    clicks: 124,
    createdAt: ago(10),
  },
];

const seedCareers = [
  {
    id: 'c1',
    title: 'Real Estate Portfolio Advisor',
    department: 'Advisory & Sales',
    location: 'Chennai & Bengaluru',
    type: 'Full-time',
    experience: '2-5 years',
    salary: '₹6L - ₹12L PA',
    status: 'active',
    applicationCount: 2,
    createdAt: ago(15),
  },
  {
    id: 'c2',
    title: 'Frontend React Engineer',
    department: 'Technology & Product',
    location: 'Remote / Hybrid',
    type: 'Full-time',
    experience: '2-4 years',
    salary: '₹8L - ₹16L PA',
    status: 'active',
    applicationCount: 1,
    createdAt: ago(8),
  },
];

const seedApplications = [
  {
    id: 'app1',
    roleTitle: 'Real Estate Portfolio Advisor',
    name: 'Ramesh Kumar',
    email: 'ramesh@gmail.com',
    phone: '9876543210',
    experience: '3 years in residential sales',
    resumeUrl: '',
    resumeOriginalName: 'Ramesh_CV.pdf',
    status: 'new',
    createdAt: ago(2),
  },
];

// Helper to format raw prices
const rawPrice = (d) => {
  if (!d.price) return {};
  const n = parseFloat(String(d.price)) || 0;
  const unit = d.priceUnit === 'Cr' || d.priceUnit === 'Lac' ? ` ${d.priceUnit}` : '';
  return {
    priceRaw: Math.round(n * (d.priceUnit === 'Cr' ? 1e7 : d.priceUnit === 'Lac' ? 1e5 : 1)),
    price: `₹ ${unit ? n : n.toLocaleString('en-IN')}${unit}`,
  };
};

export const localService = {
  // Authentication
  async login(email, password) {
    const normEmail = (email || '').trim().toLowerCase();
    const pass = (password || '').trim();

    if (!normEmail || !pass) {
      throw new Error('Please enter both email and password.');
    }

    const isSuper =
      normEmail === 'superadmin@probridge.in' ||
      normEmail === 'superadmin@example.com' ||
      normEmail === 'admin@probridge.in';

    const user = {
      id: isSuper ? 'superadmin_1' : `adm_${Date.now()}`,
      name: isSuper ? 'Super Admin' : 'Admin User',
      email: normEmail,
      role: 'superadmin',
      phone: '9876543210',
      provider: 'email',
      status: 'active',
    };

    saveStore('current_user', user);
    return wait({
      token: 'probridge_superadmin_auth_token_2026',
      user,
    });
  },

  async me() {
    const user = loadStore('current_user', {
      id: 'superadmin_1',
      name: 'Super Admin',
      email: 'superadmin@probridge.in',
      role: 'superadmin',
      phone: '9876543210',
      provider: 'email',
      status: 'active',
    });
    return wait(user);
  },

  async updateProfile(updates) {
    const user = loadStore('current_user', {
      id: 'superadmin_1',
      name: 'Super Admin',
      email: 'superadmin@probridge.in',
      role: 'superadmin',
    });
    const updated = { ...user, ...updates };
    saveStore('current_user', updated);
    return wait({ success: true, user: updated });
  },

  // Properties
  async listProperties() {
    const list = loadStore('properties', seedProperties);
    return wait(list);
  },

  async listArchivedProperties() {
    const list = loadStore('properties', seedProperties);
    return wait(list.filter((p) => p.status === 'inactive' || p.isArchived === true));
  },

  async getProperty(id) {
    const list = loadStore('properties', seedProperties);
    const p = list.find((x) => (x.id || x._id) === id);
    if (!p) throw new Error('Property not found');
    return wait(p);
  },

  async createProperty(data) {
    const list = loadStore('properties', seedProperties);
    const newId = `p_${Date.now()}`;
    const p = {
      ...data,
      ...rawPrice(data),
      id: newId,
      _id: newId,
      approvalStatus: 'approved',
      status: data.status || 'active',
      createdAt: new Date().toISOString(),
    };
    const updated = [p, ...list];
    saveStore('properties', updated);
    return wait(p);
  },

  async updateProperty(id, data) {
    const list = loadStore('properties', seedProperties);
    const updated = list.map((p) => ((p.id || p._id) === id ? { ...p, ...data, ...rawPrice(data) } : p));
    saveStore('properties', updated);
    return wait(updated.find((p) => (p.id || p._id) === id));
  },

  async deleteProperty(id) {
    const list = loadStore('properties', seedProperties);
    const updated = list.filter((p) => (p.id || p._id) !== id);
    saveStore('properties', updated);
    return wait({ success: true });
  },

  async archiveProperty(id) {
    const list = loadStore('properties', seedProperties);
    const updated = list.map((p) => {
      if ((p.id || p._id) === id) {
        const next = p.status === 'inactive' ? 'active' : 'inactive';
        return { ...p, status: next, isArchived: next === 'inactive' };
      }
      return p;
    });
    saveStore('properties', updated);
    return wait({ success: true });
  },

  async setApproval(id, action, remarks = '', targetStatus) {
    const list = loadStore('properties', seedProperties);
    const updated = list.map((p) => {
      if ((p.id || p._id) !== id) return p;
      if (action === 'undo') {
        return { ...p, approvalStatus: 'pending', status: 'under_review', rejectionReason: '' };
      }
      return {
        ...p,
        approvalStatus: action === 'approve' ? (targetStatus || 'approved') : 'rejected',
        status: action === 'approve' && targetStatus !== 'admin_approved' ? 'active' : p.status,
        rejectionReason: action === 'reject' ? remarks : '',
      };
    });
    saveStore('properties', updated);
    return wait(updated.find((p) => (p.id || p._id) === id));
  },

  // Users & Admins
  async listUsers(q) {
    const list = loadStore('users', seedUsers);
    const term = (q || '').trim().toLowerCase();
    const filtered = term
      ? list.filter((u) => [u.name, u.email, u.phone].some((v) => (v || '').toLowerCase().includes(term)))
      : list;
    return wait(filtered);
  },

  async deleteUser(id) {
    const list = loadStore('users', seedUsers);
    const updated = list.filter((u) => u.id !== id);
    saveStore('users', updated);
    return wait({ success: true });
  },

  async updateUser(id, updates) {
    const list = loadStore('users', seedUsers);
    const updated = list.map((u) => (u.id === id ? { ...u, ...updates } : u));
    saveStore('users', updated);
    return wait({ success: true, user: updated.find((u) => u.id === id) });
  },

  async listAdmins() {
    const list = loadStore('users', seedUsers);
    return wait(list.filter((u) => u.role === 'admin' || u.role === 'superadmin'));
  },

  async createAdmin(d) {
    const list = loadStore('users', seedUsers);
    const a = {
      id: `adm_${Date.now()}`,
      ...d,
      role: d.role || 'admin',
      status: 'active',
      phoneVerified: true,
      createdAt: new Date().toISOString(),
    };
    const updated = [a, ...list];
    saveStore('users', updated);
    return wait(a);
  },

  async updateAdmin(id, d) {
    const list = loadStore('users', seedUsers);
    const updated = list.map((u) => (u.id === id ? { ...u, ...d } : u));
    saveStore('users', updated);
    return wait(updated.find((u) => u.id === id));
  },

  async deleteAdmin(id) {
    const list = loadStore('users', seedUsers);
    const updated = list.filter((u) => u.id !== id);
    saveStore('users', updated);
    return wait({ success: true });
  },

  async changeUserRole(id, role) {
    const list = loadStore('users', seedUsers);
    const updated = list.map((u) => (u.id === id ? { ...u, role } : u));
    saveStore('users', updated);
    return wait(updated.find((u) => u.id === id));
  },

  async changeUserStatus(id, status, statusReason = '') {
    const list = loadStore('users', seedUsers);
    const updated = list.map((u) => (u.id === id ? { ...u, status, statusReason, statusUpdatedAt: new Date().toISOString() } : u));
    saveStore('users', updated);
    return wait({ success: true, user: updated.find((u) => u.id === id) });
  },

  // Leads
  async listLeads() {
    const list = loadStore('leads', seedLeads);
    return wait({
      success: true,
      count: list.length,
      stats: {
        totalLeads: list.length,
        uniqueUsers: 3,
        totalViews: 428,
        mostEnquiredProperties: [
          { title: '3 BHK Apartment in Adyar', count: 5 },
          { title: 'Luxury 4 BHK Villa', count: 3 },
        ],
      },
      results: list,
    });
  },

  async updateLeadStatus(id, status) {
    const list = loadStore('leads', seedLeads);
    const updated = list.map((l) => (l._id === id ? { ...l, status } : l));
    saveStore('leads', updated);
    return wait({ success: true, message: `Lead status updated to ${status}` });
  },

  async listLeadsByUsers() {
    const list = loadStore('leads', seedLeads);
    return wait({ success: true, count: list.length, results: list });
  },

  async deleteLead(id) {
    const list = loadStore('leads', seedLeads);
    const updated = list.filter((l) => l._id !== id);
    saveStore('leads', updated);
    return wait({ success: true });
  },

  async deleteUserEnquiryHistory(userKey) {
    const list = loadStore('leads', seedLeads);
    const updated = list.filter((l) => {
      const k = l.senderId || (l.senderEmail ? l.senderEmail.toLowerCase() : null) || l.senderName;
      return k !== userKey;
    });
    saveStore('leads', updated);
    return wait({ success: true });
  },

  // Ads
  async listAds() {
    const list = loadStore('ads', seedAds);
    return wait(list);
  },

  async createAd(d) {
    const list = loadStore('ads', seedAds);
    const ad = {
      _id: `ad_${Date.now()}`,
      ...d,
      status: 'pending_approval',
      clicks: 0,
      impressions: 0,
      createdAt: new Date().toISOString(),
    };
    const updated = [ad, ...list];
    saveStore('ads', updated);
    return wait({ result: ad });
  },

  async publishAd(id) {
    const list = loadStore('ads', seedAds);
    const updated = list.map((a) => (a._id === id ? { ...a, status: 'published' } : a));
    saveStore('ads', updated);
    return wait({ result: updated.find((a) => a._id === id) });
  },

  async rejectAd(id, reason) {
    const list = loadStore('ads', seedAds);
    const updated = list.map((a) => (a._id === id ? { ...a, status: 'rejected', rejectionReason: reason } : a));
    saveStore('ads', updated);
    return wait({ result: updated.find((a) => a._id === id) });
  },

  async deleteAd(id) {
    const list = loadStore('ads', seedAds);
    const updated = list.filter((a) => a._id !== id);
    saveStore('ads', updated);
    return wait({ success: true });
  },

  // Top Banners
  async listTopBanners() {
    const list = loadStore('top_banners', seedTopBanners);
    return wait(list);
  },

  async createTopBanner(d) {
    const list = loadStore('top_banners', seedTopBanners);
    const tb = {
      _id: `tb_${Date.now()}`,
      ...d,
      clicks: 0,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    const updated = [tb, ...list];
    saveStore('top_banners', updated);
    return wait({ result: tb });
  },

  async updateTopBanner(id, d) {
    const list = loadStore('top_banners', seedTopBanners);
    const updated = list.map((tb) => (tb._id === id ? { ...tb, ...d } : tb));
    saveStore('top_banners', updated);
    return wait({ result: updated.find((tb) => tb._id === id) });
  },

  async deleteTopBanner(id) {
    const list = loadStore('top_banners', seedTopBanners);
    const updated = list.filter((tb) => tb._id !== id);
    saveStore('top_banners', updated);
    return wait({ success: true });
  },

  // Careers & Applications
  async listCareers() {
    const list = loadStore('careers', seedCareers);
    return wait(list);
  },

  async createCareer(d) {
    const list = loadStore('careers', seedCareers);
    const c = { id: `c_${Date.now()}`, ...d, status: 'active', applicationCount: 0, createdAt: new Date().toISOString() };
    const updated = [c, ...list];
    saveStore('careers', updated);
    return wait({ result: c });
  },

  async updateCareer(id, d) {
    const list = loadStore('careers', seedCareers);
    const updated = list.map((c) => (c.id === id ? { ...c, ...d } : c));
    saveStore('careers', updated);
    return wait({ result: updated.find((c) => c.id === id) });
  },

  async deleteCareer(id) {
    const list = loadStore('careers', seedCareers);
    const updated = list.filter((c) => c.id !== id);
    saveStore('careers', updated);
    return wait({ success: true });
  },

  async listCareerApplications() {
    const list = loadStore('career_applications', seedApplications);
    return wait(list);
  },

  async updateCareerApplicationStatus(id, status, notes) {
    const list = loadStore('career_applications', seedApplications);
    const updated = list.map((app) => (app.id === id ? { ...app, status, notes } : app));
    saveStore('career_applications', updated);
    return wait({ success: true, result: updated.find((app) => app.id === id) });
  },

  async deleteCareerApplication(id) {
    const list = loadStore('career_applications', seedApplications);
    const updated = list.filter((app) => app.id !== id);
    saveStore('career_applications', updated);
    return wait({ success: true });
  },

  // Builders
  async listBuilders() {
    const list = loadStore('builders', seedBuilders);
    return wait(list);
  },

  async createBuilder(d) {
    const list = loadStore('builders', seedBuilders);
    const item = { _id: `b_${Date.now()}`, ...d, status: 'active' };
    const updated = [item, ...list];
    saveStore('builders', updated);
    return wait({ result: item });
  },

  async updateBuilder(id, d) {
    const list = loadStore('builders', seedBuilders);
    const updated = list.map((b) => ((b._id || b.id) === id ? { ...b, ...d } : b));
    saveStore('builders', updated);
    return wait({ result: updated.find((b) => (b._id || b.id) === id) });
  },

  async deleteBuilder(id) {
    const list = loadStore('builders', seedBuilders);
    const updated = list.filter((b) => (b._id || b.id) !== id);
    saveStore('builders', updated);
    return wait({ success: true });
  },

  async toggleBuilderStatus(id, status) {
    const list = loadStore('builders', seedBuilders);
    const updated = list.map((b) => ((b._id || b.id) === id ? { ...b, status } : b));
    saveStore('builders', updated);
    return wait({ result: updated.find((b) => (b._id || b.id) === id) });
  },
};
