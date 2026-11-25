import { useState, useEffect, useMemo } from 'react';
import {
  Video,
  Play,
  Plus,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  Edit2,
  Trash2,
  Copy,
  Check,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  Eye,
  Film,
} from 'lucide-react';
import Modal from '../components/Modal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { Empty, Loading } from '../components/StateBlock.jsx';
import { adminService } from '../services/adminService.js';
import { useToast } from '../context/ToastContext.jsx';
import { formatDate } from '../utils/format.js';

// Helper to extract YouTube ID from standard, short, embed or shorts URLs
export function getYouTubeId(url) {
  if (!url) return null;
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/
  );
  return match ? match[1] : null;
}

// Count words in a string
function countWords(str) {
  if (!str) return 0;
  return str.trim().split(/\s+/).filter(Boolean).length;
}

const CATEGORIES = [
  'Virtual Tours',
  'Market Trends',
  'Walkthrough',
  'Builder Spotlights',
  'Investment Advice',
  'Customer Stories',
  'General',
];

const INITIAL_FORM = {
  title: '',
  youtubeUrl: '',
  description: '',
  category: 'Virtual Tours',
  status: 'active',
};

export default function YoutubeLinks() {
  const toast = useToast();
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Modal & form states
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Active playing video modal
  const [previewVideo, setPreviewVideo] = useState(null);

  // Copied link toast state
  const [copiedId, setCopiedId] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await adminService.listYoutubeLinks();
      setLinks(Array.isArray(res) ? res : []);
    } catch (err) {
      toast.error('Failed to load YouTube links: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered links
  const filteredLinks = useMemo(() => {
    return links.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const matchQ =
        !q ||
        item.title?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.category?.toLowerCase().includes(q);

      const matchStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchCategory = categoryFilter === 'all' || item.category === categoryFilter;

      return matchQ && matchStatus && matchCategory;
    });
  }, [links, searchQuery, statusFilter, categoryFilter]);

  // Stats
  const stats = useMemo(() => {
    const total = links.length;
    const active = links.filter((l) => l.status === 'active').length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [links]);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData(INITIAL_FORM);
    setShowModal(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setFormData({
      title: item.title || '',
      youtubeUrl: item.youtubeUrl || '',
      description: item.description || '',
      category: item.category || 'Virtual Tours',
      status: item.status || 'active',
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error('Please enter a video title');
      return;
    }
    if (!formData.youtubeUrl.trim()) {
      toast.error('Please enter a valid YouTube URL');
      return;
    }
    const ytId = getYouTubeId(formData.youtubeUrl);
    if (!ytId) {
      toast.error('Could not parse YouTube Video ID. Please check the URL format.');
      return;
    }
    if (!formData.description.trim()) {
      toast.error('Please enter a description');
      return;
    }

    setSaving(true);
    try {
      if (editingItem) {
        await adminService.updateYoutubeLink(editingItem._id || editingItem.id, formData);
        toast.success(`Updated "${formData.title}" successfully!`);
      } else {
        await adminService.createYoutubeLink(formData);
        toast.success(`Published YouTube video "${formData.title}"!`);
      }
      setShowModal(false);
      loadData();
    } catch (err) {
      toast.error('Failed to save YouTube link: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    try {
      await adminService.deleteYoutubeLink(item._id || item.id);
      toast.success('YouTube link removed successfully');
      setConfirmDelete(null);
      loadData();
    } catch (err) {
      toast.error('Failed to delete YouTube link: ' + err.message);
    }
  };

  const handleToggleStatus = async (item) => {
    const nextStatus = item.status === 'active' ? 'inactive' : 'active';
    try {
      await adminService.toggleYoutubeLinkStatus(item._id || item.id, nextStatus);
      toast.success(`Video marked as ${nextStatus === 'active' ? 'Active (Live)' : 'Inactive (Hidden)'}`);
      setLinks((prev) =>
        prev.map((l) =>
          (l._id || l.id) === (item._id || item.id) ? { ...l, status: nextStatus } : l
        )
      );
    } catch (err) {
      toast.error('Failed to update status: ' + err.message);
    }
  };

  const handleCopyLink = (url, id) => {
    if (!url) return;
    navigator.clipboard?.writeText(url);
    setCopiedId(id);
    toast.success('YouTube link copied to clipboard!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const previewYtId = getYouTubeId(formData.youtubeUrl);
  const wordCount = countWords(formData.description);

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
              background: 'linear-gradient(135deg, #EF4444, #B91C1C)',
              display: 'grid',
              placeItems: 'center',
              color: '#fff',
              boxShadow: '0 4px 14px rgba(239, 68, 68, 0.3)',
            }}
          >
            <Video size={24} />
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
              YouTube Links
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748B' }}>
              Manage property virtual tours, walkthrough videos, and market analysis videos
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn btn-outline" onClick={loadData} title="Refresh Links">
            <RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh
          </button>
          <button
            className="btn btn-primary"
            onClick={handleOpenAdd}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#DC2626',
              borderColor: '#DC2626',
            }}
          >
            <Plus size={16} /> Add YouTube Video
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
            <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Total Videos</span>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', marginTop: 2 }}>
              {stats.total}
            </div>
          </div>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: '#FEE2E2',
              color: '#DC2626',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <Film size={20} />
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
              Live on Website
            </span>
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
            <Play size={20} />
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
            <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Hidden / Draft</span>
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
            placeholder="Search by title, description or category..."
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
          <Loading message="Loading YouTube links..." />
        </div>
      ) : filteredLinks.length === 0 ? (
        <div
          style={{
            background: '#fff',
            borderRadius: 14,
            border: '1.5px solid #E2E8F0',
            padding: '60px 20px',
            textAlign: 'center',
          }}
        >
          <Video size={48} style={{ color: '#94A3B8', margin: '0 auto 12px' }} />
          <h3 style={{ margin: 0, fontSize: 18, color: '#0F172A', fontWeight: 700 }}>
            No YouTube Videos Found
          </h3>
          <p style={{ margin: '6px 0 16px', color: '#64748B', fontSize: 13 }}>
            {links.length === 0
              ? 'Click "+ Add YouTube Video" above to publish your first video link.'
              : 'Try clearing your search query or filters.'}
          </p>
          {links.length === 0 && (
            <button
              className="btn btn-primary"
              onClick={handleOpenAdd}
              style={{ background: '#DC2626', borderColor: '#DC2626' }}
            >
              <Plus size={16} /> Add First Video
            </button>
          )}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: 18,
          }}
        >
          {filteredLinks.map((item) => {
            const ytId = getYouTubeId(item.youtubeUrl);
            const thumbUrl = ytId
              ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
              : null;
            const wCount = countWords(item.description);

            return (
              <div
                key={item._id || item.id}
                style={{
                  background: '#fff',
                  borderRadius: 14,
                  border: '1.5px solid #E2E8F0',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}
              >
                <div>
                  {/* Video Thumbnail / Play Trigger */}
                  <div
                    style={{
                      position: 'relative',
                      width: '100%',
                      height: 190,
                      background: '#0F172A',
                      cursor: ytId ? 'pointer' : 'default',
                      overflow: 'hidden',
                    }}
                    onClick={() => ytId && setPreviewVideo(item)}
                  >
                    {thumbUrl ? (
                      <img
                        src={thumbUrl}
                        alt={item.title}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          opacity: 0.88,
                          transition: 'opacity 0.2s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.88')}
                      />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          display: 'grid',
                          placeItems: 'center',
                          color: '#64748B',
                        }}
                      >
                        <Video size={40} />
                      </div>
                    )}

                    {/* Centered Red Play Badge */}
                    {ytId && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          width: 52,
                          height: 52,
                          borderRadius: '50%',
                          background: 'rgba(220, 38, 38, 0.92)',
                          color: '#fff',
                          display: 'grid',
                          placeItems: 'center',
                          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                          transition: 'transform 0.2s, background 0.2s',
                        }}
                      >
                        <Play size={24} style={{ marginLeft: 3 }} />
                      </div>
                    )}

                    {/* Category Tag overlay */}
                    <div
                      style={{
                        position: 'absolute',
                        top: 10,
                        left: 10,
                        background: 'rgba(15, 23, 42, 0.75)',
                        backdropFilter: 'blur(4px)',
                        color: '#fff',
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 6,
                      }}
                    >
                      {item.category || 'General'}
                    </div>

                    {/* Status Badge overlay */}
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
                          item.status === 'active'
                            ? 'rgba(22, 163, 74, 0.9)'
                            : 'rgba(100, 116, 139, 0.9)',
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
                      {item.status === 'active' ? 'Live' : 'Hidden'}
                    </div>
                  </div>

                  {/* Body Info */}
                  <div style={{ padding: '16px' }}>
                    <h3
                      style={{
                        margin: '0 0 8px',
                        fontSize: 16,
                        fontWeight: 800,
                        color: '#0F172A',
                        lineHeight: 1.4,
                      }}
                    >
                      {item.title}
                    </h3>

                    {/* Description (approx 20 words) */}
                    <p
                      style={{
                        margin: '0 0 10px',
                        fontSize: 13,
                        color: '#475569',
                        lineHeight: 1.5,
                      }}
                    >
                      {item.description}
                    </p>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        fontSize: 11.5,
                        color: '#94A3B8',
                      }}
                    >
                      <span>
                        Words: <strong style={{ color: '#334155' }}>{wCount}</strong>
                      </span>
                      <span>•</span>
                      <span>Added {formatDate(item.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Footer Controls */}
                <div
                  style={{
                    padding: '12px 16px',
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
                      title="Copy YouTube URL"
                      onClick={() => handleCopyLink(item.youtubeUrl, item._id || item.id)}
                      style={{ padding: '4px 8px' }}
                    >
                      {copiedId === (item._id || item.id) ? (
                        <Check size={14} color="#16a34a" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>

                    <a
                      href={item.youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-outline"
                      title="Open on YouTube"
                      style={{ padding: '4px 8px', color: '#DC2626' }}
                    >
                      <ExternalLink size={14} />
                    </a>

                    <button
                      className="btn btn-sm btn-outline"
                      title={item.status === 'active' ? 'Hide Video' : 'Make Video Live'}
                      onClick={() => handleToggleStatus(item)}
                      style={{
                        padding: '4px 8px',
                        color: item.status === 'active' ? '#16a34a' : '#64748b',
                      }}
                    >
                      {item.status === 'active' ? (
                        <ToggleRight size={17} />
                      ) : (
                        <ToggleLeft size={17} />
                      )}
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={() => handleOpenEdit(item)}
                      style={{ padding: '4px 10px', fontSize: 12 }}
                    >
                      <Edit2 size={13} /> Edit
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => setConfirmDelete(item)}
                      style={{ padding: '4px 8px' }}
                      title="Delete Video"
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

      {/* ── ADD / EDIT MODAL ── */}
      {showModal && (
        <Modal
          title={editingItem ? 'Edit YouTube Video' : 'Add New YouTube Video'}
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
                form="yt-form"
                className="btn btn-primary"
                disabled={saving}
                style={{ background: '#DC2626', borderColor: '#DC2626' }}
              >
                {saving
                  ? 'Saving…'
                  : editingItem
                  ? 'Update Video'
                  : 'Publish Video Link'}
              </button>
            </>
          }
        >
          <form
            id="yt-form"
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
                Video Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Exclusive Virtual Tour: Luxury 4 BHK Beach Villa in ECR"
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

            {/* YouTube URL */}
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
                YouTube URL *
              </label>
              <input
                type="url"
                required
                placeholder="e.g. https://www.youtube.com/watch?v=... or https://youtu.be/..."
                value={formData.youtubeUrl}
                onChange={(e) => setFormData({ ...formData, youtubeUrl: e.target.value })}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '1.5px solid #CBD5E1',
                  fontSize: 13.5,
                }}
              />
              <span style={{ fontSize: 11.5, color: '#64748B', marginTop: 4, display: 'block' }}>
                Supports standard watch links, youtu.be short links, embed links, and YouTube Shorts.
              </span>
            </div>

            {/* Live Video Preview in Modal */}
            {previewYtId && (
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#16A34A',
                    marginBottom: 6,
                  }}
                >
                  ✓ YouTube Video ID Detected: {previewYtId}
                </label>
                <div
                  style={{
                    position: 'relative',
                    width: '100%',
                    paddingBottom: '56.25%',
                    borderRadius: 10,
                    overflow: 'hidden',
                    background: '#000',
                  }}
                >
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${previewYtId}`}
                    title="YouTube video player preview"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      border: 0,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Description (20 words guideline) */}
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
                  Description (in ~20 words) *
                </label>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: wordCount > 25 ? '#EA580C' : '#0D5F4E',
                    background: wordCount > 25 ? '#FFF7ED' : '#F0FDF4',
                    padding: '2px 8px',
                    borderRadius: 6,
                    border: wordCount > 25 ? '1px solid #FFEDD5' : '1px solid #DCFCE7',
                  }}
                >
                  Word count: {wordCount} {wordCount <= 22 ? '(Target: ~20 words)' : ''}
                </span>
              </div>
              <textarea
                rows={3}
                required
                placeholder="Write a concise description in about 20 words highlighting key property specs or video highlights..."
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
              <span style={{ fontSize: 11.5, color: '#64748B', marginTop: 4, display: 'block' }}>
                Keep it concise and punchy (~20 words) to display clearly across cards and website listings.
              </span>
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
                  <option value="active">Active (Live on Website)</option>
                  <option value="inactive">Inactive (Draft / Hidden)</option>
                </select>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* ── MODAL: PREVIEW PLAYER ── */}
      {previewVideo && (
        <Modal
          title={previewVideo.title}
          onClose={() => setPreviewVideo(null)}
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
              <a
                href={previewVideo.youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <ExternalLink size={14} /> Open in YouTube
              </a>
              <button className="btn btn-primary" onClick={() => setPreviewVideo(null)}>
                Close
              </button>
            </div>
          }
        >
          <div>
            <div
              style={{
                position: 'relative',
                width: '100%',
                paddingBottom: '56.25%',
                borderRadius: 10,
                overflow: 'hidden',
                background: '#000',
                marginBottom: 16,
              }}
            >
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${getYouTubeId(
                  previewVideo.youtubeUrl
                )}?autoplay=1`}
                title={previewVideo.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  border: 0,
                }}
              />
            </div>
            <div style={{ fontSize: 14, color: '#334155', lineHeight: 1.6 }}>
              {previewVideo.description}
            </div>
          </div>
        </Modal>
      )}

      {/* ── CONFIRM DELETE DIALOG ── */}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete YouTube Video"
          message={`Are you sure you want to delete "${confirmDelete.title}"? This video link will be removed from website listings.`}
          confirmText="Yes, Delete Video"
          confirmVariant="danger"
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
