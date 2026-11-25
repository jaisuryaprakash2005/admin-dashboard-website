import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  Home,
  Inbox,
  KeyRound,
  Mail,
  MapPin,
  MessageSquare,
  MessageSquareText,
  Phone,
  PhoneCall,
  Search,
  Send,
  Sparkles,
  Tag,
  Trash2,
  TrendingUp,
  User,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import SearchBar from '../components/SearchBar.jsx';
import Modal from '../components/Modal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { Empty, ErrorState, Loading } from '../components/StateBlock.jsx';
import useData from '../hooks/useData.js';
import { adminService } from '../services/adminService.js';
import { errorMessage } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { formatDate, shortId } from '../utils/format.js';

// Helper to format relative time
function formatRelativeTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateString);
}

export const LEAD_STATUSES = [
  'New',
  'Contact Pending',
  'Contacted',
  'Follow-up',
  'In Progress',
  'Converted',
  'Lost',
  'Closed',
];

const STATUS_CONFIG = {
  'New':             { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', dot: '#3b82f6' },
  'Contact Pending': { bg: '#fffbeb', color: '#b45309', border: '#fde68a', dot: '#f59e0b' },
  'Contacted':       { bg: '#f0f9ff', color: '#0369a1', border: '#bae6fd', dot: '#0ea5e9' },
  'Follow-up':       { bg: '#f5f3ff', color: '#6d28d9', border: '#ddd6fe', dot: '#8b5cf6' },
  'In Progress':     { bg: '#fefce8', color: '#a16207', border: '#fef08a', dot: '#eab308' },
  'Converted':       { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', dot: '#22c55e' },
  'Lost':            { bg: '#f8fafc', color: '#64748b', border: '#cbd5e1', dot: '#94a3b8' },
  'Closed':          { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca', dot: '#ef4444' },
};

function getLeadStatusStyle(status) {
  return STATUS_CONFIG[status] || STATUS_CONFIG['New'];
}

export default function Leads() {
  const toast = useToast();
  const { isSuperAdmin } = useAuth();
  const { data, setData, loading, error, reload } = useData(() => adminService.listLeads());

  // Views & Filters
  const [activeView, setActiveView] = useState('feed'); // 'feed' | 'users' | 'properties'
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('all'); // 'all' | 'today' | 'week' | 'month'
  const [leadTypeFilter, setLeadTypeFilter] = useState(''); // '' | 'enquiry' | 'callback'
  const [statusFilter, setStatusFilter] = useState(''); // '' | 'New' | 'Contact Pending' | ...

  // Modals
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [deletingLead, setDeletingLead] = useState(null);
  const [deletingUserHistory, setDeletingUserHistory] = useState(null);

  const handleStatusChange = async (leadId, newStatus) => {
    try {
      setData((prev) => {
        if (!prev) return prev;
        const updatedResults = (prev.results || []).map((lead) =>
          lead.id === leadId ? { ...lead, status: newStatus } : lead
        );
        return { ...prev, results: updatedResults };
      });
      await adminService.updateLeadStatus(leadId, newStatus);
      toast.success(`Lead status updated to "${newStatus}"`);
    } catch (err) {
      toast.error(errorMessage(err));
      reload();
    }
  };

  // Raw list & stats
  const leads = data?.results || [];
  const stats = data?.stats || {
    totalLeads: leads.length,
    uniqueUsers: 0,
    totalViews: 0,
    mostEnquiredProperties: [],
  };


  const isContactUsLead = (lead) => {
    if (!lead) return false;
    if (lead.isContactUs === true || lead.source === 'contact_us') return true;
    const reqType = (lead.requestType || '').toLowerCase();
    const title = (lead.title || '').toLowerCase();
    const pTitle = (lead.propertyTitle || '').toLowerCase();
    const msg = (lead.message || lead.comment || '').toLowerCase();
    const subject = (lead.subject || lead.contactUsSubject || '').toLowerCase();
    return (
      reqType.includes('contact') ||
      title.includes('contact us') ||
      pTitle.includes('contact us') ||
      subject.includes('contact') ||
      lead.source === 'contact_us' ||
      (!lead.propertyId && (title.includes('contact') || msg.includes('contact') || subject))
    );
  };

  const isCallbackLead = (lead) => {
    if (!lead) return false;
    if (isContactUsLead(lead)) return false;
    if (lead.isCallback === true) return true;
    const reqType = (lead.requestType || '').toLowerCase();
    const title = (lead.title || '').toLowerCase();
    const msg = (lead.message || lead.comment || '').toLowerCase();
    return (
      reqType.includes('callback') ||
      title.includes('callback') ||
      msg.includes('callback')
    );
  };

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    const term = q.trim().toLowerCase();
    const now = Date.now();

    return leads.filter((lead) => {
      // Search term filter
      if (term) {
        const matches = [
          lead.senderName,
          lead.senderEmail,
          lead.senderPhone,
          lead.propertyTitle,
          lead.propertyLocation,
          lead.city,
          lead.message,
          lead.ownerName,
          lead.subject,
          lead.contactUsSubject,
          lead.source,
        ].some((v) => (v || '').toLowerCase().includes(term));
        if (!matches) return false;
      }

      // Listing type filter
      if (typeFilter && lead.listingType !== typeFilter) {
        return false;
      }

      // Request type filter (Enquiry vs Callback vs Contact Us)
      if (leadTypeFilter === 'callback' && !isCallbackLead(lead)) return false;
      if (leadTypeFilter === 'enquiry' && (isCallbackLead(lead) || isContactUsLead(lead))) return false;
      if (leadTypeFilter === 'contact_us' && !isContactUsLead(lead)) return false;

      // Status filter
      if (statusFilter && (lead.status || 'New') !== statusFilter) return false;

      // Date range filter
      if (dateFilter !== 'all') {
        const leadTime = new Date(lead.createdAt).getTime();
        const diffMs = now - leadTime;
        if (dateFilter === 'today' && diffMs > 24 * 60 * 60 * 1000) return false;
        if (dateFilter === 'week' && diffMs > 7 * 24 * 60 * 60 * 1000) return false;
        if (dateFilter === 'month' && diffMs > 30 * 24 * 60 * 60 * 1000) return false;
      }

      return true;
    });
  }, [leads, q, typeFilter, dateFilter, leadTypeFilter, statusFilter]);

  // Grouped by User for "By User" View
  const groupedUsers = useMemo(() => {
    const map = new Map();

    for (const lead of filteredLeads) {
      const key = lead.senderId || (lead.senderEmail ? lead.senderEmail.toLowerCase() : null) || lead.senderName || 'unknown';
      if (!map.has(key)) {
        map.set(key, {
          key,
          senderId: lead.senderId,
          name: lead.senderName,
          email: lead.senderEmail,
          phone: lead.senderPhone,
          photo: lead.senderPhoto,
          totalEnquiries: 0,
          lastEnquiryAt: lead.createdAt,
          enquiries: [],
        });
      }

      const u = map.get(key);
      u.totalEnquiries += 1;
      u.enquiries.push(lead);
      if (new Date(lead.createdAt) > new Date(u.lastEnquiryAt)) {
        u.lastEnquiryAt = lead.createdAt;
      }
    }

    return Array.from(map.values()).sort((a, b) => b.totalEnquiries - a.totalEnquiries);
  }, [filteredLeads]);

  const contactUsCount = useMemo(() => leads.filter(isContactUsLead).length, [leads]);
  const callbackCount = useMemo(() => leads.filter(isCallbackLead).length, [leads]);
  const enquiryCount = useMemo(() => leads.filter((l) => !isCallbackLead(l) && !isContactUsLead(l)).length, [leads]);


  // Grouped by Property for "Property Views & Leads" View
  const groupedProperties = useMemo(() => {
    const map = new Map();

    for (const lead of filteredLeads) {
      const pid = String(lead.propertyId || lead.propertyTitle);
      if (!map.has(pid)) {
        map.set(pid, {
          propertyId: lead.propertyId,
          title: lead.propertyTitle,
          image: lead.propertyImage,
          price: lead.propertyPrice,
          city: lead.city,
          location: lead.propertyLocation,
          listingType: lead.listingType,
          propertyType: lead.propertyType,
          views: lead.views || 0,
          ownerName: lead.ownerName,
          ownerPhone: lead.ownerPhone,
          ownerEmail: lead.ownerEmail,
          enquiries: [],
        });
      }

      const p = map.get(pid);
      p.enquiries.push(lead);
    }

    return Array.from(map.values()).sort((a, b) => b.enquiries.length - a.enquiries.length);
  }, [filteredLeads]);

  // Delete lead handler (Super Admin only)
  const handleDeleteLead = async () => {
    if (!deletingLead) return;
    try {
      await adminService.deleteLead(deletingLead.id);
      setData((prev) => ({
        ...prev,
        results: prev.results.filter((x) => x.id !== deletingLead.id),
      }));
      toast.success('Enquiry lead removed.');
      setDeletingLead(null);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  // Delete all enquiry history for a user (Super Admin only)
  const handleDeleteUserHistory = async () => {
    if (!deletingUserHistory) return;
    try {
      const userKey = deletingUserHistory.senderId || deletingUserHistory.email || deletingUserHistory.key;
      await adminService.deleteUserEnquiryHistory(userKey);
      setData((prev) => ({
        ...prev,
        results: prev.results.filter((x) => {
          const k = x.senderId || (x.senderEmail ? x.senderEmail.toLowerCase() : null) || x.senderName;
          return k !== deletingUserHistory.key && k !== userKey && x.senderId !== userKey;
        }),
      }));
      toast.success(`All enquiry history for "${deletingUserHistory.name || 'User'}" deleted.`);
      setDeletingUserHistory(null);
      if (selectedUser?.key === deletingUserHistory.key) {
        setSelectedUser(null);
      }
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  // Listing type badge styling
  const getTypeBadge = (type) => {
    const s = String(type || '').toLowerCase();
    if (s.includes('rent')) return { bg: '#ecfdf5', color: '#059669', border: '#a7f3d0', label: 'Rent' };
    if (s.includes('lease')) return { bg: '#f5f3ff', color: '#7c3aed', border: '#ddd6fe', label: 'Lease' };
    if (s.includes('pg')) return { bg: '#fffbeb', color: '#d97706', border: '#fde68a', label: 'PG' };
    return { bg: '#E6F4EA', color: '#0D5F4E', border: '#A7F3D0', label: 'Sell' };
  };

  return (
    <>
      {/* ── Page Header ── */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Send size={24} style={{ color: 'var(--accent)' }} />
            Leads & Property Enquiries
          </h1>
          <span className="muted-text">
            Track user enquiries, prospective buyer/tenant leads, total enquiries sent per user, and property listing views.
          </span>
        </div>

        {/* View Switcher Tabs */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="seg">
            <button
              type="button"
              className={activeView === 'feed' ? 'on' : ''}
              onClick={() => setActiveView('feed')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Inbox size={15} /> All Enquiries ({filteredLeads.length})
            </button>
            <button
              type="button"
              className={activeView === 'users' ? 'on' : ''}
              onClick={() => setActiveView('users')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Users size={15} /> By User ({groupedUsers.length})
            </button>
            <button
              type="button"
              className={activeView === 'properties' ? 'on' : ''}
              onClick={() => setActiveView('properties')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Building2 size={15} /> By Property ({groupedProperties.length})
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI Stat Summary (Single Row of Small Boxes) ── */}
      {/* <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: '#eff6ff',
              color: '#2563eb',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          > */}
      {/* <MessageSquareText size={18} />
          </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', lineHeight: 1.2 }}>
                {stats.totalLeads ?? leads.length}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                Total Leads
              </div>
            </div>
        </div>

        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: '#f5f3ff',
              color: '#7c3aed',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <UserCheck size={18} />
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', lineHeight: 1.2 }}>
              {stats.uniqueUsers ?? groupedUsers.length}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              Unique Users
            </div>
          </div>
        </div>

        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: '#ecfeff',
              color: '#0891b2',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <Eye size={18} />
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', lineHeight: 1.2 }}>
              {stats.totalViews ?? 0}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              Property Views
            </div>
          </div>
        </div>

        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: '#ecfdf5',
              color: '#059669',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <TrendingUp size={18} />
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', lineHeight: 1.2 }}>
              {groupedUsers.length > 0 ? (leads.length / groupedUsers.length).toFixed(1) : '0'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              Avg Enquiries/User
            </div>
          </div>
        </div>
      </div> */}

      
      {/* ── Quick Filter KPI Pills (Enquiry vs Callback) ── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => setLeadTypeFilter('')}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: leadTypeFilter === '' ? '1.5px solid var(--accent, #0D5F4E)' : '1px solid var(--border)',
            background: leadTypeFilter === '' ? '#E6F4EA' : 'var(--surface)',
            color: leadTypeFilter === '' ? '#0D5F4E' : 'var(--text)',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Inbox size={15} /> All Leads ({leads.length})
        </button>

        <button
          type="button"
          onClick={() => setLeadTypeFilter('enquiry')}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: leadTypeFilter === 'enquiry' ? '1.5px solid #16a34a' : '1px solid var(--border)',
            background: leadTypeFilter === 'enquiry' ? '#f0fdf4' : 'var(--surface)',
            color: leadTypeFilter === 'enquiry' ? '#15803d' : 'var(--text)',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Send size={14} color="#15803d" /> Property Enquiries ({enquiryCount})
        </button>

        <button
          type="button"
          onClick={() => setLeadTypeFilter('callback')}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: leadTypeFilter === 'callback' ? '1.5px solid #d97706' : '1px solid var(--border)',
            background: leadTypeFilter === 'callback' ? '#fffbeb' : 'var(--surface)',
            color: leadTypeFilter === 'callback' ? '#b45309' : 'var(--text)',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <PhoneCall size={14} color="#b45309" /> Callback Requests ({callbackCount})
        </button>

        <button
          type="button"
          onClick={() => setLeadTypeFilter('contact_us')}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: leadTypeFilter === 'contact_us' ? '1.5px solid #0D5F4E' : '1px solid var(--border)',
            background: leadTypeFilter === 'contact_us' ? '#ecfdf5' : 'var(--surface)',
            color: leadTypeFilter === 'contact_us' ? '#065f46' : 'var(--text)',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <MessageSquareText size={14} color="#0D5F4E" /> Contact Us Submissions ({contactUsCount})
        </button>
      </div>

      {/* ── Filter & Search Toolbar ── */}
      <div className="card" style={{ padding: '14px 18px', marginBottom: 20 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          {/* Search Box */}
          <div style={{ flex: '1 1 280px', minWidth: 260 }}>
            <SearchBar
              value={q}
              onChange={setQ}
              placeholder="Search by user name, email, phone, property or message..."
            />
          </div>

          
          {/* Request Type Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <PhoneCall size={15} style={{ color: 'var(--muted)' }} />
            <select
              className="select"
              value={leadTypeFilter}
              onChange={(e) => setLeadTypeFilter(e.target.value)}
              style={{ padding: '7px 12px', fontSize: 13, fontWeight: 600 }}
            >
              <option value="">All Request Types</option>
              <option value="enquiry">✉️ Enquiries Only</option>
              <option value="callback">📞 Callbacks Only</option>
              <option value="contact_us">🌐 Contact Us Page Only</option>
            </select>
          </div>

          {/* Status Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={15} style={{ color: 'var(--muted)' }} />
            <select
              className="select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: '7px 12px', fontSize: 13, fontWeight: 600 }}
            >
              <option value="">All Statuses</option>
              {LEAD_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* Listing Type Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Tag size={15} style={{ color: 'var(--muted)' }} />
            <select
              className="select"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{ padding: '7px 12px', fontSize: 13 }}
            >
              <option value="">All Listing Types</option>
              <option value="Sell">Sell (For Sale)</option>
              <option value="Rent">Rent (For Rent)</option>
              <option value="Lease">Lease / Commercial</option>
              <option value="PG">PG / Co-Living</option>
            </select>
          </div>

          {/* Date Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={15} style={{ color: 'var(--muted)' }} />
            <select
              className="select"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              style={{ padding: '7px 12px', fontSize: 13 }}
            >
              <option value="all">All Time</option>
              <option value="today">Today (Last 24h)</option>
              <option value="week">This Week (Last 7d)</option>
              <option value="month">This Month (Last 30d)</option>
            </select>
          </div>

          {/* Reset Filters */}
          {(q || typeFilter || leadTypeFilter || statusFilter || dateFilter !== 'all') && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setQ('');
                setTypeFilter('');
                setLeadTypeFilter('');
                setStatusFilter('');
                setDateFilter('all');
              }}
              style={{ padding: '6px 12px' }}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* ── Content Area ── */}
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : filteredLeads.length === 0 ? (
        <Empty text="No property enquiries or leads match your current search and filters." />
      ) : activeView === 'feed' ? (
        /* ═══════════════════════════════════════════════════════════════════════
           VIEW 1: All Enquiries (Chronological Leads Table)
           ═══════════════════════════════════════════════════════════════════════ */
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Enquiring User (Lead)</th>
                  <th style={{ minWidth: 160 }}>Request Type</th>
                  <th style={{ minWidth: 165 }}>Status</th>
                  <th style={{ minWidth: 175 }}>Contact Us</th>
                  <th>Target Property</th>
                  <th>Views</th>
                  <th>Enquiry Message</th>
                  <th>Property Owner / Seller</th>
                  <th>Received</th>
                  <th className="right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead) => {
                  const typeBadge = getTypeBadge(lead.listingType);
                  const isMultiEnquiry = (lead.userTotalEnquiries || 1) > 1;

                  return (
                    <tr key={lead.id}>
                      {/* User Info */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: '50%',
                              backgroundColor: '#153c35',
                              color: '#fff',
                              display: 'grid',
                              placeItems: 'center',
                              fontWeight: 700,
                              fontSize: 13,
                              flexShrink: 0,
                            }}
                          >
                            {(lead.senderName || 'U')[0].toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>
                              {lead.senderName || 'Interested Buyer'}
                            </div>
                            {lead.senderEmail && (
                              <a
                                href={`mailto:${lead.senderEmail}`}
                                style={{
                                  fontSize: 11,
                                  color: 'var(--muted)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  textDecoration: 'none',
                                }}
                              >
                                <Mail size={11} /> {lead.senderEmail}
                              </a>
                            )}
                            {lead.senderPhone && (
                              <a
                                href={`tel:${lead.senderPhone}`}
                                style={{
                                  fontSize: 11,
                                  color: '#16a34a',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  fontWeight: 600,
                                  textDecoration: 'none',
                                  marginTop: 2,
                                }}
                              >
                                <PhoneCall size={11} /> {lead.senderPhone}
                              </a>
                            )}
                            {/* Total Enquiries Sent Badge */}
                            <button
                              type="button"
                              onClick={() => setSelectedUser(lead)}
                              style={{
                                border: 'none',
                                cursor: 'pointer',
                                background: isMultiEnquiry ? '#eff6ff' : '#f1f5f9',
                                color: isMultiEnquiry ? '#2563eb' : '#475569',
                                fontSize: 10,
                                fontWeight: 600,
                                padding: '2px 6px',
                                borderRadius: 10,
                                marginTop: 4,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                              }}
                              title="Click to view all properties enquired by this user"
                            >
                              <User size={10} />
                              {lead.userTotalEnquiries || 1} {lead.userTotalEnquiries === 1 ? 'enquiry sent' : 'enquiries sent'}
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Request Type Column */}
                      <td>
                        {isContactUsLead(lead) ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '5px 12px',
                              borderRadius: 999,
                              backgroundColor: '#ecfdf5',
                              border: '1.5px solid #a7f3d0',
                              color: '#065f46',
                              fontSize: 12,
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                            }}
                          >
                            <MessageSquareText size={13} strokeWidth={2.5} color="#065f46" />
                            Contact Us Form
                          </span>
                        ) : isCallbackLead(lead) ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '5px 12px',
                              borderRadius: 999,
                              backgroundColor: '#fffbeb',
                              border: '1.5px solid #fde68a',
                              color: '#b45309',
                              fontSize: 12,
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                            }}
                          >
                            <PhoneCall size={13} strokeWidth={2.5} color="#b45309" />
                            Request Callback
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '5px 12px',
                              borderRadius: 999,
                              backgroundColor: '#f0fdf4',
                              border: '1.5px solid #bbf7d0',
                              color: '#15803d',
                              fontSize: 12,
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                            }}
                          >
                            <Send size={12} strokeWidth={2.5} color="#15803d" />
                            Property Enquiry
                          </span>
                        )}
                      </td>

                      {/* Status Column */}
                      <td>
                        {(() => {
                          const currentStatus = lead.status || 'New';
                          const stStyle = getLeadStatusStyle(currentStatus);
                          return (
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                              <select
                                value={currentStatus}
                                onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                                style={{
                                  appearance: 'none',
                                  WebkitAppearance: 'none',
                                  padding: '5px 26px 5px 22px',
                                  borderRadius: 999,
                                  backgroundColor: stStyle.bg,
                                  border: `1.5px solid ${stStyle.border}`,
                                  color: stStyle.color,
                                  fontSize: 12,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  outline: 'none',
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                                  transition: 'all 0.15s ease',
                                }}
                                title="Click to update lead status"
                              >
                                {LEAD_STATUSES.map((st) => (
                                  <option key={st} value={st} style={{ background: '#fff', color: '#0f172a' }}>
                                    {st}
                                  </option>
                                ))}
                              </select>
                              {/* Status dot */}
                              <span
                                style={{
                                  position: 'absolute',
                                  left: 9,
                                  top: '50%',
                                  transform: 'translateY(-50%)',
                                  width: 7,
                                  height: 7,
                                  borderRadius: '50%',
                                  backgroundColor: stStyle.dot,
                                  pointerEvents: 'none',
                                }}
                              />
                              {/* Dropdown caret */}
                              <span
                                style={{
                                  position: 'absolute',
                                  right: 9,
                                  top: '50%',
                                  transform: 'translateY(-50%)',
                                  fontSize: 9,
                                  color: stStyle.color,
                                  pointerEvents: 'none',
                                  fontWeight: 900,
                                }}
                              >
                                ▼
                              </span>
                            </div>
                          );
                        })()}
                      </td>

                      {/* Contact Us Column */}
                      <td>
                        {isContactUsLead(lead) ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '4px 10px',
                                borderRadius: 999,
                                backgroundColor: '#ecfdf5',
                                border: '1.5px solid #a7f3d0',
                                color: '#065f46',
                                fontSize: 11.5,
                                fontWeight: 700,
                                whiteSpace: 'nowrap',
                                width: 'fit-content',
                              }}
                            >
                              <span
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: '50%',
                                  backgroundColor: '#10b981',
                                }}
                              />
                              Contact Us Page
                            </span>
                            {lead.contactUsSubject || lead.subject ? (
                              <span
                                style={{
                                  fontSize: 12,
                                  color: '#0f172a',
                                  fontWeight: 700,
                                  maxWidth: 200,
                                  lineHeight: 1.3,
                                }}
                                title={lead.contactUsSubject || lead.subject}
                              >
                                {lead.contactUsSubject || lead.subject}
                              </span>
                            ) : (
                              <span style={{ fontSize: 11, color: '#64748b' }}>
                                Website Direct Query
                              </span>
                            )}
                          </div>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '3px 8px',
                              borderRadius: 6,
                              backgroundColor: '#f1f5f9',
                              border: '1px solid #e2e8f0',
                              color: '#64748b',
                              fontSize: 11,
                              fontWeight: 600,
                            }}
                          >
                            Property Page
                          </span>
                        )}
                      </td>

                      {/* Property Info */}
                      <td style={{ maxWidth: 260 }}>
                        {isContactUsLead(lead) && (!lead.propertyId || String(lead.propertyTitle).includes('Contact Us')) ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: 8,
                                background: 'linear-gradient(135deg, #0D5F4E, #134E3A)',
                                color: '#fff',
                                display: 'grid',
                                placeItems: 'center',
                                flexShrink: 0,
                                boxShadow: '0 2px 6px rgba(13,95,78,0.2)',
                              }}
                            >
                              <MessageSquareText size={20} />
                            </div>
                            <div>
                              <strong style={{ fontSize: 13, color: '#0F172A', display: 'block' }}>
                                ProBridge Website
                              </strong>
                              <span
                                style={{
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: 4,
                                  background: '#ECFDF5',
                                  color: '#065F46',
                                  border: '1px solid #A7F3D0',
                                  display: 'inline-block',
                                  marginTop: 2,
                                }}
                              >
                                Contact Us Page
                              </span>
                              <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                                {lead.city || lead.propertyLocation || 'Website Form'}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <img
                              src={lead.propertyImage || ''}
                              alt=""
                              className="thumb-img"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                            <div>
                              <strong
                                style={{
                                  fontSize: 13,
                                  display: 'block',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  maxWidth: 180,
                                }}
                                title={lead.propertyTitle}
                              >
                                {lead.propertyTitle}
                              </strong>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--text)' }}>
                                  {lead.propertyPrice}
                                </span>
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 600,
                                    padding: '1px 6px',
                                    borderRadius: 4,
                                    background: typeBadge.bg,
                                    color: typeBadge.color,
                                    border: `1px solid ${typeBadge.border}`,
                                  }}
                                >
                                  {typeBadge.label}
                                </span>
                              </div>
                              <small className="muted-text" style={{ fontSize: 11 }}>
                                {lead.city || lead.propertyLocation || 'India'}
                              </small>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Views Count */}
                      <td>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '3px 8px',
                            borderRadius: 12,
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            fontSize: 12,
                            fontWeight: 600,
                            color: '#334155',
                          }}
                        >
                          <Eye size={13} style={{ color: '#0284c7' }} />
                          {lead.views || 0} views
                        </div>
                      </td>

                      {/* Enquiry Message / Comment */}
                      <td style={{ maxWidth: 280 }}>
                        <div
                          style={{
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: 8,
                            padding: '8px 10px',
                            fontSize: 12,
                            color: '#334155',
                            lineHeight: 1.4,
                            maxHeight: 70,
                            overflowY: 'auto',
                          }}
                        >
                          <MessageSquare size={12} style={{ color: '#64748b', marginRight: 4, verticalAlign: -1 }} />
                          {lead.message || lead.comment || 'Interested in this property.'}
                        </div>
                      </td>

                      {/* Owner Info */}
                      <td>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text)' }}>
                            {lead.ownerName || 'Property Owner'}
                          </div>
                          {lead.ownerPhone && (
                            <a
                              href={`tel:${lead.ownerPhone}`}
                              style={{
                                fontSize: 11,
                                color: '#16a34a',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 3,
                                textDecoration: 'none',
                                marginTop: 1,
                              }}
                            >
                              <Phone size={10} /> {lead.ownerPhone}
                            </a>
                          )}
                          {lead.ownerEmail && (
                            <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                              {lead.ownerEmail}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Date */}
                      <td>
                        <div style={{ fontSize: 12, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                          {formatRelativeTime(lead.createdAt)}
                        </div>
                        <small className="muted-text" style={{ fontSize: 10, whiteSpace: 'nowrap' }}>
                          {formatDate(lead.createdAt)}
                        </small>
                      </td>

                      {/* Actions */}
                      <td className="right">
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '5px 8px', fontSize: 11 }}
                            title="View all enquiries from this user"
                            onClick={() => setSelectedUser(lead)}
                          >
                            <User size={13} /> History
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '5px 8px', fontSize: 11 }}
                            title="View property details"
                            onClick={() => setSelectedProperty(lead)}
                          >
                            <Eye size={13} /> Property
                          </button>
                          {isSuperAdmin && (
                            <button
                              type="button"
                              className="icon-btn danger"
                              style={{ padding: '5px 6px' }}
                              title="Delete Enquiry (Super Admin only)"
                              onClick={() => setDeletingLead(lead)}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeView === 'users' ? (
        /* ═══════════════════════════════════════════════════════════════════════
           VIEW 2: By User (Lead Profiles & Enquiries History)
           ═══════════════════════════════════════════════════════════════════════ */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
          {groupedUsers.map((u) => (
            <div
              key={u.key}
              className="card"
              style={{
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                borderRadius: 12,
                border: '1px solid var(--border)',
              }}
            >
              {/* User Profile Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: '50%',
                      backgroundColor: '#153c35',
                      color: '#fff',
                      display: 'grid',
                      placeItems: 'center',
                      fontWeight: 700,
                      fontSize: 16,
                      flexShrink: 0,
                    }}
                  >
                    {(u.name || 'U')[0].toUpperCase()}
                  </div>
                  <div>
                    <strong style={{ fontSize: 14, color: 'var(--text)' }}>
                      {u.name || 'Interested Buyer'}
                    </strong>
                    {u.email && (
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                        {u.email}
                      </div>
                    )}
                    {u.phone && (
                      <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>
                        {u.phone}
                      </div>
                    )}
                  </div>
                </div>

                {/* Total Enquiries Count Badge */}
                <div
                  style={{
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    color: '#2563eb',
                    borderRadius: 12,
                    padding: '4px 10px',
                    fontSize: 12,
                    fontWeight: 700,
                    textAlign: 'center',
                  }}
                >
                  {u.totalEnquiries} {u.totalEnquiries === 1 ? 'Enquiry' : 'Enquiries'}
                </div>
              </div>

              {/* Quick Actions (Call / Email / Delete History) */}
              <div style={{ display: 'flex', gap: 8 }}>
                {u.phone && (
                  <a
                    href={`tel:${u.phone}`}
                    className="btn btn-secondary btn-sm"
                    style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 11 }}
                  >
                    <PhoneCall size={12} /> Call User
                  </a>
                )}
                {u.email && (
                  <a
                    href={`mailto:${u.email}`}
                    className="btn btn-secondary btn-sm"
                    style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 11 }}
                  >
                    <Mail size={12} /> Email User
                  </a>
                )}
                {isSuperAdmin && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ color: '#dc2626', borderColor: '#fca5a5', padding: '5px 8px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    title="Delete all enquiry history for this user (Super Admin only)"
                    onClick={() => setDeletingUserHistory(u)}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>

              {/* Enquired Properties List */}
              <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                  Enquired Properties ({u.enquiries.length})
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
                  {u.enquiries.map((enq) => {
                    const badge = getTypeBadge(enq.listingType);
                    return (
                      <div
                        key={enq.id}
                        style={{
                          background: '#f8fafc',
                          borderRadius: 8,
                          padding: '8px 10px',
                          border: '1px solid #e2e8f0',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                          <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {enq.propertyTitle}
                          </span>
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              padding: '1px 5px',
                              borderRadius: 4,
                              background: badge.bg,
                              color: badge.color,
                            }}
                          >
                            {badge.label}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
                          <span style={{ fontWeight: 700, color: 'var(--accent)' }}>
                            {enq.propertyPrice}
                          </span>
                          <span style={{ color: 'var(--muted)', fontSize: 10 }}>
                            {formatRelativeTime(enq.createdAt)}
                          </span>
                        </div>

                        {enq.message && (
                          <div style={{ fontSize: 11, color: '#475569', fontStyle: 'italic', marginTop: 2 }}>
                            "{enq.message}"
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ═══════════════════════════════════════════════════════════════════════
           VIEW 3: By Property (Views & Enquiries Performance)
           ═══════════════════════════════════════════════════════════════════════ */
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Listing Type</th>
                  <th>Price</th>
                  <th>Total Views</th>
                  <th>Total Enquiries</th>
                  <th>Persons Enquired</th>
                  <th>Property Owner</th>
                  <th className="right">Action</th>
                </tr>
              </thead>
              <tbody>
                {groupedProperties.map((p) => {
                  const typeBadge = getTypeBadge(p.listingType);
                  const views = p.views || 0;
                  const enquiryCount = p.enquiries.length;
                  const uniquePersons = new Set(
                    p.enquiries.map((e) => e.senderId || (e.senderEmail ? e.senderEmail.toLowerCase() : null) || e.senderName)
                  ).size;

                  return (
                    <tr key={p.propertyId || p.title}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <img
                            src={p.image || ''}
                            alt=""
                            className="thumb-img"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                          <div>
                            <strong style={{ fontSize: 13, display: 'block' }}>
                              {p.title}
                            </strong>
                            <small className="muted-text">
                              {p.city || p.location || 'India'}
                            </small>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: typeBadge.bg,
                            color: typeBadge.color,
                            border: `1px solid ${typeBadge.border}`,
                          }}
                        >
                          {typeBadge.label}
                        </span>
                      </td>

                      <td style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>
                        {p.price}
                      </td>

                      {/* Views */}
                      <td>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            fontWeight: 700,
                            color: '#0284c7',
                            fontSize: 13,
                          }}
                        >
                          <Eye size={14} /> {views}
                        </div>
                      </td>

                      {/* Enquiries */}
                      <td>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            fontWeight: 700,
                            color: '#2563eb',
                            fontSize: 13,
                          }}
                        >
                          <MessageSquareText size={14} /> {enquiryCount}
                        </div>
                      </td>

                      {/* Persons Enquired */}
                      <td>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            fontWeight: 700,
                            color: uniquePersons > 0 ? '#16a34a' : 'var(--muted)',
                            fontSize: 13,
                          }}
                        >
                          <Users size={14} /> {uniquePersons}
                        </div>
                      </td>

                      {/* Owner */}
                      <td>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{p.ownerName || 'Owner'}</div>
                        {p.ownerPhone && (
                          <div style={{ fontSize: 11, color: '#16a34a' }}>{p.ownerPhone}</div>
                        )}
                      </td>

                      {/* Action */}
                      <td className="right">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: 11, padding: '5px 10px' }}
                          onClick={() => setSelectedProperty(p.enquiries[0] || p)}
                        >
                          <Eye size={12} /> View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── User Enquiry History Modal ── */}
      {selectedUser && (
        <UserEnquiryHistoryModal
          userLead={selectedUser}
          allLeads={leads}
          isSuperAdmin={isSuperAdmin}
          onClose={() => setSelectedUser(null)}
          onViewProperty={(p) => {
            setSelectedUser(null);
            setSelectedProperty(p);
          }}
          onDeleteLead={(lead) => setDeletingLead(lead)}
          onClearUserHistory={(u) => setDeletingUserHistory(u)}
        />
      )}

      {/* ── Property Details Preview Modal ── */}
      {selectedProperty && (
        <PropertyPreviewModal
          propertyLead={selectedProperty}
          onClose={() => setSelectedProperty(null)}
        />
      )}

      {/* ── Confirm Delete Enquiry Dialog (Super Admin only) ── */}
      {deletingLead && (
        <ConfirmDialog
          danger
          title="Delete Enquiry Lead?"
          confirmLabel="Delete Lead"
          message={`Are you sure you want to remove the enquiry from "${deletingLead.senderName}" for "${deletingLead.propertyTitle}"?`}
          onConfirm={handleDeleteLead}
          onClose={() => setDeletingLead(null)}
        />
      )}

      {/* ── Confirm Delete User Enquiry History Dialog (Super Admin only) ── */}
      {deletingUserHistory && (
        <ConfirmDialog
          danger
          title="Delete All Enquiry History?"
          confirmLabel="Delete All History"
          message={`Are you sure you want to delete ALL enquiry history sent by "${deletingUserHistory.name || 'this user'}"? This action is permanent and cannot be undone.`}
          onConfirm={handleDeleteUserHistory}
          onClose={() => setDeletingUserHistory(null)}
        />
      )}
    </>
  );
}

