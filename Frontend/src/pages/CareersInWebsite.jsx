import { useMemo, useState, useEffect, useRef } from 'react';
import {
  Briefcase,
  Users,
  Plus,
  Search,
  Filter,
  Eye,
  Trash2,
  Edit2,
  Mail,
  Phone,
  FileText,
  Download,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building2,
  MapPin,
  RefreshCw,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Send,
  X,
  Upload,
  Image as ImageIcon,
} from 'lucide-react';
import Modal from '../components/Modal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { Empty, Loading } from '../components/StateBlock.jsx';
import { adminService } from '../services/adminService.js';
import { useToast } from '../context/ToastContext.jsx';
import { formatDate } from '../utils/format.js';
import api from '../services/api.js';

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'elrw6gnd';
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'probridge';
const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

async function uploadCareerImage(file) {
  // 1. Direct Cloudinary unsigned upload
  if (CLOUD_NAME && UPLOAD_PRESET) {
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('upload_preset', UPLOAD_PRESET);
      form.append('folder', 'probridge/careers');
      const res = await fetch(CLOUDINARY_URL, { method: 'POST', body: form });
      const data = await res.json();
      if (res.ok && (data.secure_url || data.url)) {
        return data.secure_url || data.url;
      }
    } catch (e) {
      console.warn('[Cloudinary upload fallback]', e.message);
    }
  }

  // 2. Backend /api/upload/image
  try {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('type', 'career');
    const uploadRes = await api.post('/api/upload/image', formData);
    if (uploadRes.data?.url) return uploadRes.data.url;
  } catch (backendErr) {
    console.warn('[Backend upload fallback]', backendErr.message);
  }

  // 3. Fallback: Base64 data URI
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

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

const DEPARTMENTS = [
  'Advisory & Sales',
  'Technology & Product',
  'Field Operations',
  'Marketing',
  'Customer Support',
  'Finance & Accounts',
  'Legal & Compliance',
  'Human Resources',
];

const JOB_TYPES = ['Full-time', 'Part-time', 'Remote / Hybrid', 'Contract', 'Internship'];

