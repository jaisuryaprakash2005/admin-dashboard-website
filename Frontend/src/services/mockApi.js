
let mockBuildersList = [
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

// DEMO DATA ONLY. Nothing here touches your database.
// Shapes follow Backend/src/models/Property.js and User.js, plus the new
// `approvalStatus` / `rejectionReason` fields described in BACKEND_CHANGES.md.

const day = 86400000;
const ago = (d) => new Date(Date.now() - d * day).toISOString();
const wait = (v) => new Promise((r) => setTimeout(() => r(structuredClone(v)), 350));

const names = ['Arun Kumar', 'Priya Lakshmi', 'Karthik Raja', 'Divya Bharathi', 'Suresh Babu', 'Meena Sundaram',
  'Vignesh Murugan', 'Anitha Selvam', 'Ramesh Chandran', 'Kavitha Devi', 'Manoj Prabhu', 'Nandhini Raj',
  'Senthil Nathan', 'Harini Priya', 'Ganesh Moorthy', 'Swetha Ravi'];

let users = names.map((name, i) => ({
  id: `u${i + 1}`,
  name,
  email: `${name.toLowerCase().replace(/ /g, '.')}@example.com`,
  phone: i % 4 === 3 ? '' : `98${String(40000000 + i * 137913).slice(0, 8)}`,
  phoneVerified: i % 4 !== 3,
  provider: i % 3 === 0 ? 'google' : 'email',
  photo: '',
  createdAt: ago(3 + i * 9),
}));

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

let properties = seeds.map(([title, city, locality, propertyType, listingType, price, priceRaw], i) => {
  const owner = users[(i * 5) % users.length];
  const plot = propertyType === 'Plot';
  return {
    id: `p${i + 1}`,
    owner: owner.id, ownerName: owner.name, ownerEmail: owner.email,
    title, location: `${locality}, ${city}`, city, locality,
    address: `${10 + i}, Main Road, ${locality}`, postalCode: String(600001 + i * 311),
    price, priceRaw, listingType, propertyType,
    bedroom: plot ? '' : ['1 BHK', '2 BHK', '3 BHK', '4 BHK'][i % 4],
    bathroom: plot ? '' : String((i % 3) + 1), balconies: plot ? '' : String(i % 3),
    furnishingStatus: plot ? '' : ['Furnished', 'Semi Furnished', 'Unfurnished'][i % 3],
    propertyAge: plot ? '' : String(i % 8),
    description: 'Well-maintained property in a prime location with easy access to schools, markets and public transport.',
    amenities: ['Parking', 'Security', 'Water Supply', 'Power Backup'].slice(0, (i % 4) + 1),
    images: [IMG[i % IMG.length], IMG[(i + 2) % IMG.length]], image: IMG[i % IMG.length],
    status: avail[i], approvalStatus: approvals[i],
    rejectionReason: approvals[i] === 'rejected' ? 'Photos are unclear and the address looks incomplete.' : '',
    createdAt: ago(1 + i * 4),
  };
});

const rawPrice = (d) => {
  if (!d.price) return {};
  const n = parseFloat(String(d.price)) || 0;
  const unit = d.priceUnit === 'Cr' || d.priceUnit === 'Lac' ? ` ${d.priceUnit}` : '';
  return {
    priceRaw: Math.round(n * (d.priceUnit === 'Cr' ? 1e7 : d.priceUnit === 'Lac' ? 1e5 : 1)),
    price: `₹ ${unit ? n : n.toLocaleString('en-IN')}${unit}`,
  };
};
const uid = () => Math.random().toString(36).slice(2, 9);

export const mock = {
  async login(email) {
    return wait({ token: 'demo-token', user: { id: 'admin', name: 'Demo Admin', email: email || 'admin@demo', role: 'admin' } });
  },
  async me() {
    return wait({ id: 'admin', name: 'Demo Admin', email: 'admin@demo', role: 'admin' });
  },
  async listProperties() { return wait(properties); },
  async getProperty(id) {
    const p = properties.find((x) => x.id === id);
    if (!p) throw new Error('Property not found');
    return wait(p);
  },
  async createProperty(data) {
    const p = { ...data, ...rawPrice(data), id: `p${uid()}`, approvalStatus: 'approved', createdAt: new Date().toISOString() };
    properties = [p, ...properties];
    return wait(p);
  },
  async updateProperty(id, data) {
    properties = properties.map((p) => (p.id === id ? { ...p, ...data, ...rawPrice(data) } : p));
    return wait(properties.find((p) => p.id === id));
  },
  async deleteProperty(id) { properties = properties.filter((p) => p.id !== id); return wait({}); },
  async setApproval(id, action, remarks = '', targetStatus) {
    properties = properties.map((p) => {
      if (p.id !== id) return p;
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
    return wait(properties.find((p) => p.id === id));
  },
  async listUsers(q) {
    const term = (q || '').trim().toLowerCase();
    const filtered = term
      ? users.filter((u) => [u.name, u.email, u.phone].some((v) => (v || '').toLowerCase().includes(term)))
      : users;
    return wait(filtered);
  },
  async deleteUser(id) { users = users.filter((u) => u.id !== id); return wait({}); },
  async updateUser(id, updates) {
    users = users.map((u) => u.id === id ? { ...u, ...updates } : u);
    return wait({ success: true, user: users.find((u) => u.id === id) });
  },
  async updateProfile(updates) { return wait({ success: true, ...updates }); },
  async listAdmins() { return wait(users.filter(u => u.role === 'admin' || u.role === 'superadmin')); },
  async createAdmin(d) {
    const a = { id: `adm_${Date.now()}`, ...d, role: d.role || 'admin', createdAt: new Date().toISOString() };
    users = [a, ...users];
    return wait(a);
  },
  async updateAdmin(id, d) {
    users = users.map(u => u.id === id ? { ...u, ...d } : u);
    return wait(users.find(u => u.id === id));
  },
  async deleteAdmin(id) { users = users.filter(u => u.id !== id); return wait({}); },
  async changeUserRole(id, role) {
    users = users.map(u => u.id === id ? { ...u, role } : u);
    return wait(users.find(u => u.id === id));
  },
  async changeUserStatus(id, status, statusReason = '') {
    users = users.map(u => u.id === id ? { ...u, status, statusReason, statusUpdatedAt: new Date().toISOString() } : u);
    return wait({ success: true, user: users.find(u => u.id === id) });
  },
  async listLeads() {
    return wait({
      success: true,
      count: 0,
      stats: { totalLeads: 0, uniqueUsers: 0, totalViews: 0, mostEnquiredProperties: [] },
      results: [],
    });
  },
  async updateLeadStatus(id, status) {
    return wait({ success: true, message: `Lead status updated to ${status}` });
  },
  async listLeadsByUsers() {
    return wait({ success: true, count: 0, results: [] });
  },
  async deleteLead() {
    return wait({ success: true });
  },
  async deleteUserEnquiryHistory() {
    return wait({ success: true });
  },
  async listAds() {
    return wait({ results: [] });
  },
  async createAd(d) {
    return wait({ result: { _id: 'mock-ad-1', ...d, status: 'pending_approval', createdAt: new Date().toISOString() } });
  },
  async publishAd(id) {
    return wait({ result: { _id: id, status: 'published' } });
  },
  async rejectAd(id, reason) {
    return wait({ result: { _id: id, status: 'rejected', rejectionReason: reason } });
  },
  async deleteAd(id) {
    return wait({ success: true });
  },
  async listCareers() {
    return wait([
      { id: 'c1', title: 'Real Estate Portfolio Advisor', department: 'Advisory & Sales', location: 'Chennai & Bengaluru', type: 'Full-time', experience: '2-5 years', salary: '₹6L - ₹12L PA', status: 'active', applicationCount: 2, createdAt: new Date().toISOString() },
      { id: 'c2', title: 'Frontend React Engineer', department: 'Technology & Product', location: 'Remote / Hybrid', type: 'Full-time', experience: '2-4 years', salary: '₹8L - ₹16L PA', status: 'active', applicationCount: 1, createdAt: new Date().toISOString() }
    ]);
  },
  async createCareer(d) {
    return wait({ _id: 'c-' + Date.now(), ...d, status: 'active', createdAt: new Date().toISOString() });
  },
  async updateCareer(id, d) {
    return wait({ _id: id, ...d });
  },
  async deleteCareer(id) {
    return wait({ success: true });
  },
  async listCareerApplications() {
    return wait([
      { id: 'app1', roleTitle: 'Real Estate Portfolio Advisor', name: 'Ramesh Kumar', email: 'ramesh@gmail.com', phone: '9876543210', experience: '3 years in residential sales', resumeUrl: '', resumeOriginalName: 'Ramesh_CV.pdf', status: 'new', createdAt: new Date().toISOString() }
    ]);
  },
  async updateCareerApplicationStatus(id, status, notes) {
    return wait({ _id: id, status, notes });
  },
  async deleteCareerApplication(id) {
    return wait({ success: true });
  },
  listBuilders: async () => [...mockBuildersList],
  createBuilder: async (d) => {
    const item = { _id: 'b-' + Date.now(), ...d };
    mockBuildersList = [item, ...mockBuildersList];
    return item;
  },
  updateBuilder: async (id, d) => {
    mockBuildersList = mockBuildersList.map(b => ((b._id || b.id) === id ? { ...b, ...d } : b));
    return { _id: id, ...d };
  },
  deleteBuilder: async (id) => {
    mockBuildersList = mockBuildersList.filter(b => (b._id || b.id) !== id);
    return { success: true };
  },
  toggleBuilderStatus: async (id, status) => {
    mockBuildersList = mockBuildersList.map(b => ((b._id || b.id) === id ? { ...b, status } : b));
    return { _id: id, status };
  },
};
