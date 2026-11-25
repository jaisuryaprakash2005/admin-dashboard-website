import { useState, useEffect, useMemo, useRef } from 'react';
import {
  BookOpen,
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
  Image as ImageIcon,
  Calendar,
  User,
  Sparkles,
  Tag,
  ListChecks,
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

async function uploadBlogImage(file) {
  // 1. Direct Cloudinary unsigned upload
  if (CLOUD_NAME && UPLOAD_PRESET) {
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('upload_preset', UPLOAD_PRESET);
      form.append('folder', 'probridge/blogs');
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
    formData.append('type', 'blog');
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

const CATEGORIES = [
  'Market Analysis',
  'Architecture & Living',
  'Investment Tips',
  'Legal & RERA Diligence',
  'Home Buying Guide',
  'Property Trends',
  'General',
];

const INITIAL_FORM = {
  title: '',
  image: '',
  description: '',
  keyfactors: '',
  category: 'Market Analysis',
  author: 'ProBridge Editorial Team',
  status: 'published',
};

export default function Blogs() {
  const toast = useToast();
  const fileInputRef = useRef(null);

  const [blogs, setBlogs] = useState([]);
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
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState('');

  // Reader / Full view modal
  const [viewingBlog, setViewingBlog] = useState(null);

  // Delete confirm
  const [confirmDelete, setConfirmDelete] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await adminService.listBlogs();
      setBlogs(Array.isArray(res) ? res : []);
    } catch (err) {
      toast.error('Failed to load blogs: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered blogs
  const filteredBlogs = useMemo(() => {
    return blogs.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const matchQ =
        !q ||
        item.title?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.author?.toLowerCase().includes(q) ||
        (Array.isArray(item.keyfactors) &&
          item.keyfactors.some((k) => k.toLowerCase().includes(q)));

      const matchCategory = categoryFilter === 'all' || item.category === categoryFilter;
      const matchStatus = statusFilter === 'all' || item.status === statusFilter;

      return matchQ && matchCategory && matchStatus;
    });
  }, [blogs, searchQuery, categoryFilter, statusFilter]);

  // Stats
  const stats = useMemo(() => {
    const total = blogs.length;
    const published = blogs.filter((b) => b.status === 'published').length;
    const drafts = total - published;
    return { total, published, drafts };
  }, [blogs]);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setImagePreview('');
    setFormData(INITIAL_FORM);
    setShowModal(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setImagePreview(item.image || '');
    setFormData({
      title: item.title || '',
      image: item.image || '',
      description: item.description || '',
      keyfactors: Array.isArray(item.keyfactors)
        ? item.keyfactors.join('\n')
        : item.keyfactors || '',
      category: item.category || 'Market Analysis',
      author: item.author || 'ProBridge Editorial Team',
      status: item.status || 'published',
    });
    setShowModal(true);
  };

  // Image upload handling
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
      const url = await uploadBlogImage(file);
      if (url) {
        setFormData((prev) => ({ ...prev, image: url }));
        setImagePreview(url);
        toast.success('Blog cover image uploaded!');
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
    setFormData((prev) => ({ ...prev, image: '' }));
    setImagePreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error('Blog title is required');
      return;
    }
    if (!formData.description.trim()) {
      toast.error('Blog description/content is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        keyfactors: formData.keyfactors
          .split('\n')
          .map((k) => k.trim())
          .filter(Boolean),
      };

      if (editingItem) {
        await adminService.updateBlog(editingItem._id || editingItem.id, payload);
        toast.success(`Blog "${formData.title}" updated successfully!`);
      } else {
        await adminService.createBlog(payload);
        toast.success(`Blog "${formData.title}" published!`);
      }
      setShowModal(false);
      loadData();
    } catch (err) {
      toast.error('Failed to save blog: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    try {
      await adminService.deleteBlog(item._id || item.id);
      toast.success('Blog deleted successfully');
      setConfirmDelete(null);
      if (viewingBlog && (viewingBlog._id || viewingBlog.id) === (item._id || item.id)) {
        setViewingBlog(null);
      }
      loadData();
    } catch (err) {
      toast.error('Failed to delete blog: ' + err.message);
    }
  };

  const handleToggleStatus = async (item) => {
    const nextStatus = item.status === 'published' ? 'draft' : 'published';
    try {
      await adminService.toggleBlogStatus(item._id || item.id, nextStatus);
      toast.success(`Blog marked as ${nextStatus === 'published' ? 'Published' : 'Draft'}`);
      setBlogs((prev) =>
        prev.map((b) =>
          (b._id || b.id) === (item._id || item.id) ? { ...b, status: nextStatus } : b
        )
      );
    } catch (err) {
      toast.error('Failed to update status: ' + err.message);
    }
  };

  // Parsed live keyfactors for modal preview
  const liveKeyfactors = useMemo(() => {
    if (!formData.keyfactors) return [];
    return formData.keyfactors
      .split('\n')
      .map((k) => k.trim())
      .filter(Boolean);
  }, [formData.keyfactors]);

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
              background: 'linear-gradient(135deg, #0D5F4E, #093E33)',
              display: 'grid',
              placeItems: 'center',
              color: '#fff',
              boxShadow: '0 4px 14px rgba(13, 95, 78, 0.3)',
            }}
          >
            <BookOpen size={24} />
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
              Blogs & Articles
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748B' }}>
              Publish informative real estate articles, guides, and key market insights
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn btn-outline" onClick={loadData} title="Refresh Blogs">
            <RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh
          </button>
          <button
            className="btn btn-primary"
            onClick={handleOpenAdd}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={16} /> Create New Blog
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
            <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Total Articles</span>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', marginTop: 2 }}>
              {stats.total}
            </div>
          </div>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: '#F0FDF4',
              color: '#0D5F4E',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <BookOpen size={20} />
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
            <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>
              Published on Website
            </span>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#16A34A', marginTop: 2 }}>
              {stats.published}
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
            <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Drafts</span>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#64748B', marginTop: 2 }}>
              {stats.drafts}
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

      {/* ── Filters & Search ── */}
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
            placeholder="Search by title, description, or key factor..."
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
          <option value="published">Published (Live)</option>
          <option value="draft">Draft (Hidden)</option>
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
          <Loading message="Loading blogs..." />
        </div>
      ) : filteredBlogs.length === 0 ? (
        <div
          style={{
            background: '#fff',
            borderRadius: 14,
            border: '1.5px solid #E2E8F0',
            padding: '60px 20px',
            textAlign: 'center',
          }}
        >
          <BookOpen size={48} style={{ color: '#94A3B8', margin: '0 auto 12px' }} />
          <h3 style={{ margin: 0, fontSize: 18, color: '#0F172A', fontWeight: 700 }}>
            No Blogs Found
          </h3>
          <p style={{ margin: '6px 0 16px', color: '#64748B', fontSize: 13 }}>
            {blogs.length === 0
              ? 'Click "+ Create New Blog" above to write and publish your first article.'
              : 'Try clearing your search query or filters.'}
          </p>
          {blogs.length === 0 && (
            <button className="btn btn-primary" onClick={handleOpenAdd}>
              <Plus size={16} /> Write First Blog
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
          {filteredBlogs.map((b) => {
            const kFactors = Array.isArray(b.keyfactors) ? b.keyfactors : [];

            return (
              <div
                key={b._id || b.id}
                style={{
                  background: '#fff',
                  borderRadius: 14,
                  border: '1.5px solid #E2E8F0',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
                  transition: 'all 0.2s',
                }}
              >
                <div>
                  {/* Banner Image */}
                  <div
                    style={{
                      height: 180,
                      background: '#F1F5F9',
                      position: 'relative',
                      overflow: 'hidden',
                      cursor: 'pointer',
                    }}
                    onClick={() => setViewingBlog(b)}
                  >
                    {b.image ? (
                      <img
                        src={b.image}
                        alt={b.title}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          transition: 'transform 0.3s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.03)')}
                        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                      />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          display: 'grid',
                          placeItems: 'center',
                          color: '#94A3B8',
                          background: 'linear-gradient(135deg, #F8FAFC, #E2E8F0)',
                        }}
                      >
                        <ImageIcon size={36} />
                      </div>
                    )}

                    {/* Top Badges */}
                    <div
                      style={{
                        position: 'absolute',
                        top: 10,
                        left: 10,
                        background: 'rgba(15, 23, 42, 0.78)',
                        backdropFilter: 'blur(4px)',
                        color: '#fff',
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 6,
                      }}
                    >
                      {b.category || 'Real Estate'}
                    </div>

                    <div
                      style={{
                        position: 'absolute',
                        top: 10,
                        right: 10,
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 6,
                        background:
                          b.status === 'published'
                            ? 'rgba(22, 163, 74, 0.92)'
                            : 'rgba(100, 116, 139, 0.92)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: '#fff',
                        }}
                      />
                      {b.status === 'published' ? 'Live' : 'Draft'}
                    </div>
                  </div>

                  {/* Body Content */}
                  <div style={{ padding: '18px' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        fontSize: 12,
                        color: '#64748B',
                        marginBottom: 8,
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <User size={13} color="#0D5F4E" /> {b.author || 'Admin'}
                      </span>
                      <span>•</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Calendar size={13} /> {formatDate(b.createdAt)}
                      </span>
                    </div>

                    <h3
                      style={{
                        margin: '0 0 10px',
                        fontSize: 17,
                        fontWeight: 800,
                        color: '#0F172A',
                        lineHeight: 1.35,
                        cursor: 'pointer',
                      }}
                      onClick={() => setViewingBlog(b)}
                    >
                      {b.title}
                    </h3>

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
                      {b.description}
                    </p>

                    {/* Key Factors Box */}
                    {kFactors.length > 0 && (
                      <div
                        style={{
                          background: '#F8FAFC',
                          border: '1px solid #E2E8F0',
                          borderRadius: 8,
                          padding: '10px 12px',
                          marginBottom: 6,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 11.5,
                            fontWeight: 700,
                            color: '#0D5F4E',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            marginBottom: 6,
                          }}
                        >
                          <ListChecks size={13} /> Key Factors ({kFactors.length}):
                        </div>
                        <ul
                          style={{
                            margin: 0,
                            paddingLeft: 18,
                            fontSize: 12,
                            color: '#334155',
                            lineHeight: 1.45,
                          }}
                        >
                          {kFactors.slice(0, 3).map((factor, idx) => (
                            <li key={idx} style={{ marginBottom: 3 }}>
                              {factor}
                            </li>
                          ))}
                          {kFactors.length > 3 && (
                            <li style={{ color: '#0D5F4E', fontWeight: 600, listStyleType: 'none' }}>
                              +{kFactors.length - 3} more factors in full view...
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Controls */}
                <div
                  style={{
                    padding: '12px 18px',
                    borderTop: '1px solid #F1F5F9',
                    background: '#FAFAFA',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      className="btn btn-sm btn-outline"
                      title="Preview Article"
                      onClick={() => setViewingBlog(b)}
                      style={{ padding: '4px 10px', fontSize: 12 }}
                    >
                      <Eye size={13} /> Read
                    </button>

                    <button
                      className="btn btn-sm btn-outline"
                      title={b.status === 'published' ? 'Unpublish (Draft)' : 'Publish to Website'}
                      onClick={() => handleToggleStatus(b)}
                      style={{
                        padding: '4px 8px',
                        color: b.status === 'published' ? '#16a34a' : '#64748b',
                      }}
                    >
                      {b.status === 'published' ? (
                        <ToggleRight size={17} />
                      ) : (
                        <ToggleLeft size={17} />
                      )}
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={() => handleOpenEdit(b)}
                      style={{ padding: '4px 10px', fontSize: 12 }}
                    >
                      <Edit2 size={13} /> Edit
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => setConfirmDelete(b)}
                      style={{ padding: '4px 8px' }}
                      title="Delete Blog"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── CREATE / EDIT MODAL ── */}
      {showModal && (
        <Modal
          title={editingItem ? 'Edit Blog Article' : 'Create New Blog Article'}
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
                form="blog-form"
                className="btn btn-primary"
                disabled={saving}
              >
                {saving
                  ? 'Saving…'
                  : editingItem
                  ? 'Update Blog'
                  : 'Publish Blog Article'}
              </button>
            </>
          }
        >
          <form
            id="blog-form"
            onSubmit={handleSave}
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            {/* Title */}
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
                Blog Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Essential Guide to Buying Real Estate in South India: 2026 Edition"
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

            {/* Image Upload Section */}
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
                Featured Cover Image (Upload or URL)
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
                    maxHeight: 200,
                    background: '#F8FAFC',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <img
                    src={imagePreview}
                    alt="Cover Preview"
                    style={{ width: '100%', height: 200, objectFit: 'cover' }}
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
                      style={{
                        background: 'rgba(255,255,255,0.92)',
                        backdropFilter: 'blur(4px)',
                        padding: '4px 10px',
                        fontSize: 12,
                      }}
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
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#0D5F4E';
                    e.currentTarget.style.background = '#F0FDF4';
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
                        color: '#0D5F4E',
                      }}
                    >
                      <RefreshCw size={24} className="spin" />
                      <span style={{ fontSize: 13, fontWeight: 600 }}>Uploading image...</span>
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
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#0D5F4E' }}>
                          Click to upload cover image
                        </span>
                        <span style={{ fontSize: 13, color: '#64748B' }}> or drag and drop</span>
                      </div>
                      <span style={{ fontSize: 11.5, color: '#94A3B8' }}>
                        PNG, JPG, WEBP up to 5MB
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Direct Image URL input */}
              <div style={{ marginTop: 8 }}>
                <input
                  type="url"
                  placeholder="Or paste direct image URL (e.g. https://images.unsplash.com/...)"
                  value={formData.image || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData({ ...formData, image: val });
                    setImagePreview(val);
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

            {/* Category and Author Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
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
                  Author Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. ProBridge Research Desk"
                  value={formData.author}
                  onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: '1.5px solid #CBD5E1',
                    fontSize: 13.5,
                  }}
                />
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
                  Status
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
                  <option value="published">Published (Live on Website)</option>
                  <option value="draft">Draft (Hidden)</option>
                </select>
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
                Blog Description & Content *
              </label>
              <textarea
                rows={5}
                required
                placeholder="Write the full blog article or detailed description here..."
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

            {/* Key Factors */}
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 5,
                }}
              >
                <label
                  style={{
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: '#334155',
                  }}
                >
                  Key Factors (One factor per line)
                </label>
                <span style={{ fontSize: 11.5, color: '#0D5F4E', fontWeight: 600 }}>
                  {liveKeyfactors.length} factors recognized
                </span>
              </div>
              <textarea
                rows={4}
                placeholder="e.g.&#10;Strict RERA approval and legal title diligence&#10;Proximity to upcoming metro stations and ring roads&#10;High rental yield potential in IT-centric corridors&#10;Builder track record and construction delivery speed"
                value={formData.keyfactors}
                onChange={(e) => setFormData({ ...formData, keyfactors: e.target.value })}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '1.5px solid #CBD5E1',
                  fontSize: 13.5,
                }}
              />

              {liveKeyfactors.length > 0 && (
                <div
                  style={{
                    marginTop: 8,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 6,
                  }}
                >
                  {liveKeyfactors.map((kf, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: 12,
                        background: '#F0FDF4',
                        color: '#166534',
                        border: '1px solid #BBF7D0',
                        padding: '3px 9px',
                        borderRadius: 6,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <CheckCircle2 size={12} color="#16a34a" /> {kf}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </form>
        </Modal>
      )}

      {/* ── MODAL: VIEW FULL BLOG ARTICLE ── */}
      {viewingBlog && (
        <Modal
          title="Blog Article Details"
          onClose={() => setViewingBlog(null)}
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
              <button
                className="btn btn-outline"
                onClick={() => {
                  const b = viewingBlog;
                  setViewingBlog(null);
                  handleOpenEdit(b);
                }}
              >
                <Edit2 size={14} /> Edit This Blog
              </button>
              <button className="btn btn-primary" onClick={() => setViewingBlog(null)}>
                Close
              </button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {viewingBlog.image && (
              <div
                style={{
                  borderRadius: 10,
                  overflow: 'hidden',
                  maxHeight: 280,
                  background: '#F1F5F9',
                }}
              >
                <img
                  src={viewingBlog.image}
                  alt={viewingBlog.title}
                  style={{ width: '100%', height: 280, objectFit: 'cover' }}
                />
              </div>
            )}

            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 8,
                  flexWrap: 'wrap',
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: 6,
                    background: '#DCFCE7',
                    color: '#166534',
                  }}
                >
                  {viewingBlog.category || 'Real Estate'}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: 6,
                    background: viewingBlog.status === 'published' ? '#EFF6FF' : '#F1F5F9',
                    color: viewingBlog.status === 'published' ? '#1E40AF' : '#64748B',
                  }}
                >
                  {viewingBlog.status === 'published' ? 'Live on Website' : 'Draft'}
                </span>
                <span style={{ fontSize: 12.5, color: '#64748B', marginLeft: 'auto' }}>
                  By {viewingBlog.author || 'Admin'} • {formatDate(viewingBlog.createdAt)}
                </span>
              </div>

              <h2
                style={{
                  margin: '0 0 14px',
                  fontSize: 22,
                  fontWeight: 800,
                  color: '#0F172A',
                  lineHeight: 1.35,
                }}
              >
                {viewingBlog.title}
              </h2>

              <p
                style={{
                  fontSize: 14.5,
                  color: '#334155',
                  lineHeight: 1.7,
                  whiteSpace: 'pre-line',
                  marginBottom: 20,
                }}
              >
                {viewingBlog.description}
              </p>

              {Array.isArray(viewingBlog.keyfactors) && viewingBlog.keyfactors.length > 0 && (
                <div
                  style={{
                    background: '#F8FAFC',
                    border: '1.5px solid #E2E8F0',
                    borderRadius: 12,
                    padding: '16px 20px',
                  }}
                >
                  <h4
                    style={{
                      margin: '0 0 10px',
                      fontSize: 14,
                      fontWeight: 800,
                      color: '#0D5F4E',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <ListChecks size={18} /> Key Factors & Highlights:
                  </h4>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: 20,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      fontSize: 13.5,
                      color: '#1E293B',
                      lineHeight: 1.5,
                    }}
                  >
                    {viewingBlog.keyfactors.map((kf, i) => (
                      <li key={i}>{kf}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* ── CONFIRM DELETE DIALOG ── */}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete Blog Article"
          message={`Are you sure you want to delete "${confirmDelete.title}"? This cannot be undone.`}
          confirmText="Yes, Delete Blog"
          confirmVariant="danger"
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
