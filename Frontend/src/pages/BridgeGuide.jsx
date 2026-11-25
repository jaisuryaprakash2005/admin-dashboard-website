import { useState, useEffect, useMemo, useRef } from 'react';
import {
  FileText,
  Plus,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Eye,
  CheckCircle2,
  Upload,
  Download,
  Calendar,
  Sparkles,
  BookOpen,
  FileCheck,
  Compass,
  FileDown,
  X,
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
const CLOUDINARY_RAW_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/raw/upload`;
const CLOUDINARY_IMAGE_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

// Helper to format file sizes
function formatFileSize(bytes) {
  if (!bytes || isNaN(bytes)) return '';
  if (bytes < 1024) return bytes + ' B';
  const kb = bytes / 1024;
  if (kb < 1024) return kb.toFixed(1) + ' KB';
  const mb = kb / 1024;
  return mb.toFixed(1) + ' MB';
}

async function uploadGuideImage(file) {
  // 1. Direct Cloudinary image upload if available
  if (CLOUD_NAME && UPLOAD_PRESET) {
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('upload_preset', UPLOAD_PRESET);
      form.append('folder', 'probridge/bridgeguides');
      const res = await fetch(CLOUDINARY_IMAGE_URL, { method: 'POST', body: form });
      const data = await res.json();
      if (res.ok && (data.secure_url || data.url)) {
        return data.secure_url || data.url;
      }
    } catch (e) {
      console.warn('[Cloudinary Image upload fallback]', e.message);
    }
  }

  // 2. Backend /api/upload/image fallback
  try {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('type', 'guide');
    const uploadRes = await api.post('/api/upload/image', formData);
    if (uploadRes.data?.url) return uploadRes.data.url;
  } catch (backendErr) {
    console.warn('[Backend image upload fallback]', backendErr.message);
  }

  // 3. Base64 data URI fallback
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

async function uploadPdfFile(file) {
  // 1. Direct Cloudinary raw upload if available
  if (CLOUD_NAME && UPLOAD_PRESET) {
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('upload_preset', UPLOAD_PRESET);
      form.append('folder', 'probridge/bridgeguides');
      const res = await fetch(CLOUDINARY_RAW_URL, { method: 'POST', body: form });
      const data = await res.json();
      if (res.ok && (data.secure_url || data.url)) {
        return data.secure_url || data.url;
      }
    } catch (e) {
      console.warn('[Cloudinary PDF upload fallback]', e.message);
    }
  }

  // 2. Base64 data URI fallback (supports inline PDF view & offline usage)
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

const CATEGORIES = [
  'Buyer Handbook',
  'Legal & Verification',
  'Financial Planning',
  'NRI Investment',
  'Tax & Stamp Duty',
  'Home Construction Guide',
  'General',
];

const INITIAL_FORM = {
  title: '',
  thumbnail: '',
  pdfUrl: '',
  fileName: '',
  fileSize: '',
  description: '',
  category: 'Buyer Handbook',
  status: 'active',
};

export default function BridgeGuide() {
  const toast = useToast();
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);

  const [guides, setGuides] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal & form states
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Read / Viewer modal
  const [readingGuide, setReadingGuide] = useState(null);

  // Delete confirm
  const [confirmDelete, setConfirmDelete] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await adminService.listBridgeGuides();
      setGuides(Array.isArray(res) ? res : []);
    } catch (err) {
      toast.error('Failed to load Bridge Guides: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered guides
  const filteredGuides = useMemo(() => {
    return guides.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const matchQ =
        !q ||
        item.title?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.fileName?.toLowerCase().includes(q) ||
        item.category?.toLowerCase().includes(q);

      const matchCategory = categoryFilter === 'all' || item.category === categoryFilter;
      const matchStatus = statusFilter === 'all' || item.status === statusFilter;

      return matchQ && matchCategory && matchStatus;
    });
  }, [guides, searchQuery, categoryFilter, statusFilter]);

  // Stats
  const stats = useMemo(() => {
    const total = guides.length;
    const active = guides.filter((g) => g.status === 'active').length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [guides]);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData(INITIAL_FORM);
    setShowModal(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setFormData({
      title: item.title || '',
      thumbnail: item.thumbnail || '',
      pdfUrl: item.pdfUrl || '',
      fileName: item.fileName || 'guide.pdf',
      fileSize: item.fileSize || '',
      description: item.description || '',
      category: item.category || 'Buyer Handbook',
      status: item.status || 'active',
    });
    setShowModal(true);
  };

  // Image Thumbnail upload handler
  const handleImageFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (.png, .jpg, .jpeg, .webp)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image size must be under 10MB');
      return;
    }

    setUploadingImage(true);
    try {
      const url = await uploadGuideImage(file);
      if (url) {
        setFormData((prev) => ({ ...prev, thumbnail: url }));
        toast.success('Thumbnail image uploaded successfully!');
      } else {
        toast.error('Could not process image');
      }
    } catch (err) {
      toast.error('Failed to upload thumbnail: ' + err.message);
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const handleRemoveImage = () => {
    setFormData((prev) => ({ ...prev, thumbnail: '' }));
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  // PDF File upload handler
  const handlePdfFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please select a valid PDF document (.pdf)');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error('PDF file size must be under 20MB');
      return;
    }

    setUploadingPdf(true);
    try {
      const url = await uploadPdfFile(file);
      if (url) {
        setFormData((prev) => ({
          ...prev,
          pdfUrl: url,
          fileName: file.name,
          fileSize: formatFileSize(file.size),
        }));
        toast.success(`PDF "${file.name}" uploaded successfully!`);
      } else {
        toast.error('Could not process PDF file');
      }
    } catch (err) {
      toast.error('Failed to upload PDF: ' + err.message);
    } finally {
      setUploadingPdf(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemovePdf = () => {
    setFormData((prev) => ({ ...prev, pdfUrl: '', fileName: '', fileSize: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error('Guide title is required');
      return;
    }
    if (!formData.pdfUrl.trim()) {
      toast.error('Please upload a PDF document or enter a PDF URL');
      return;
    }
    if (!formData.description.trim()) {
      toast.error('Description is required');
      return;
    }

    setSaving(true);
    try {
      if (editingItem) {
        await adminService.updateBridgeGuide(editingItem._id || editingItem.id, formData);
        toast.success(`Bridge Guide "${formData.title}" updated successfully!`);
      } else {
        await adminService.createBridgeGuide(formData);
        toast.success(`Bridge Guide "${formData.title}" published!`);
      }
      setShowModal(false);
      loadData();
    } catch (err) {
      toast.error('Failed to save Bridge Guide: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    try {
      await adminService.deleteBridgeGuide(item._id || item.id);
      toast.success('Bridge Guide deleted successfully');
      setConfirmDelete(null);
      if (readingGuide && (readingGuide._id || readingGuide.id) === (item._id || item.id)) {
        setReadingGuide(null);
      }
      loadData();
    } catch (err) {
      toast.error('Failed to delete guide: ' + err.message);
    }
  };

  const handleToggleStatus = async (item) => {
    const nextStatus = item.status === 'active' ? 'inactive' : 'active';
    try {
      await adminService.toggleBridgeGuideStatus(item._id || item.id, nextStatus);
      toast.success(`Guide status set to ${nextStatus === 'active' ? 'Active (Live)' : 'Inactive (Hidden)'}`);
      setGuides((prev) =>
        prev.map((g) =>
          (g._id || g.id) === (item._id || item.id) ? { ...g, status: nextStatus } : g
        )
      );
    } catch (err) {
      toast.error('Failed to update status: ' + err.message);
    }
  };

  // Open PDF directly in new tab or viewer modal
  const handleReadGuide = (guide) => {
    if (!guide.pdfUrl) {
      toast.error('No PDF URL available for this guide');
      return;
    }
    // If base64 or external url, can open in viewer modal and offer new tab
    setReadingGuide(guide);
  };

  const handleOpenPdfDirectly = (url) => {
    if (!url) return;
    const w = window.open();
    if (w) {
      w.location.href = url;
    } else {
      window.location.href = url;
    }
  };

  return (
    <div className="page" style={{ paddingBottom: 40 }}>
      {/* ── Page Header ── */}
      <div
        className="page-head"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #0284C7, #0369A1)',
              display: 'grid',
              placeItems: 'center',
              color: '#fff',
              boxShadow: '0 4px 14px rgba(2, 132, 199, 0.3)',
            }}
          >
            <Compass size={24} />
          </div>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 24,
                fontWeight: 800,
                color: '#0F172A',
                letterSpacing: '-0.4px',
              }}
            >
              Bridge Guide
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748B' }}>
              Publish downloadable PDF buyer handbooks, RERA compliance checklists, and property guides
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn btn-outline" onClick={loadData} title="Refresh Guides">
            <RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh
          </button>
          <button
            className="btn btn-primary"
            onClick={handleOpenAdd}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#0284C7',
              borderColor: '#0284C7',
            }}
          >
            <Plus size={16} /> Add New Guide
          </button>
        </div>
      </div>

      {/* ── Metric Cards ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 14,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            background: '#fff',
            borderRadius: 12,
            padding: '16px 20px',
            border: '1.5px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Total Guides</span>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', marginTop: 2 }}>
              {stats.total}
            </div>
          </div>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: '#E0F2FE',
              color: '#0284C7',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <FileText size={20} />
          </div>
        </div>

        <div
          style={{
            background: '#fff',
            borderRadius: 12,
            padding: '16px 20px',
            border: '1.5px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Live on Website</span>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#16A34A', marginTop: 2 }}>
              {stats.active}
            </div>
          </div>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: '#DCFCE7',
              color: '#16A34A',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div
          style={{
            background: '#fff',
            borderRadius: 12,
            padding: '16px 20px',
            border: '1.5px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Draft / Hidden</span>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#64748B', marginTop: 2 }}>
              {stats.inactive}
            </div>
          </div>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: '#F1F5F9',
              color: '#64748B',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <Eye size={20} />
          </div>
        </div>
      </div>

      {/* ── Filter Toolbar ── */}
      <div
        className="card"
        style={{
          padding: '14px 18px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          background: '#fff',
          borderRadius: 12,
          border: '1.5px solid #E2E8F0',
        }}
      >
        <div style={{ position: 'relative', flex: '1 1 240px' }}>
          <Search
            size={16}
            style={{ position: 'absolute', left: 12, top: 12, color: '#94A3B8' }}
          />
          <input
            type="text"
            placeholder="Search by title, description or file name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              height: 38,
              paddingLeft: 36,
              paddingRight: 12,
              borderRadius: 8,
              border: '1px solid #CBD5E1',
              fontSize: 13,
            }}
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{
            height: 38,
            padding: '0 12px',
            borderRadius: 8,
            border: '1px solid #CBD5E1',
            background: '#fff',
            fontSize: 13,
            color: '#334155',
          }}
        >
          <option value="all">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            height: 38,
            padding: '0 12px',
            borderRadius: 8,
            border: '1px solid #CBD5E1',
            background: '#fff',
            fontSize: 13,
            color: '#334155',
          }}
        >
          <option value="all">All Statuses</option>
          <option value="active">Active (Visible)</option>
          <option value="inactive">Inactive (Hidden)</option>
        </select>

        {(searchQuery || statusFilter !== 'all' || categoryFilter !== 'all') && (
          <button
            className="btn btn-sm btn-outline"
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
              setCategoryFilter('all');
            }}
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* ── Content Grid ── */}
      {loading ? (
        <div style={{ padding: 60 }}>
          <Loading message="Loading Bridge Guides..." />
        </div>
      ) : filteredGuides.length === 0 ? (
        <div
          style={{
            background: '#fff',
            borderRadius: 14,
            border: '1.5px solid #E2E8F0',
            padding: '60px 20px',
            textAlign: 'center',
          }}
        >
          <Compass size={48} style={{ color: '#94A3B8', margin: '0 auto 12px' }} />
          <h3 style={{ margin: 0, fontSize: 18, color: '#0F172A', fontWeight: 700 }}>
            No Bridge Guides Found
          </h3>
          <p style={{ margin: '6px 0 16px', color: '#64748B', fontSize: 13 }}>
            {guides.length === 0
              ? 'Click "+ Add New Guide" above to upload your first PDF handbook.'
              : 'Try clearing your search query or filters.'}
          </p>
          {guides.length === 0 && (
            <button
              className="btn btn-primary"
              onClick={handleOpenAdd}
              style={{ background: '#0284C7', borderColor: '#0284C7' }}
            >
              <Plus size={16} /> Add First Guide
            </button>
          )}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: 20,
          }}
        >
          {filteredGuides.map((guide) => (
            <div
              key={guide._id || guide.id}
              style={{
                background: '#fff',
                borderRadius: 16,
                border: '1.5px solid #E2E8F0',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 2px 10px rgba(15, 23, 42, 0.05)',
                transition: 'all 0.2s',
              }}
            >
              <div>
                {/* ── Card Thumbnail Banner ── */}
                <div
                  style={{
                    position: 'relative',
                    height: 160,
                    width: '100%',
                    background: guide.thumbnail
                      ? '#0F172A'
                      : 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)',
                    overflow: 'hidden',
                  }}
                >
                  {guide.thumbnail ? (
                    <img
                      src={guide.thumbnail}
                      alt={guide.title}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        display: 'grid',
                        placeItems: 'center',
                        color: 'rgba(255, 255, 255, 0.88)',
                      }}
                    >
                      <div style={{ textAlign: 'center' }}>
                        <Compass size={36} strokeWidth={1.6} />
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: 0.6,
                            marginTop: 4,
                            textTransform: 'uppercase',
                          }}
                        >
                          ProBridge Guide
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Gradient shadow overlay for badge readability */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background:
                        'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.4) 100%)',
                      pointerEvents: 'none',
                    }}
                  />

                  {/* Overlaid Badges */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 10,
                      left: 10,
                      right: 10,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      zIndex: 2,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '3px 9px',
                        borderRadius: 999,
                        background:
                          guide.status === 'active'
                            ? 'rgba(220, 252, 231, 0.95)'
                            : 'rgba(241, 245, 249, 0.95)',
                        color: guide.status === 'active' ? '#166534' : '#475569',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.15)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        backdropFilter: 'blur(4px)',
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: guide.status === 'active' ? '#16a34a' : '#94a3b8',
                        }}
                      />
                      {guide.status === 'active' ? 'Live on Website' : 'Hidden / Draft'}
                    </span>

                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#0369A1',
                        background: 'rgba(255, 255, 255, 0.94)',
                        padding: '3px 8px',
                        borderRadius: 6,
                        boxShadow: '0 2px 5px rgba(0,0,0,0.15)',
                        backdropFilter: 'blur(4px)',
                      }}
                    >
                      {guide.category || 'Buyer Handbook'}
                    </span>
                  </div>
                </div>

                {/* ── Card Body ── */}
                <div style={{ padding: '16px 18px 0' }}>
                  {/* Title & Metadata */}
                  <div style={{ marginBottom: 10 }}>
                    <h3
                      style={{
                        margin: '0 0 5px',
                        fontSize: 16.5,
                        fontWeight: 800,
                        color: '#0F172A',
                        lineHeight: 1.35,
                      }}
                    >
                      {guide.title}
                    </h3>
                    <div style={{ fontSize: 11.5, color: '#64748B' }}>
                      Added on {formatDate(guide.createdAt)}
                    </div>
                  </div>

                  {/* Description */}
                  <p
                    style={{
                      margin: '0 0 14px',
                      fontSize: 13,
                      color: '#475569',
                      lineHeight: 1.5,
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {guide.description}
                  </p>

                  {/* PDF Document Meta Box */}
                  <div
                    style={{
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: 10,
                      padding: '9px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 16,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                      <FileDown size={18} color="#DC2626" />
                      <div style={{ overflow: 'hidden' }}>
                        <div
                          style={{
                            fontSize: 12.5,
                            fontWeight: 700,
                            color: '#1E293B',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: 190,
                          }}
                          title={guide.fileName || 'guide.pdf'}
                        >
                          {guide.fileName || 'document.pdf'}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748B' }}>
                          PDF Document {guide.fileSize ? `• ${guide.fileSize}` : ''}
                        </div>
                      </div>
                    </div>

                    <a
                      href={guide.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-outline"
                      title="Open PDF in new tab"
                      style={{ padding: '3px 8px', fontSize: 11 }}
                    >
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              </div>

              {/* Bottom Action Bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderTop: '1px solid #F1F5F9',
                  padding: '12px 18px 16px',
                }}
              >
                {/* PROMINENT "READ GUIDE" BUTTON */}
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleReadGuide(guide)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 16px',
                    fontSize: 13,
                    fontWeight: 700,
                    background: '#0284C7',
                    borderColor: '#0284C7',
                  }}
                >
                  <BookOpen size={15} /> Read Guide
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    className="btn btn-sm btn-outline"
                    title={guide.status === 'active' ? 'Hide Guide' : 'Publish Guide'}
                    onClick={() => handleToggleStatus(guide)}
                    style={{
                      padding: '5px 8px',
                      color: guide.status === 'active' ? '#16a34a' : '#64748b',
                    }}
                  >
                    {guide.status === 'active' ? (
                      <ToggleRight size={17} />
                    ) : (
                      <ToggleLeft size={17} />
                    )}
                  </button>
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => handleOpenEdit(guide)}
                    style={{ padding: '5px 10px', fontSize: 12 }}
                  >
                    <Edit2 size={13} /> Edit
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => setConfirmDelete(guide)}
                    style={{ padding: '5px 8px' }}
                    title="Delete Guide"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── CREATE / EDIT MODAL ── */}
      {showModal && (
        <Modal
          title={editingItem ? 'Edit Bridge Guide' : 'Add New Bridge Guide'}
          onClose={() => setShowModal(false)}
          wide
          footer={
            <>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowModal(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="guide-form"
                className="btn btn-primary"
                disabled={saving}
                style={{ background: '#0284C7', borderColor: '#0284C7' }}
              >
                {saving
                  ? 'Saving…'
                  : editingItem
                  ? 'Update Guide'
                  : 'Publish to Website'}
              </button>
            </>
          }
        >
          <form
            id="guide-form"
            onSubmit={handleSave}
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            {/* Guide Title */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: '#334155',
                  marginBottom: 5,
                }}
              >
                Guide Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. The Ultimate RERA & Legal Verification Handbook for Homebuyers"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '1.5px solid #CBD5E1',
                  fontSize: 13.5,
                }}
              />
            </div>

            {/* Guide Thumbnail / Cover Image */}
            <div>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: '#334155',
                  marginBottom: 6,
                }}
              >
                <span>Guide Thumbnail / Cover Image</span>
                <span style={{ fontSize: 11, fontWeight: 500, color: '#64748B' }}>
                  Recommended: 16:9 or 4:3 ratio
                </span>
              </label>

              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageFileChange}
                style={{ display: 'none' }}
              />

              {formData.thumbnail ? (
                <div
                  style={{
                    border: '1.5px solid #CBD5E1',
                    borderRadius: 10,
                    padding: '12px',
                    background: '#F8FAFC',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 14,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: 72,
                        height: 52,
                        borderRadius: 6,
                        overflow: 'hidden',
                        background: '#E2E8F0',
                        flexShrink: 0,
                        border: '1px solid #CBD5E1',
                      }}
                    >
                      <img
                        src={formData.thumbnail}
                        alt="Thumbnail preview"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
                        Thumbnail Image Ready
                      </div>
                      <div style={{ fontSize: 11.5, color: '#16A34A', fontWeight: 600 }}>
                        ✓ Uploaded & Active
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      onClick={() => imageInputRef.current?.click()}
                      disabled={uploadingImage}
                      style={{ padding: '5px 12px', fontSize: 12 }}
                    >
                      <Upload size={13} /> Change
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={handleRemoveImage}
                      disabled={uploadingImage}
                      style={{ padding: '5px 10px' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => !uploadingImage && imageInputRef.current?.click()}
                  style={{
                    border: '2px dashed #CBD5E1',
                    borderRadius: 10,
                    padding: '22px 16px',
                    textAlign: 'center',
                    cursor: uploadingImage ? 'wait' : 'pointer',
                    background: '#F8FAFC',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#0284C7';
                    e.currentTarget.style.background = '#F0F9FF';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#CBD5E1';
                    e.currentTarget.style.background = '#F8FAFC';
                  }}
                >
                  {uploadingImage ? (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 6,
                        color: '#0284C7',
                      }}
                    >
                      <RefreshCw size={22} className="spin" />
                      <span style={{ fontSize: 13, fontWeight: 600 }}>Uploading image...</span>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 5,
                      }}
                    >
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 8,
                          background: '#E0F2FE',
                          display: 'grid',
                          placeItems: 'center',
                          color: '#0284C7',
                        }}
                      >
                        <ImageIcon size={20} />
                      </div>
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#0284C7' }}>
                          Click to upload Thumbnail
                        </span>
                        <span style={{ fontSize: 13, color: '#64748B' }}> or drag and drop</span>
                      </div>
                      <span style={{ fontSize: 11.5, color: '#94A3B8' }}>
                        PNG, JPG, WEBP up to 10MB
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Direct image URL input */}
              <div style={{ marginTop: 8 }}>
                <input
                  type="url"
                  placeholder="Or enter direct image URL (e.g. https://images.unsplash.com/...)"
                  value={formData.thumbnail || ''}
                  onChange={(e) => setFormData({ ...formData, thumbnail: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '7px 12px',
                    borderRadius: 8,
                    border: '1px solid #CBD5E1',
                    fontSize: 12.5,
                  }}
                />
              </div>
            </div>

            {/* PDF Upload Section */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: '#334155',
                  marginBottom: 6,
                }}
              >
                PDF Document File *
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handlePdfFileChange}
                style={{ display: 'none' }}
              />

              {formData.pdfUrl ? (
                <div
                  style={{
                    border: '1.5px solid #CBD5E1',
                    borderRadius: 10,
                    padding: '16px',
                    background: '#F8FAFC',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 8,
                        background: '#FEE2E2',
                        color: '#DC2626',
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <FileText size={22} />
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: '#0F172A',
                          wordBreak: 'break-all',
                        }}
                      >
                        {formData.fileName || 'Attached_Guide.pdf'}
                      </div>
                      <div style={{ fontSize: 12, color: '#16A34A', fontWeight: 600 }}>
                        ✓ PDF Ready {formData.fileSize ? `(${formData.fileSize})` : ''}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingPdf}
                      style={{ padding: '5px 12px', fontSize: 12 }}
                    >
                      <Upload size={13} /> Change File
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={handleRemovePdf}
                      disabled={uploadingPdf}
                      style={{ padding: '5px 10px' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => !uploadingPdf && fileInputRef.current?.click()}
                  style={{
                    border: '2px dashed #CBD5E1',
                    borderRadius: 10,
                    padding: '28px 16px',
                    textAlign: 'center',
                    cursor: uploadingPdf ? 'wait' : 'pointer',
                    background: '#F8FAFC',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#0284C7';
                    e.currentTarget.style.background = '#F0F9FF';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#CBD5E1';
                    e.currentTarget.style.background = '#F8FAFC';
                  }}
                >
                  {uploadingPdf ? (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 6,
                        color: '#0284C7',
                      }}
                    >
                      <RefreshCw size={24} className="spin" />
                      <span style={{ fontSize: 13, fontWeight: 600 }}>Uploading PDF document...</span>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 10,
                          background: '#E0F2FE',
                          display: 'grid',
                          placeItems: 'center',
                          color: '#0284C7',
                        }}
                      >
                        <FileText size={22} />
                      </div>
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#0284C7' }}>
                          Click to upload PDF
                        </span>
                        <span style={{ fontSize: 13, color: '#64748B' }}> or drag and drop</span>
                      </div>
                      <span style={{ fontSize: 11.5, color: '#94A3B8' }}>
                        PDF format up to 20MB
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Direct PDF URL input option */}
              <div style={{ marginTop: 8 }}>
                <input
                  type="url"
                  placeholder="Or enter direct PDF URL (e.g. https://yourdomain.com/handbook.pdf)"
                  value={formData.pdfUrl || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    const fName = val.split('/').pop() || 'document.pdf';
                    setFormData({
                      ...formData,
                      pdfUrl: val,
                      fileName: formData.fileName || fName,
                    });
                  }}
                  style={{
                    width: '100%',
                    padding: '7px 12px',
                    borderRadius: 8,
                    border: '1px solid #CBD5E1',
                    fontSize: 12.5,
                  }}
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: '#334155',
                  marginBottom: 5,
                }}
              >
                Guide Description *
              </label>
              <textarea
                rows={4}
                required
                placeholder="Briefly describe what this handbook covers and why homebuyers or investors should read it..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '1.5px solid #CBD5E1',
                  fontSize: 13.5,
                }}
              />
            </div>

            {/* Category and Status Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: '#334155',
                    marginBottom: 5,
                  }}
                >
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: '1.5px solid #CBD5E1',
                    fontSize: 13.5,
                    background: '#fff',
                  }}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: '#334155',
                    marginBottom: 5,
                  }}
                >
                  Website Visibility
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: '1.5px solid #CBD5E1',
                    fontSize: 13.5,
                    background: '#fff',
                  }}
                >
                  <option value="active">Active (Visible on Website)</option>
                  <option value="inactive">Inactive (Draft / Hidden)</option>
                </select>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* ── MODAL: READ GUIDE INLINE PDF VIEWER ── */}
      {readingGuide && (
        <Modal
          title={`Reading Guide: ${readingGuide.title}`}
          onClose={() => setReadingGuide(null)}
          wide
          footer={
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                width: '100%',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', gap: 8 }}>
                <a
                  href={readingGuide.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: '#0284C7',
                    borderColor: '#0284C7',
                  }}
                >
                  <ExternalLink size={14} /> Open in New Tab
                </a>
                <a
                  href={readingGuide.pdfUrl}
                  download={readingGuide.fileName || 'guide.pdf'}
                  className="btn btn-outline"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Download size={14} /> Download PDF
                </a>
              </div>
              <button className="btn btn-outline" onClick={() => setReadingGuide(null)}>
                Close
              </button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Guide Meta Header */}
            <div
              style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: 10,
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {readingGuide.thumbnail && (
                  <div
                    style={{
                      width: 54,
                      height: 42,
                      borderRadius: 6,
                      overflow: 'hidden',
                      flexShrink: 0,
                      border: '1px solid #CBD5E1',
                    }}
                  >
                    <img
                      src={readingGuide.thumbnail}
                      alt={readingGuide.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                )}
                <div>
                  <div style={{ marginBottom: 4 }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: '#E0F2FE',
                        color: '#0284C7',
                        marginRight: 8,
                      }}
                    >
                      {readingGuide.category}
                    </span>
                    <span style={{ fontSize: 13, color: '#334155', fontWeight: 600 }}>
                      {readingGuide.fileName || 'guide.pdf'}{' '}
                      {readingGuide.fileSize ? `(${readingGuide.fileSize})` : ''}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>
                    Published on {formatDate(readingGuide.createdAt)}
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            <p style={{ margin: 0, fontSize: 13.5, color: '#475569', lineHeight: 1.6 }}>
              {readingGuide.description}
            </p>

            {/* Embedded PDF Viewer Iframe */}
            <div
              style={{
                width: '100%',
                height: 540,
                borderRadius: 10,
                overflow: 'hidden',
                border: '1.5px solid #CBD5E1',
                background: '#525659',
              }}
            >
              <iframe
                src={readingGuide.pdfUrl}
                title={readingGuide.title}
                style={{ width: '100%', height: '100%', border: 0 }}
              />
            </div>
          </div>
        </Modal>
      )}

      {/* ── CONFIRM DELETE DIALOG ── */}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete Bridge Guide"
          message={`Are you sure you want to delete "${confirmDelete.title}"? Homebuyers will no longer be able to download or read this guide.`}
          confirmText="Yes, Delete Guide"
          confirmVariant="danger"
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
