import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Building2,
  Plus,
  Search,
  Filter,
  Eye,
  Trash2,
  Edit2,
  Upload,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building,
  MapPin,
  RefreshCw,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Globe,
  Award,
  Calendar,
  X,
  Image as ImageIcon,
} from 'lucide-react';
import Modal from '../components/Modal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { Empty, Loading } from '../components/StateBlock.jsx';
import { adminService } from '../services/adminService.js';
import { useToast } from '../context/ToastContext.jsx';
import api from '../services/api.js';

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'elrw6gnd';
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'probridge';
const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

async function uploadLogoImage(file) {
  // 1. Direct Cloudinary unsigned upload
  if (CLOUD_NAME && UPLOAD_PRESET) {
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('upload_preset', UPLOAD_PRESET);
      form.append('folder', 'probridge/builders');
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
    formData.append('type', 'builder');
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

const INITIAL_FORM = {
  name: '',
  logo: '',
  experience: '',
  established: '',
  headquarters: '',
  description: '',
  website: '',
  status: 'active',
  order: 0,
};

export default function Builders() {
  const toast = useToast();
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [builders, setBuilders] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'inactive'

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingBuilder, setEditingBuilder] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [logoPreview, setLogoPreview] = useState('');

  // Delete dialog
  const [confirmDelete, setConfirmDelete] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await adminService.listBuilders();
      setBuilders(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error('Failed to load builders: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered list
  const filteredBuilders = useMemo(() => {
    return builders.filter((b) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        b.name?.toLowerCase().includes(q) ||
        b.headquarters?.toLowerCase().includes(q) ||
        b.experience?.toLowerCase().includes(q);

      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && b.status === 'active') ||
        (statusFilter === 'inactive' && b.status === 'inactive');

      return matchSearch && matchStatus;
    });
  }, [builders, searchQuery, statusFilter]);

  // Stats
  const stats = useMemo(() => {
    const total = builders.length;
    const active = builders.filter((b) => b.status === 'active').length;
    const inactive = builders.filter((b) => b.status === 'inactive').length;
    return { total, active, inactive };
  }, [builders]);

  // Open modal for Create
  const handleOpenAdd = () => {
    setEditingBuilder(null);
    setFormData(INITIAL_FORM);
    setLogoPreview('');
    setShowModal(true);
  };

  // Open modal for Edit
  const handleOpenEdit = (b) => {
    setEditingBuilder(b);
    setFormData({
      name: b.name || '',
      logo: b.logo || '',
      experience: b.experience || '',
      established: b.established || '',
      headquarters: b.headquarters || '',
      description: b.description || '',
      website: b.website || '',
      status: b.status || 'active',
      order: b.order || 0,
    });
    setLogoPreview(b.logo || '');
    setShowModal(true);
  };

  // File upload handler
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (PNG, JPG, SVG, WebP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB');
      return;
    }

    // Local preview immediately
    const tempUrl = URL.createObjectURL(file);
    setLogoPreview(tempUrl);

    setUploadingLogo(true);
    try {
      const uploadedUrl = await uploadLogoImage(file);
      if (uploadedUrl) {
        setFormData((prev) => ({ ...prev, logo: uploadedUrl }));
        setLogoPreview(uploadedUrl);
        toast.success('Logo uploaded successfully');
      } else {
        toast.error('Failed to get uploaded logo URL');
      }
    } catch (err) {
      toast.error('Logo upload failed: ' + (err.message || 'Unknown error'));
    } finally {
      setUploadingLogo(false);
    }
  };

  // Save builder (Create or Update)
  const handleSave = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Builder name is required');
      return;
    }

    if (!formData.logo.trim() && !logoPreview) {
      toast.error('Builder logo is required. Please upload an image or provide a URL.');
      return;
    }

    const payload = {
      ...formData,
      logo: formData.logo.trim() || logoPreview,
    };

    setSaving(true);
    try {
      if (editingBuilder) {
        const updated = await adminService.updateBuilder(editingBuilder._id || editingBuilder.id, payload);
        toast.success(`Builder "${payload.name}" updated successfully`);
        setBuilders((prev) =>
          prev.map((b) => (b._id === editingBuilder._id || b.id === editingBuilder.id ? updated : b))
        );
      } else {
        const created = await adminService.createBuilder(payload);
        toast.success(`Builder "${payload.name}" added successfully`);
        setBuilders((prev) => [created, ...prev]);
      }
      setShowModal(false);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to save builder';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // Toggle status
  const handleToggleStatus = async (b) => {
    const id = b._id || b.id;
    const targetStatus = b.status === 'active' ? 'inactive' : 'active';
    try {
      const updated = await adminService.toggleBuilderStatus(id, targetStatus);
      setBuilders((prev) =>
        prev.map((item) => (item._id === id || item.id === id ? { ...item, status: targetStatus } : item))
      );
      toast.success(`Builder "${b.name}" is now ${targetStatus === 'active' ? 'live on website' : 'hidden'}`);
    } catch (err) {
      toast.error('Failed to update status: ' + (err.message || 'Unknown error'));
    }
  };

  // Delete builder
  const handleDelete = async () => {
    if (!confirmDelete) return;
    const id = confirmDelete._id || confirmDelete.id;
    try {
      await adminService.deleteBuilder(id);
      setBuilders((prev) => prev.filter((item) => item._id !== id && item.id !== id));
      toast.success(`Builder "${confirmDelete.name}" deleted successfully`);
    } catch (err) {
      toast.error('Failed to delete builder: ' + (err.message || 'Unknown error'));
    } finally {
      setConfirmDelete(null);
    }
  };

  return (
    <div className="page" style={{ paddingBottom: 60 }}>
      {/* ── Page Header ────────────────────────────────────────────── */}
      <div className="page-head" style={{ marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #0D5F4E 0%, #134E3A 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 4px 12px rgba(13,95,78,0.2)',
              }}
            >
              <Building2 size={20} />
            </div>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: '#0F172A' }}>
                Builders & Developers
              </h1>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748B' }}>
                Manage builder brands displayed in the "Top Builders & Developers" section on the ProBridge website.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn"
            onClick={loadData}
            title="Refresh list"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            Refresh
          </button>
          <button
            className="btn btn-primary"
            onClick={handleOpenAdd}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'linear-gradient(135deg, #0D5F4E 0%, #0a493c 100%)',
              boxShadow: '0 4px 14px rgba(13,95,78,0.25)',
              padding: '10px 18px',
              fontWeight: 700,
            }}
          >
            <Plus size={17} />
            Add Builder
          </button>
        </div>
      </div>

      {/* ── Stat Cards ─────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div
          className="card"
          style={{
            padding: '18px 20px',
            background: '#fff',
            borderRadius: 14,
            border: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: '#EFF6FF',
              color: '#2563EB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Building size={24} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
              Total Builders
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#0F172A', marginTop: 2 }}>
              {stats.total}
            </div>
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: '18px 20px',
            background: '#fff',
            borderRadius: 14,
            border: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: '#DCFCE7',
              color: '#16A34A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckCircle2 size={24} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
              Live on Website
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#16A34A', marginTop: 2 }}>
              {stats.active}
            </div>
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: '18px 20px',
            background: '#fff',
            borderRadius: 14,
            border: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: '#F1F5F9',
              color: '#64748B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Clock size={24} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
              Hidden / Inactive
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#64748B', marginTop: 2 }}>
              {stats.inactive}
            </div>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Controls ───────────────────────────────── */}
      <div
        className="card"
        style={{
          padding: '14px 18px',
          background: '#fff',
          borderRadius: 14,
          border: '1px solid #E2E8F0',
          marginBottom: 20,
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260 }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: 380 }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94A3B8',
              }}
            />
            <input
              type="text"
              placeholder="Search by builder name or city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                border: '1.5px solid #E2E8F0',
                borderRadius: 9,
                fontSize: 13,
                outline: 'none',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94A3B8',
                  cursor: 'pointer',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: '#64748B', fontWeight: 600 }}>Status:</span>
          {['all', 'active', 'inactive'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                border: statusFilter === st ? '1.5px solid #0D5F4E' : '1px solid #E2E8F0',
                background: statusFilter === st ? '#E6F4EA' : '#fff',
                color: statusFilter === st ? '#0D5F4E' : '#64748B',
                fontWeight: statusFilter === st ? 700 : 500,
                fontSize: 12,
                textTransform: 'capitalize',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* ── Builders Content ───────────────────────────────────────── */}
      {loading ? (
        <Loading text="Loading builders & developers..." />
      ) : filteredBuilders.length === 0 ? (
        <Empty
          title="No builders found"
          message={
            searchQuery || statusFilter !== 'all'
              ? 'Try adjusting your search query or filter.'
              : 'Click "+ Add Builder" to add your first real estate developer brand.'
          }
          action={
            <button className="btn btn-primary" onClick={handleOpenAdd}>
              <Plus size={15} /> Add First Builder
            </button>
          }
        />
      ) : (
        <div
          className="card"
          style={{
            background: '#fff',
            borderRadius: 14,
            border: '1px solid #E2E8F0',
            overflow: 'hidden',
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '14px 20px', fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                    Builder / Developer
                  </th>
                  <th style={{ padding: '14px 16px', fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                    Experience
                  </th>
                  <th style={{ padding: '14px 16px', fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                    Established
                  </th>
                  <th style={{ padding: '14px 16px', fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                    Headquarters
                  </th>
                  <th style={{ padding: '14px 16px', fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                    Website Status
                  </th>
                  <th style={{ padding: '14px 20px', fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', textAlign: 'right' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredBuilders.map((b) => {
                  const isActive = b.status === 'active';
                  return (
                    <tr
                      key={b._id || b.id}
                      style={{
                        borderBottom: '1px solid #F1F5F9',
                        transition: 'background 0.15s',
                      }}
                    >
                      {/* Logo + Name */}
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                          <div
                            style={{
                              width: 72,
                              height: 44,
                              borderRadius: 8,
                              border: '1px solid #E2E8F0',
                              background: '#F8FAFC',
                              padding: 4,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              overflow: 'hidden',
                              flexShrink: 0,
                            }}
                          >
                            {b.logo ? (
                              <img
                                src={b.logo}
                                alt={b.name}
                                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.nextSibling.style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div
                              style={{
                                display: b.logo ? 'none' : 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '100%',
                                height: '100%',
                                color: '#94A3B8',
                              }}
                            >
                              <Building2 size={20} />
                            </div>
                          </div>

                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>
                              {b.name}
                            </div>
                            {b.website ? (
                              <a
                                href={b.website.startsWith('http') ? b.website : `https://${b.website}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  fontSize: 11.5,
                                  color: '#0D5F4E',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  marginTop: 2,
                                }}
                              >
                                <span>Visit Website</span>
                                <ExternalLink size={10} />
                              </a>
                            ) : (
                              <span style={{ fontSize: 11, color: '#94A3B8' }}>Top Builder</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Experience */}
                      <td style={{ padding: '14px 16px', fontSize: 13, color: '#334155' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <Award size={14} color="#C28916" />
                          <strong>{b.experience || '—'}</strong>
                        </span>
                      </td>

                      {/* Established */}
                      <td style={{ padding: '14px 16px', fontSize: 13, color: '#334155' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <Calendar size={13} color="#64748B" />
                          {b.established || '—'}
                        </span>
                      </td>

                      {/* Headquarters */}
                      <td style={{ padding: '14px 16px', fontSize: 13, color: '#334155' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <MapPin size={13} color="#0D5F4E" />
                          {b.headquarters || '—'}
                        </span>
                      </td>

                      {/* Status toggle */}
                      <td style={{ padding: '14px 16px' }}>
                        <button
                          onClick={() => handleToggleStatus(b)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '4px 12px',
                            borderRadius: 20,
                            border: 'none',
                            background: isActive ? '#DCFCE7' : '#F1F5F9',
                            color: isActive ? '#15803D' : '#64748B',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                          }}
                          title="Click to toggle status"
                        >
                          <span
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: '50%',
                              background: isActive ? '#16A34A' : '#94A3B8',
                            }}
                          />
                          {isActive ? 'Active (Live)' : 'Inactive (Hidden)'}
                        </button>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <button
                            className="btn btn-sm"
                            onClick={() => handleOpenEdit(b)}
                            title="Edit builder details"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '6px 12px',
                              borderRadius: 8,
                            }}
                          >
                            <Edit2 size={13} />
                            Edit
                          </button>
                          <button
                            className="btn btn-sm"
                            onClick={() => setConfirmDelete(b)}
                            title="Delete builder"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              color: '#EF4444',
                              borderColor: '#FEE2E2',
                              background: '#FEF2F2',
                              padding: '6px 10px',
                              borderRadius: 8,
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal: Add / Edit Builder ──────────────────────────────── */}
      {showModal && (
        <Modal
          title={editingBuilder ? `Edit Builder: ${editingBuilder.name}` : 'Add New Builder & Developer'}
          onClose={() => !saving && setShowModal(false)}
          wide={true}
          footer={
            <>
              <button className="btn" onClick={() => setShowModal(false)} disabled={saving}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving || uploadingLogo}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'linear-gradient(135deg, #0D5F4E 0%, #0a493c 100%)',
                }}
              >
                {saving ? 'Saving...' : editingBuilder ? 'Update Builder' : 'Add to Website'}
              </button>
            </>
          }
        >
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Row 1: Name and Experience */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                  Builder Name <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Brigade Group, Puravankara..."
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 9,
                    border: '1.5px solid #CBD5E1',
                    fontSize: 14,
                    outline: 'none',
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                  Experience / Track Record
                </label>
                <input
                  type="text"
                  placeholder="e.g. 35+ Years, 20+ Years..."
                  value={formData.experience}
                  onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 9,
                    border: '1.5px solid #CBD5E1',
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            {/* Row 2: Established & Headquarters */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                  Established Year
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1986, 1975, 1990..."
                  value={formData.established}
                  onChange={(e) => setFormData({ ...formData, established: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 9,
                    border: '1.5px solid #CBD5E1',
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                  Headquarters / City
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bengaluru, Chennai, Mumbai..."
                  value={formData.headquarters}
                  onChange={(e) => setFormData({ ...formData, headquarters: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 9,
                    border: '1.5px solid #CBD5E1',
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            {/* Row 3: Logo Upload / URL */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                Builder Logo <span style={{ color: '#EF4444' }}>*</span>
              </label>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: 14,
                  borderRadius: 12,
                  border: '1.5px dashed #CBD5E1',
                  background: '#F8FAFC',
                }}
              >
                {/* Logo Preview box */}
                <div
                  style={{
                    width: 100,
                    height: 60,
                    borderRadius: 8,
                    border: '1px solid #E2E8F0',
                    background: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    flexShrink: 0,
                    padding: 4,
                  }}
                >
                  {logoPreview ? (
                    <img
                      src={logoPreview}
                      alt="Logo Preview"
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'block';
                      }}
                    />
                  ) : null}
                  <div style={{ display: logoPreview ? 'none' : 'block', textAlign: 'center', color: '#94A3B8' }}>
                    <ImageIcon size={20} />
                    <div style={{ fontSize: 9 }}>No Logo</div>
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*"
                      style={{ display: 'none' }}
                    />
                    <button
                      type="button"
                      className="btn"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingLogo}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}
                    >
                      <Upload size={14} />
                      {uploadingLogo ? 'Uploading Logo...' : 'Upload Logo File'}
                    </button>
                    {logoPreview && (
                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          setLogoPreview('');
                          setFormData({ ...formData, logo: '' });
                        }}
                        style={{ fontSize: 12, color: '#EF4444' }}
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <div style={{ fontSize: 12, color: '#64748B', marginBottom: 6 }}>
                    Or paste an image URL directly:
                  </div>
                  <input
                    type="url"
                    placeholder="https://example.com/builder-logo.png"
                    value={formData.logo}
                    onChange={(e) => {
                      setFormData({ ...formData, logo: e.target.value });
                      setLogoPreview(e.target.value);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid #CBD5E1',
                      fontSize: 13,
                      outline: 'none',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Row 4: Website URL */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                Official Website URL (Optional)
              </label>
              <div style={{ position: 'relative' }}>
                <Globe
                  size={16}
                  style={{
                    position: 'absolute',
                    left: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#94A3B8',
                  }}
                />
                <input
                  type="url"
                  placeholder="https://www.buildername.com"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px 10px 36px',
                    borderRadius: 9,
                    border: '1.5px solid #CBD5E1',
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            {/* Row 5: Status & Display Order */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                  Display Status on Website
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 9,
                    border: '1.5px solid #CBD5E1',
                    fontSize: 14,
                    background: '#fff',
                    outline: 'none',
                  }}
                >
                  <option value="active">Active (Visible on Website)</option>
                  <option value="inactive">Inactive (Hidden)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                  Display Order
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="0, 1, 2..."
                  value={formData.order}
                  onChange={(e) => setFormData({ ...formData, order: Number(e.target.value) || 0 })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 9,
                    border: '1.5px solid #CBD5E1',
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
                <small style={{ color: '#94A3B8', marginTop: 4 }}>Lower numbers appear first on the homepage</small>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Confirmation Dialog: Delete ────────────────────────────── */}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete Builder & Developer"
          message={`Are you sure you want to delete "${confirmDelete.name}"? This developer brand will be permanently removed from the ProBridge website.`}
          confirmLabel="Delete Builder"
          danger={true}
          onConfirm={handleDelete}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