export default function CareersInWebsite() {
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('applications'); // 'applications' | 'careers'
  const [loading, setLoading] = useState(true);
  const [careers, setCareers] = useState([]);
  const [applications, setApplications] = useState([]);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals state
  const [showCareerModal, setShowCareerModal] = useState(false);
  const [editingCareer, setEditingCareer] = useState(null);
  const [savingCareer, setSavingCareer] = useState(false);

  const [selectedApp, setSelectedApp] = useState(null);
  const [updatingAppStatus, setUpdatingAppStatus] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(null); // { type: 'career' | 'application', item: obj }

  // Image Upload State
  const fileInputRef = useRef(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState('');

  // Form state for Career Add / Edit
  const [careerForm, setCareerForm] = useState({
    title: '',
    department: DEPARTMENTS[0],
    location: 'Chennai & Bengaluru',
    type: 'Full-time',
    experience: '1-3 years',
    salary: 'Competitive',
    image: '',
    description: '',
    requirements: '',
    openings: 1,
    status: 'active',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [careersRes, appsRes] = await Promise.all([
        adminService.listCareers(),
        adminService.listCareerApplications(),
      ]);
      setCareers(Array.isArray(careersRes) ? careersRes : []);
      setApplications(Array.isArray(appsRes) ? appsRes : []);
    } catch (err) {
      toast.error('Failed to load careers data: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Stats calculation
  const stats = useMemo(() => {
    const totalApps = applications.length;
    const newApps = applications.filter((a) => a.status === 'new').length;
    const shortlistedApps = applications.filter((a) => a.status === 'shortlisted').length;
    const activeCareers = careers.filter((c) => c.status === 'active').length;
    const totalCareers = careers.length;

    return { totalApps, newApps, shortlistedApps, activeCareers, totalCareers };
  }, [applications, careers]);

  // Filtered Applications
  const filteredApps = useMemo(() => {
    return applications.filter((app) => {
      const q = searchQuery.toLowerCase().trim();
      const matchQ =
        !q ||
        (app.name && app.name.toLowerCase().includes(q)) ||
        (app.email && app.email.toLowerCase().includes(q)) ||
        (app.phone && app.phone.toLowerCase().includes(q)) ||
        (app.roleTitle && app.roleTitle.toLowerCase().includes(q));

      const matchRole = roleFilter === 'all' || (app.roleTitle && app.roleTitle.toLowerCase() === roleFilter.toLowerCase());
      const matchStatus = statusFilter === 'all' || app.status === statusFilter;

      return matchQ && matchRole && matchStatus;
    });
  }, [applications, searchQuery, roleFilter, statusFilter]);

  // Filtered Careers
  const filteredCareers = useMemo(() => {
    return careers.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      const matchQ =
        !q ||
        (c.title && c.title.toLowerCase().includes(q)) ||
        (c.department && c.department.toLowerCase().includes(q)) ||
        (c.location && c.location.toLowerCase().includes(q));

      const matchStatus = statusFilter === 'all' || c.status === statusFilter;
      return matchQ && matchStatus;
    });
  }, [careers, searchQuery, statusFilter]);

  // Handle open Add Career Modal
  const handleOpenAddCareer = () => {
    setEditingCareer(null);
    setImagePreview('');
    setCareerForm({
      title: '',
      department: DEPARTMENTS[0],
      location: 'Chennai & Bengaluru',
      type: 'Full-time',
      experience: '1-3 years',
      salary: 'Competitive',
      image: '',
      description: '',
      requirements: '',
      openings: 1,
      status: 'active',
    });
    setShowCareerModal(true);
  };

  // Handle open Edit Career Modal
  const handleOpenEditCareer = (career) => {
    setEditingCareer(career);
    setImagePreview(career.image || '');
    setCareerForm({
      title: career.title || '',
      department: career.department || DEPARTMENTS[0],
      location: career.location || 'Chennai & Bengaluru',
      type: career.type || 'Full-time',
      experience: career.experience || '1-3 years',
      salary: career.salary || 'Competitive',
      image: career.image || '',
      description: career.description || '',
      requirements: Array.isArray(career.requirements) ? career.requirements.join('\n') : (career.requirements || ''),
      openings: career.openings || 1,
      status: career.status || 'active',
    });
    setShowCareerModal(true);
  };

  // Image upload handler
  const handleImageFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (PNG, JPG, WebP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be under 5MB');
      return;
    }

    setUploadingImage(true);
    try {
      const url = await uploadCareerImage(file);
      if (url) {
        setCareerForm((prev) => ({ ...prev, image: url }));
        setImagePreview(url);
        toast.success('Career image uploaded successfully!');
      } else {
        toast.error('Could not process image');
      }
    } catch (err) {
      toast.error('Failed to upload image: ' + err.message);
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = () => {
    setCareerForm((prev) => ({ ...prev, image: '' }));
    setImagePreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Save Career (Add or Edit)
  const handleSaveCareer = async (e) => {
    e.preventDefault();
    if (!careerForm.title.trim()) {
      toast.error('Career title is required');
      return;
    }

    setSavingCareer(true);
    try {
      const payload = {
        ...careerForm,
        requirements: careerForm.requirements
          .split('\n')
          .map((r) => r.trim())
          .filter(Boolean),
      };

      if (editingCareer) {
        await adminService.updateCareer(editingCareer.id || editingCareer._id, payload);
        toast.success(`Career "${careerForm.title}" updated successfully!`);
      } else {
        await adminService.createCareer(payload);
        toast.success(`Career "${careerForm.title}" created & published to website!`);
      }

      setShowCareerModal(false);
      loadData();
    } catch (err) {
      toast.error('Failed to save career: ' + (err.message || 'Unknown error'));
    } finally {
      setSavingCareer(false);
    }
  };

  // Toggle Career Status
  const handleToggleCareerStatus = async (career) => {
    const nextStatus = career.status === 'active' ? 'inactive' : 'active';
    try {
      await adminService.updateCareer(career.id || career._id, { status: nextStatus });
      toast.success(`Career status set to ${nextStatus === 'active' ? 'Active (Live)' : 'Inactive (Hidden)'}`);
      setCareers((prev) =>
        prev.map((c) => (String(c.id || c._id) === String(career.id || career._id) ? { ...c, status: nextStatus } : c))
      );
    } catch (err) {
      toast.error('Failed to update career status: ' + err.message);
    }
  };

  // Delete Career
  const handleDeleteCareer = async (career) => {
    try {
      await adminService.deleteCareer(career.id || career._id);
      toast.success('Career deleted successfully');
      setConfirmDelete(null);
      loadData();
    } catch (err) {
      toast.error('Failed to delete career: ' + err.message);
    }
  };

  // Update Application Status
  const handleUpdateAppStatus = async (appId, newStatus, newNotes) => {
    setUpdatingAppStatus(true);
    try {
      await adminService.updateCareerApplicationStatus(appId, newStatus, newNotes);
      toast.success(`Application status updated to "${newStatus}"`);
      setApplications((prev) =>
        prev.map((a) => (String(a.id || a._id) === String(appId) ? { ...a, status: newStatus, notes: newNotes ?? a.notes } : a))
      );
      if (selectedApp && String(selectedApp.id || selectedApp._id) === String(appId)) {
        setSelectedApp((prev) => ({ ...prev, status: newStatus, notes: newNotes ?? prev.notes }));
      }
    } catch (err) {
      toast.error('Failed to update status: ' + err.message);
    } finally {
      setUpdatingAppStatus(false);
    }
  };

  // Delete Application
  const handleDeleteApp = async (app) => {
    try {
      await adminService.deleteCareerApplication(app.id || app._id);
      toast.success('Application deleted successfully');
      setConfirmDelete(null);
      if (selectedApp && String(selectedApp.id || selectedApp._id) === String(app.id || app._id)) {
        setSelectedApp(null);
      }
      loadData();
    } catch (err) {
      toast.error('Failed to delete application: ' + err.message);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'new':
        return <span className="badge badge-amber" style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' }}>New</span>;
      case 'reviewed':
        return <span className="badge badge-blue" style={{ background: '#EFF6FF', color: '#1E40AF', border: '1px solid #BFDBFE' }}>Reviewed</span>;
      case 'shortlisted':
        return <span className="badge badge-green" style={{ background: '#DCFCE7', color: '#166534', border: '1px solid #BBF7D0' }}>Shortlisted</span>;
      case 'rejected':
        return <span className="badge badge-red" style={{ background: '#FEE2E2', color: '#991B1B', border: '1px solid #FECACA' }}>Rejected</span>;
      case 'hired':
        return <span className="badge" style={{ background: '#F3E8FF', color: '#6B21A8', border: '1px solid #E9D5FF' }}>Hired 🎉</span>;
      default:
        return <span className="badge badge-gray">{status}</span>;
    }
  };

  return (
    <div className="page" style={{ paddingBottom: 40 }}>
      {/* ── Top Header ── */}
      <div className="page-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #0D5F4E, #134E3A)',
                display: 'grid',
                placeItems: 'center',
                color: '#fff',
                boxShadow: '0 4px 12px rgba(13, 95, 78, 0.25)',
              }}
            >
              <Briefcase size={22} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.4px' }}>
                Careers in Website
              </h1>
              <p style={{ margin: 0, fontSize: 13, color: '#64748B' }}>
                Manage live website job postings and review applicant submissions
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn btn-outline" onClick={loadData} title="Refresh Data">
            <RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={handleOpenAddCareer} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Plus size={16} /> Add New Career
          </button>
        </div>
      </div>

      {/* ── Stats Summary Grid ── */}
      <div className="grid-stats" style={{ marginTop: 20, marginBottom: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <div className="stat-card" style={{ background: '#fff', padding: '16px 20px', borderRadius: 14, border: '1px solid #E8EDF3' }}>
          <div className="stat-icon" style={{ background: '#EFF6FF', color: '#1E40AF', width: 38, height: 38, borderRadius: 10, display: 'grid', placeItems: 'center' }}>
            <Users size={20} />
          </div>
          <div className="stat-value" style={{ fontSize: 24, fontWeight: 800, marginTop: 10, color: '#0F172A' }}>
            {stats.totalApps}
          </div>
          <div className="stat-label" style={{ fontSize: 12.5, fontWeight: 600, color: '#64748B' }}>Total Applications</div>
        </div>

        <div className="stat-card" style={{ background: '#fff', padding: '16px 20px', borderRadius: 14, border: '1px solid #E8EDF3' }}>
          <div className="stat-icon" style={{ background: '#FEF3C7', color: '#B45309', width: 38, height: 38, borderRadius: 10, display: 'grid', placeItems: 'center' }}>
            <Sparkles size={20} />
          </div>
          <div className="stat-value" style={{ fontSize: 24, fontWeight: 800, marginTop: 10, color: '#B45309' }}>
            {stats.newApps}
          </div>
          <div className="stat-label" style={{ fontSize: 12.5, fontWeight: 600, color: '#64748B' }}>New / Unreviewed</div>
        </div>

        <div className="stat-card" style={{ background: '#fff', padding: '16px 20px', borderRadius: 14, border: '1px solid #E8EDF3' }}>
          <div className="stat-icon" style={{ background: '#DCFCE7', color: '#166534', width: 38, height: 38, borderRadius: 10, display: 'grid', placeItems: 'center' }}>
            <CheckCircle2 size={20} />
          </div>
          <div className="stat-value" style={{ fontSize: 24, fontWeight: 800, marginTop: 10, color: '#166534' }}>
            {stats.shortlistedApps}
          </div>
          <div className="stat-label" style={{ fontSize: 12.5, fontWeight: 600, color: '#64748B' }}>Shortlisted Candidates</div>
        </div>

        <div className="stat-card" style={{ background: '#fff', padding: '16px 20px', borderRadius: 14, border: '1px solid #E8EDF3' }}>
          <div className="stat-icon" style={{ background: '#ECFDF5', color: '#0D5F4E', width: 38, height: 38, borderRadius: 10, display: 'grid', placeItems: 'center' }}>
            <Briefcase size={20} />
          </div>
          <div className="stat-value" style={{ fontSize: 24, fontWeight: 800, marginTop: 10, color: '#0D5F4E' }}>
            {stats.activeCareers} <span style={{ fontSize: 14, color: '#94A3B8', fontWeight: 500 }}>/ {stats.totalCareers}</span>
          </div>
          <div className="stat-label" style={{ fontSize: 12.5, fontWeight: 600, color: '#64748B' }}>Active Live Careers</div>
        </div>
      </div>

      {/* ── Main Container ── */}
      <div className="card" style={{ background: '#fff', borderRadius: 16, border: '1px solid #E8EDF3', overflow: 'hidden' }}>
        {/* Navigation Tabs Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', borderBottom: '1px solid #E2E8F0', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => { setActiveTab('applications'); setSearchQuery(''); setStatusFilter('all'); }}
              style={{
                padding: '16px 18px',
                border: 'none',
                background: 'none',
                borderBottom: activeTab === 'applications' ? '3px solid #0D5F4E' : '3px solid transparent',
                color: activeTab === 'applications' ? '#0D5F4E' : '#64748B',
                fontWeight: activeTab === 'applications' ? 800 : 600,
                fontSize: 14,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Users size={16} /> Applications Received
              {stats.newApps > 0 && (
                <span style={{ background: '#DC2626', color: '#fff', fontSize: 11, fontWeight: 800, padding: '1px 7px', borderRadius: 999 }}>
                  {stats.newApps}
                </span>
              )}
            </button>

            <button
              onClick={() => { setActiveTab('careers'); setSearchQuery(''); setStatusFilter('all'); }}
              style={{
                padding: '16px 18px',
                border: 'none',
                background: 'none',
                borderBottom: activeTab === 'careers' ? '3px solid #0D5F4E' : '3px solid transparent',
                color: activeTab === 'careers' ? '#0D5F4E' : '#64748B',
                fontWeight: activeTab === 'careers' ? 800 : 600,
                fontSize: 14,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Briefcase size={16} /> Job Postings on Website ({careers.length})
            </button>
          </div>
        </div>

        {/* Filters and Search Strip */}
        <div style={{ padding: '16px 20px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1', minWidth: 240 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
            <input
              type="text"
              placeholder={activeTab === 'applications' ? 'Search applicant by name, email, phone or role...' : 'Search career by title, department, or city...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="textInput"
              style={{ paddingLeft: 36, width: '100%', height: 38, borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }}
            />
          </div>

          {activeTab === 'applications' && (
            <>
              {/* Role Filter */}
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                style={{ height: 38, padding: '0 12px', borderRadius: 8, border: '1px solid #CBD5E1', background: '#fff', fontSize: 13, color: '#334155' }}
              >
                <option value="all">All Roles</option>
                {Array.from(new Set(careers.map((c) => c.title))).map((title) => (
                  <option key={title} value={title}>{title}</option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ height: 38, padding: '0 12px', borderRadius: 8, border: '1px solid #CBD5E1', background: '#fff', fontSize: 13, color: '#334155' }}
              >
                <option value="all">All Statuses</option>
                <option value="new">New</option>
                <option value="reviewed">Reviewed</option>
                <option value="shortlisted">Shortlisted</option>
                <option value="rejected">Rejected</option>
                <option value="hired">Hired</option>
              </select>
            </>
          )}

          {activeTab === 'careers' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ height: 38, padding: '0 12px', borderRadius: 8, border: '1px solid #CBD5E1', background: '#fff', fontSize: 13, color: '#334155' }}
            >
              <option value="all">All Careers</option>
              <option value="active">Active (Visible on Website)</option>
              <option value="inactive">Inactive (Hidden)</option>
            </select>
          )}

          {(searchQuery || statusFilter !== 'all' || roleFilter !== 'all') && (
            <button
              className="btn btn-sm btn-outline"
              onClick={() => { setSearchQuery(''); setStatusFilter('all'); setRoleFilter('all'); }}
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* ── Content View ── */}
        {loading ? (
          <div style={{ padding: 40 }}><Loading message="Loading careers and applications..." /></div>
        ) : activeTab === 'applications' ? (
          /* TAB 1: APPLICATIONS LIST */
          filteredApps.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center' }}>
              <Users size={48} style={{ color: '#94A3B8', margin: '0 auto 12px' }} />
              <h3 style={{ margin: 0, fontSize: 18, color: '#0F172A', fontWeight: 700 }}>No Applications Found</h3>
              <p style={{ margin: '6px 0 0', color: '#64748B', fontSize: 13 }}>
                {applications.length === 0
                  ? 'When users apply on the website "Careers" page, their details and resumes will appear here.'
                  : 'Try clearing your search query or status filter.'}
              </p>
            </div>
          ) : (
            <div className="table-wrap" style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13.5 }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1.5px solid #E2E8F0', color: '#475569', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    <th style={{ padding: '12px 20px' }}>Candidate Details</th>
                    <th style={{ padding: '12px 16px' }}>Applied Position</th>
                    <th style={{ padding: '12px 16px' }}>Experience</th>
                    <th style={{ padding: '12px 16px' }}>Applied Date</th>
                    <th style={{ padding: '12px 16px' }}>Resume</th>
                    <th style={{ padding: '12px 16px' }}>Status</th>
                    <th style={{ padding: '12px 20px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApps.map((app) => (
                    <tr
                      key={app.id || app._id}
                      style={{
                        borderBottom: '1px solid #F1F5F9',
                        transition: 'background 0.15s',
                        background: app.status === 'new' ? '#FFFBEB' : 'transparent',
                      }}
                    >
                      {/* Candidate */}
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: '50%',
                              background: '#E0E7FF',
                              color: '#3730A3',
                              fontWeight: 700,
                              fontSize: 14,
                              display: 'grid',
                              placeItems: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {(app.name || 'C')[0]?.toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: '#0F172A', fontSize: 14 }}>{app.name}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2, fontSize: 12, color: '#64748B' }}>
                              <a href={`mailto:${app.email}`} style={{ color: '#0D5F4E', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                <Mail size={12} /> {app.email}
                              </a>
                              {app.phone && (
                                <span style={{ color: '#64748B', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                  <Phone size={12} /> {app.phone}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Position */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 600, color: '#1E293B' }}>{app.roleTitle}</div>
                        {app.career?.department && (
                          <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>{app.career.department}</div>
                        )}
                      </td>

                      {/* Experience */}
                      <td style={{ padding: '14px 16px', color: '#475569', fontSize: 12.5 }}>
                        {app.experience || '—'}
                      </td>

                      {/* Date */}
                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600, color: '#334155' }}>{formatRelativeTime(app.createdAt)}</div>
                        <div style={{ fontSize: 11, color: '#94A3B8' }}>{formatDate(app.createdAt)}</div>
                      </td>

                      {/* Resume */}
                      <td style={{ padding: '14px 16px' }}>
                        {app.resumeUrl ? (
                          <a
                            href={app.resumeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-sm btn-outline"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', fontSize: 12 }}
                            title="Download / View Resume"
                          >
                            <FileText size={13} color="#0D5F4E" /> View CV
                          </a>
                        ) : (
                          <span style={{ fontSize: 12, color: '#94A3B8' }}>{app.resumeOriginalName || 'No file'}</span>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 16px' }}>
                        <select
                          value={app.status}
                          onChange={(e) => handleUpdateAppStatus(app.id || app._id, e.target.value)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 700,
                            border: '1px solid #CBD5E1',
                            background: '#fff',
                            cursor: 'pointer',
                          }}
                        >
                          <option value="new">New</option>
                          <option value="reviewed">Reviewed</option>
                          <option value="shortlisted">Shortlisted</option>
                          <option value="rejected">Rejected</option>
                          <option value="hired">Hired</option>
                        </select>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 20px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={() => setSelectedApp(app)}
                          title="View Full Application Details"
                          style={{ marginRight: 6 }}
                        >
                          <Eye size={13} /> View
                        </button>
                        <button
                          className="btn btn-sm btn-danger-outline"
                          onClick={() => setConfirmDelete({ type: 'application', item: app })}
                          title="Delete Application"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* TAB 2: CAREERS (JOB POSTINGS) */
          filteredCareers.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center' }}>
              <Briefcase size={48} style={{ color: '#94A3B8', margin: '0 auto 12px' }} />
              <h3 style={{ margin: 0, fontSize: 18, color: '#0F172A', fontWeight: 700 }}>No Careers Found</h3>
              <p style={{ margin: '6px 0 16px', color: '#64748B', fontSize: 13 }}>
                Click "+ Add New Career" above to publish a new job opening to the website.
              </p>
              <button className="btn btn-primary" onClick={handleOpenAddCareer}>
                <Plus size={16} /> Add First Career
              </button>
            </div>
          ) : (
            <div style={{ padding: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
              {filteredCareers.map((c) => (
                <div
                  key={c.id || c._id}
                  style={{
                    background: '#fff',
                    borderRadius: 14,
                    border: '1.5px solid #E2E8F0',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
                    transition: 'all 0.2s',
                    overflow: 'hidden',
                  }}
                >
                  <div>
                    {c.image && (
                      <div
                        style={{
                          margin: '-20px -20px 14px -20px',
                          height: 140,
                          overflow: 'hidden',
                          background: '#F1F5F9',
                          position: 'relative',
                        }}
                      >
                        <img
                          src={c.image}
                          alt={c.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    )}

                    {/* Top Tag row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 700,
                          padding: '3px 10px',
                          borderRadius: 999,
                          background: c.status === 'active' ? '#DCFCE7' : '#F1F5F9',
                          color: c.status === 'active' ? '#166534' : '#64748B',
                          border: c.status === 'active' ? '1px solid #BBF7D0' : '1px solid #E2E8F0',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                        }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.status === 'active' ? '#16a34a' : '#94a3b8' }} />
                        {c.status === 'active' ? 'Live on Website' : 'Inactive (Hidden)'}
                      </span>

                      <span style={{ fontSize: 12, fontWeight: 700, color: '#3B82F6', background: '#EFF6FF', padding: '3px 8px', borderRadius: 6 }}>
                        {c.type || 'Full-time'}
                      </span>
                    </div>

                    <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800, color: '#0F172A' }}>
                      {c.title}
                    </h3>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12.5, color: '#64748B', marginBottom: 12, flexWrap: 'wrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Building2 size={13} color="#0D5F4E" /> {c.department}
                      </span>
                      <span>•</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={13} color="#0D5F4E" /> {c.location}
                      </span>
                    </div>

                    {c.description && (
                      <p style={{ margin: '0 0 12px', fontSize: 13, color: '#475569', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {c.description}
                      </p>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: '#334155', background: '#F8FAFC', padding: '8px 12px', borderRadius: 8, marginBottom: 16 }}>
                      <div>Exp: <strong>{c.experience || '1-3 yrs'}</strong></div>
                      <div>Salary: <strong>{c.salary || 'Competitive'}</strong></div>
                      <div>Openings: <strong>{c.openings || 1}</strong></div>
                    </div>
                  </div>

                  {/* Card bottom actions */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #F1F5F9', paddingTop: 14 }}>
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={() => {
                        setActiveTab('applications');
                        setRoleFilter(c.title);
                      }}
                      style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      title="View all applications for this role"
                    >
                      <Users size={13} /> {c.applicationCount || 0} Applications
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={() => handleToggleCareerStatus(c)}
                        title={c.status === 'active' ? 'Hide from website' : 'Publish to website'}
                      >
                        {c.status === 'active' ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={() => handleOpenEditCareer(c)}
                        title="Edit Career"
                      >
                        <Edit2 size={13} /> Edit
                      </button>
                      <button
                        className="btn btn-sm btn-danger-outline"
                        onClick={() => setConfirmDelete({ type: 'career', item: c })}
                        title="Delete Career"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* ── MODAL: ADD / EDIT CAREER ── */}
      {showCareerModal && (
        <Modal
          title={editingCareer ? 'Edit Job Opening' : 'Add New Job Opening (Website)'}
          onClose={() => setShowCareerModal(false)}
          wide
          footer={
            <>
              <button className="btn btn-outline" onClick={() => setShowCareerModal(false)} disabled={savingCareer}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSaveCareer} disabled={savingCareer}>
                {savingCareer ? 'Saving…' : editingCareer ? 'Update Career' : 'Publish to Website'}
              </button>
            </>
          }
        >
          <form onSubmit={handleSaveCareer} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 5 }}>
                  Job Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Real Estate Portfolio Advisor"
                  value={careerForm.title}
                  onChange={(e) => setCareerForm({ ...careerForm, title: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #CBD5E1', fontSize: 13.5 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 5 }}>
                  Department *
                </label>
                <select
                  value={careerForm.department}
                  onChange={(e) => setCareerForm({ ...careerForm, department: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #CBD5E1', fontSize: 13.5, background: '#fff' }}
                >
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 5 }}>
                  Location *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Chennai & Bengaluru"
                  value={careerForm.location}
                  onChange={(e) => setCareerForm({ ...careerForm, location: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #CBD5E1', fontSize: 13.5 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 5 }}>
                  Employment Type
                </label>
                <select
                  value={careerForm.type}
                  onChange={(e) => setCareerForm({ ...careerForm, type: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #CBD5E1', fontSize: 13.5, background: '#fff' }}
                >
                  {JOB_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 5 }}>
                  Experience Required
                </label>
                <input
                  type="text"
                  placeholder="e.g. 2-5 years"
                  value={careerForm.experience}
                  onChange={(e) => setCareerForm({ ...careerForm, experience: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #CBD5E1', fontSize: 13.5 }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 5 }}>
                  Salary / Compensation
                </label>
                <input
                  type="text"
                  placeholder="e.g. ₹6L - ₹12L PA"
                  value={careerForm.salary}
                  onChange={(e) => setCareerForm({ ...careerForm, salary: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #CBD5E1', fontSize: 13.5 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 5 }}>
                  No. of Openings
                </label>
                <input
                  type="number"
                  min="1"
                  value={careerForm.openings}
                  onChange={(e) => setCareerForm({ ...careerForm, openings: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #CBD5E1', fontSize: 13.5 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 5 }}>
                  Website Visibility Status
                </label>
                <select
                  value={careerForm.status}
                  onChange={(e) => setCareerForm({ ...careerForm, status: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #CBD5E1', fontSize: 13.5, background: '#fff' }}
                >
                  <option value="active">Active (Visible on Website)</option>
                  <option value="inactive">Inactive (Draft / Hidden)</option>
                </select>
              </div>
            </div>

            {/* Career Banner / Feature Image */}
            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                Career Banner / Feature Image (Optional)
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageFileChange}
                style={{ display: 'none' }}
              />

              {imagePreview ? (
                <div
                  style={{
                    position: 'relative',
                    borderRadius: 10,
                    overflow: 'hidden',
                    border: '1.5px solid #CBD5E1',
                    maxHeight: 180,
                    background: '#F8FAFC',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <img
                    src={imagePreview}
                    alt="Career Preview"
                    style={{ width: '100%', height: 180, objectFit: 'cover' }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      display: 'flex',
                      gap: 6,
                    }}
                  >
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(4px)', padding: '4px 10px', fontSize: 12 }}
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImage}
                    >
                      <Upload size={13} /> Change
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      style={{ padding: '4px 10px', fontSize: 12 }}
                      onClick={handleRemoveImage}
                      disabled={uploadingImage}
                    >
                      <Trash2 size={13} /> Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => !uploadingImage && fileInputRef.current?.click()}
                  style={{
                    border: '2px dashed #CBD5E1',
                    borderRadius: 10,
                    padding: '24px 16px',
                    textAlign: 'center',
                    cursor: uploadingImage ? 'wait' : 'pointer',
                    background: '#F8FAFC',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#0D5F4E'; e.currentTarget.style.background = '#F0FDF4'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.background = '#F8FAFC'; }}
                >
                  {uploadingImage ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: '#0D5F4E' }}>
                      <RefreshCw size={24} className="spin" />
                      <span style={{ fontSize: 13, fontWeight: 600 }}>Uploading image...</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 8,
                          background: '#E2E8F0',
                          display: 'grid',
                          placeItems: 'center',
                          color: '#475569',
                        }}
                      >
                        <ImageIcon size={22} />
                      </div>
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#0D5F4E' }}>Click to upload</span>
                        <span style={{ fontSize: 13, color: '#64748B' }}> or drag and drop</span>
                      </div>
                      <span style={{ fontSize: 11.5, color: '#94A3B8' }}>PNG, JPG, WEBP up to 5MB</span>
                    </div>
                  )}
                </div>
              )}

              {/* Or paste image URL option */}
              <div style={{ marginTop: 8 }}>
                <input
                  type="url"
                  placeholder="Or enter direct image URL (e.g. https://images.unsplash.com/...)"
                  value={careerForm.image || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCareerForm({ ...careerForm, image: val });
                    setImagePreview(val);
                  }}
                  style={{ width: '100%', padding: '7px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 12.5 }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 5 }}>
                Job Description
              </label>
              <textarea
                rows={3}
                placeholder="Briefly describe the day-to-day role and responsibilities..."
                value={careerForm.description}
                onChange={(e) => setCareerForm({ ...careerForm, description: e.target.value })}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #CBD5E1', fontSize: 13.5 }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 5 }}>
                Key Requirements & Skills (One per line)
              </label>
              <textarea
                rows={3}
                placeholder="e.g.&#10;2+ years experience in real estate sales&#10;Strong communication & negotiation skills&#10;Knowledge of local property market"
                value={careerForm.requirements}
                onChange={(e) => setCareerForm({ ...careerForm, requirements: e.target.value })}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #CBD5E1', fontSize: 13.5 }}
              />
            </div>
          </form>
        </Modal>
      )}

      {/* ── MODAL: VIEW APPLICATION DETAILS ── */}
      {selectedApp && (
        <Modal
          title={`Application: ${selectedApp.name}`}
          onClose={() => setSelectedApp(null)}
          wide
          footer={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <button
                className="btn btn-danger-outline"
                onClick={() => setConfirmDelete({ type: 'application', item: selectedApp })}
              >
                Delete Application
              </button>
              <button className="btn btn-primary" onClick={() => setSelectedApp(null)}>
                Close
              </button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Candidate Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F8FAFC', padding: 16, borderRadius: 12, border: '1px solid #E2E8F0', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, color: '#0F172A', fontWeight: 800 }}>{selectedApp.name}</h3>
                <div style={{ fontSize: 13, color: '#0D5F4E', fontWeight: 700, marginTop: 2 }}>
                  Applied For: {selectedApp.roleTitle}
                </div>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
                  Submitted on {formatDate(selectedApp.createdAt)} ({formatRelativeTime(selectedApp.createdAt)})
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', color: '#64748B', fontWeight: 700, marginBottom: 4 }}>
                  Application Status
                </label>
                <select
                  value={selectedApp.status}
                  onChange={(e) => handleUpdateAppStatus(selectedApp.id || selectedApp._id, e.target.value, selectedApp.notes)}
                  disabled={updatingAppStatus}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    border: '1.5px solid #CBD5E1',
                    background: '#fff',
                  }}
                >
                  <option value="new">New (Pending Review)</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="shortlisted">Shortlisted</option>
                  <option value="rejected">Rejected</option>
                  <option value="hired">Hired</option>
                </select>
              </div>
            </div>

            {/* Candidate Contact Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, padding: 12 }}>
                <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>Email</span>
                <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>
                  <a href={`mailto:${selectedApp.email}`} style={{ color: '#0D5F4E', textDecoration: 'none' }}>
                    {selectedApp.email}
                  </a>
                </div>
              </div>

              <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, padding: 12 }}>
                <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>Phone</span>
                <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4, color: '#0F172A' }}>
                  {selectedApp.phone ? (
                    <a href={`tel:${selectedApp.phone}`} style={{ color: '#0F172A', textDecoration: 'none' }}>
                      {selectedApp.phone}
                    </a>
                  ) : 'Not provided'}
                </div>
              </div>

              <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, padding: 12 }}>
                <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>Experience</span>
                <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4, color: '#0F172A' }}>
                  {selectedApp.experience || 'Not specified'}
                </div>
              </div>
            </div>

            {/* Resume File */}
            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#166534', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FileText size={16} /> Attached Resume / Document
                  </div>
                  <div style={{ fontSize: 12.5, color: '#475569', marginTop: 2 }}>
                    {selectedApp.resumeOriginalName || 'Uploaded Resume'}
                  </div>
                </div>

                {selectedApp.resumeUrl ? (
                  <a
                    href={selectedApp.resumeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <Download size={14} /> View / Download Resume
                  </a>
                ) : (
                  <span style={{ fontSize: 12, color: '#94A3B8' }}>No resume file attached</span>
                )}
              </div>
            </div>

            {/* Cover letter / Message if provided */}
            {selectedApp.coverLetter && (
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>
                  Cover Note / Message
                </label>
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: 14, borderRadius: 10, fontSize: 13.5, color: '#334155', lineHeight: 1.6 }}>
                  {selectedApp.coverLetter}
                </div>
              </div>
            )}

            {/* Admin Internal Notes */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>
                Admin Internal Notes (Interview Feedback / Status Comments)
              </label>
              <textarea
                rows={3}
                placeholder="Add notes about this candidate (e.g. Called on 18th Nov, scheduled round 1 interview for tomorrow)..."
                defaultValue={selectedApp.notes || ''}
                onBlur={(e) => handleUpdateAppStatus(selectedApp.id || selectedApp._id, selectedApp.status, e.target.value)}
                style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }}
              />
              <span style={{ fontSize: 11, color: '#94A3B8' }}>Notes are saved automatically when you click outside.</span>
            </div>
          </div>
        </Modal>
      )}

      {/* ── CONFIRM DELETE DIALOG ── */}
      {confirmDelete && (
        <ConfirmDialog
          title={confirmDelete.type === 'career' ? 'Delete Job Opening?' : 'Delete Application?'}
          message={
            confirmDelete.type === 'career'
              ? `Are you sure you want to delete the job opening "${confirmDelete.item.title}"? This will remove it from the website.`
              : `Are you sure you want to delete the application from "${confirmDelete.item.name}" for "${confirmDelete.item.roleTitle}"? This cannot be undone.`
          }
          danger
          confirmLabel="Delete Permanently"
          onConfirm={() =>
            confirmDelete.type === 'career'
              ? handleDeleteCareer(confirmDelete.item)
              : handleDeleteApp(confirmDelete.item)
          }
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
