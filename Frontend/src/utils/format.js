export const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const initials = (name = '') =>
  name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

export const shortId = (id = '') => String(id).slice(-6).toUpperCase();

export const AVAILABILITY = {
  active: { label: 'Available', tone: 'green' },
  sold: { label: 'Sold', tone: 'blue' },
  rented: { label: 'Rented', tone: 'blue' },
  inactive: { label: 'Archived', tone: 'grey' },
};
export const APPROVAL = {
  pending: { label: 'Pending Admin', tone: 'amber' },
  admin_approved: { label: 'Pending Super Admin', tone: 'blue' },
  approved: { label: 'Approved & Live', tone: 'green' },
  rejected: { label: 'Rejected', tone: 'red' },
};

// "₹ 85 Lac" -> { amount: '85', unit: 'Lac' }
export function parsePrice(price = '') {
  const m = String(price).match(/([\d.,]+)\s*(Cr|Lac)?/i);
  if (!m) return { amount: '', unit: 'Lac' };
  return { amount: m[1].replace(/,/g, ''), unit: m[2] ? (m[2].toLowerCase() === 'cr' ? 'Cr' : 'Lac') : 'Rs' };
}

// Last N months as [{key:'2026-11', label:'Nov'}]
export function lastMonths(n = 6) {
  const out = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleString('en-IN', { month: 'short' }) });
  }
  return out;
}
export const monthKey = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${d.getMonth()}`; };