// ─── User Enquiry History Modal ───────────────────────────────────────────────
function UserEnquiryHistoryModal({
  userLead,
  allLeads,
  isSuperAdmin,
  onClose,
  onViewProperty,
  onDeleteLead,
  onClearUserHistory,
}) {
  const userKey = userLead.senderId || (userLead.senderEmail ? userLead.senderEmail.toLowerCase() : null) || userLead.senderName;
  const userEnquiries = (allLeads || []).filter((l) => {
    const key = l.senderId || (l.senderEmail ? l.senderEmail.toLowerCase() : null) || l.senderName;
    return key === userKey;
  });

  return (
    <Modal title={`Enquiry History: ${userLead.senderName || 'Interested Buyer'}`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* User Card */}
        <div
          style={{
            background: 'var(--grey-soft)',
            padding: 14,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: '#153c35',
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 700,
                fontSize: 16,
              }}
            >
              {(userLead.senderName || 'U')[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
                {userLead.senderName || 'Interested Buyer'}
              </div>
              {userLead.senderEmail && (
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {userLead.senderEmail}
                </div>
              )}
              {userLead.senderPhone && (
                <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
                  {userLead.senderPhone}
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              textAlign: 'center',
              padding: '6px 14px',
              borderRadius: 10,
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              color: '#2563eb',
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 800 }}>{userEnquiries.length}</div>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>
              Total Enquiries
            </div>
          </div>
        </div>

        {/* List of properties enquired */}
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: 'var(--text)' }}>
            All Properties Enquired by this User ({userEnquiries.length})
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 380, overflowY: 'auto' }}>
            {userEnquiries.map((enq) => (
              <div
                key={enq.id}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: 10,
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {isContactUsLead(enq) ? (
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 8,
                          background: 'linear-gradient(135deg, #0D5F4E, #134E3A)',
                          color: '#fff',
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <MessageSquareText size={20} />
                      </div>
                    ) : (
                      <img
                        src={enq.propertyImage || ''}
                        alt=""
                        style={{ width: 48, height: 48, borderRadius: 6, objectFit: 'cover' }}
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    )}
                    <div>
                      <strong style={{ fontSize: 13, color: 'var(--text)' }}>
                        {enq.propertyTitle}
                      </strong>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        {isContactUsLead(enq) ? (
                          <span
                            style={{
                              fontSize: 10.5,
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: 4,
                              background: '#ECFDF5',
                              color: '#065F46',
                              border: '1px solid #A7F3D0',
                            }}
                          >
                            Contact Us Submission • {enq.contactUsSubject || enq.subject || 'Website Inquiry'}
                          </span>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700 }}>
                            {enq.propertyPrice} • <span style={{ color: 'var(--muted)', fontWeight: 400 }}>{enq.city || 'India'}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {(() => {
                      const st = enq.status || 'New';
                      const stStyle = getLeadStatusStyle(st);
                      return (
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: 999,
                            backgroundColor: stStyle.bg,
                            border: `1px solid ${stStyle.border}`,
                            color: stStyle.color,
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {st}
                        </span>
                      );
                    })()}
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {formatDate(enq.createdAt)}
                    </span>
                  </div>
                </div>

                {enq.message && (
                  <div
                    style={{
                      background: '#f8fafc',
                      padding: '8px 10px',
                      borderRadius: 6,
                      fontSize: 12,
                      color: '#334155',
                      borderLeft: '3px solid var(--accent, #0D5F4E)',
                    }}
                  >
                    "{enq.message}"
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: 'var(--muted)' }}>
                    Seller: <strong>{enq.ownerName || 'Owner'}</strong> {enq.ownerPhone ? `(${enq.ownerPhone})` : ''}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: 10, padding: '3px 8px' }}
                      onClick={() => onViewProperty(enq)}
                    >
                      View Property
                    </button>
                    {isSuperAdmin && (
                      <button
                        type="button"
                        className="icon-btn danger"
                        style={{ padding: '3px 5px' }}
                        title="Delete Enquiry (Super Admin only)"
                        onClick={() => onDeleteLead(enq)}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
          {isSuperAdmin && userEnquiries.length > 0 ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ color: '#dc2626', borderColor: '#fca5a5', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}
              onClick={() => onClearUserHistory(userLead)}
            >
              <Trash2 size={13} /> Delete All User History
            </button>
          ) : <div />}
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Property Details Preview Modal ───────────────────────────────────────────
function PropertyPreviewModal({ propertyLead, onClose }) {
  const p = propertyLead;

  return (
    <Modal title={`Property: ${p.propertyTitle || p.title}`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Image */}
        {(p.propertyImage || p.image) && (
          <div style={{ width: '100%', height: 220, borderRadius: 10, overflow: 'hidden' }}>
            <img
              src={p.propertyImage || p.image}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        )}

        {/* Basic Details */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, color: 'var(--text)' }}>
              {p.propertyTitle || p.title}
            </h3>
            <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <MapPin size={12} /> {p.city || p.location || p.propertyLocation || 'India'}
            </div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#153c35' }}>
            {p.propertyPrice || p.price}
          </div>
        </div>

        {/* Views & Enquiries Bar */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            padding: 10,
            borderRadius: 8,
            background: 'var(--grey-soft)',
          }}
        >
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0284c7' }}>
              {p.views || 0}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>Listing Views</div>
          </div>
          <div style={{ width: 1, background: 'var(--border)' }} />
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent, #0D5F4E)' }}>
              {p.listingType || 'Sell'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>Listing Type</div>
          </div>
          <div style={{ width: 1, background: 'var(--border)' }} />
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#16a34a' }}>
              {p.propertyType || 'Apartment'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>Property Type</div>
          </div>
        </div>

        {/* Seller Info */}
        <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
            Seller / Owner Contact
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginTop: 4 }}>
            {p.ownerName || 'Property Owner'}
          </div>
          {p.ownerPhone && (
            <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
              Phone: {p.ownerPhone}
            </div>
          )}
          {p.ownerEmail && (
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Email: {p.ownerEmail}
            </div>
          )}
        </div>

        {/* Action Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 8 }}>
          {p.propertyId && (
            <Link
              to={`/properties/${p.propertyId}`}
              className="btn btn-secondary"
              onClick={onClose}
            >
              Full Property Details
            </Link>
          )}
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

