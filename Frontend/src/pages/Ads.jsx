import { useState, useMemo } from 'react';
import {
  Megaphone,
  Plus,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  Eye,
  Trash2,
  Upload,
  Crop,
  Building2,
  Search,
  ExternalLink,
  Smartphone,
  MousePointerClick,
  AlertCircle,
  Check,
  X,
  Sparkles,
  Link as LinkIcon,
  Globe,
  Sliders,
  Edit2,
} from 'lucide-react';
import useData from '../hooks/useData';
import { adminService } from '../services/adminService';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/format';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { Empty, Loading, ErrorState } from '../components/StateBlock';
import AdImageCropModal from '../components/AdImageCropModal';
import api from '../services/api';

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'elrw6gnd';
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'probridge';
const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

const TOP_BANNER_ASPECT_OPTIONS = [
  { label: '3:2 Standard (1200×800)', value: 1.5 },
  { label: '4:1 Panoramic (1600×400)', value: 4.0 },
  { label: '3.6:1 PropTiger (1440×400)', value: 3.6 },
  { label: '2.8:1 Landmark (1024×367)', value: 2.79 },
  { label: '3:1 Wide (1200×400)', value: 3.0 },
  { label: '16:9 Standard (1920×1080)', value: 1.78 },
  { label: 'Original Ratio (No Crop)', value: 'original' },
];

const AD_BANNER_ASPECT_OPTIONS = [
  { label: '3:2 Standard (Recommended)', value: 1.5 },
  { label: '16:9 Landscape', value: 1.78 },
  { label: '2.4:1 Wide Banner', value: 2.4 },
  { label: 'Original Ratio (No Crop)', value: 'original' },
];

async function uploadAdImage(blob) {
  // 1. Direct Cloudinary unsigned upload
  if (CLOUD_NAME && UPLOAD_PRESET) {
    try {
      const form = new FormData();
      form.append('file', blob, 'ad-banner.jpg');
      form.append('upload_preset', UPLOAD_PRESET);
      form.append('folder', 'probridge/ads');
      const res = await fetch(CLOUDINARY_URL, { method: 'POST', body: form });
      const data = await res.json();
      if (res.ok && (data.secure_url || data.url)) {
        return data.secure_url || data.url;
      }
    } catch (e) {
      console.warn('[Cloudinary direct upload fallback]', e.message);
    }
  }

  // 2. Backend /api/upload/image
  try {
    const formData = new FormData();
    formData.append('image', blob, 'ad-banner.jpg');
    formData.append('type', 'property');
    const uploadRes = await api.post('/api/upload/image', formData);
    if (uploadRes.data?.url) return uploadRes.data.url;
  } catch (backendErr) {
    console.warn('[Backend upload fallback]', backendErr.message);
  }

  // 3. Fallback: convert to base64 Data URI
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => resolve('');
    reader.readAsDataURL(blob);
  });
}

export default function Ads() {
  const toast = useToast();
  const { isSuperAdmin, user: currentUser } = useAuth();

  // Active section: 'ads' (Mobile App Ads) | 'top_banners' (Standalone Website Top Banners)
  const [activeSection, setActiveSection] = useState('ads');

  // ── Mobile App Ads Data ────────────────────────────────────────────────
  const { data: ads, loading, error, reload } = useData(() => adminService.listAds());
  const { data: properties = [] } = useData(() => adminService.listProperties());

  // ── Standalone Website Top Banners Data (NOT connected to ads) ─────────
  const {
    data: topBanners = [],
    loading: loadingTb,
    error: errorTb,
    reload: reloadTb,
  } = useData(() => adminService.listTopBanners());

  // Ads Filter tabs & search
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'pending' | 'published' | 'rejected'
  const [searchQ, setSearchQ] = useState('');

  // Top Banners search
  const [tbSearchQ, setTbSearchQ] = useState('');

  // Modals for Mobile Ads
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [previewAd, setPreviewAd] = useState(null);
  const [rejectingAd, setRejectingAd] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form State for Mobile Ad
  const [formTitle, setFormTitle] = useState('');
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [formEndDate, setFormEndDate] = useState(
    new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]
  );
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [propertySearch, setPropertySearch] = useState('');

  // Mobile Ad Image & Crop State
  const [rawImageSrc, setRawImageSrc] = useState(null);
  const [showCropper, setShowCropper] = useState(false);
  const [croppedBlob, setCroppedBlob] = useState(null);
  const [croppedPreviewUrl, setCroppedPreviewUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  // ── Standalone Top Banner State (Separate Column) ──────────────────────
  const [showCreateTbModal, setShowCreateTbModal] = useState(false);
  const [editingTb, setEditingTb] = useState(null);
  const [tbTitle, setTbTitle] = useState('');
  const [tbSubtitle, setTbSubtitle] = useState('');
  const [tbLink, setTbLink] = useState('');
  const [tbIsActive, setTbIsActive] = useState(true);
  const [rawTbSrc, setRawTbSrc] = useState(null);
  const [showTbCropper, setShowTbCropper] = useState(false);
  const [croppedTbBlob, setCroppedTbBlob] = useState(null);
  const [croppedTbUrl, setCroppedTbUrl] = useState('');
  const [tbAspectRatio, setTbAspectRatio] = useState(4.0);
  const [deleteTbId, setDeleteTbId] = useState(null);
  const [savingTb, setSavingTb] = useState(false);
  const [previewTb, setPreviewTb] = useState(null);

  // Filter properties for selector
  const eligibleProperties = useMemo(() => {
    const list = Array.isArray(properties) ? properties : (properties?.results || []);
    return list.filter((p) => {
      const q = propertySearch.toLowerCase().trim();
      if (!q) return true;
      return (
        (p.title && p.title.toLowerCase().includes(q)) ||
        (p.city && p.city.toLowerCase().includes(q)) ||
        (p.locality && p.locality.toLowerCase().includes(q)) ||
        (p.price && p.price.toLowerCase().includes(q))
      );
    });
  }, [properties, propertySearch]);

  const selectedProperty = useMemo(() => {
    return (properties || []).find((p) => (p.id || p._id) === selectedPropertyId);
  }, [properties, selectedPropertyId]);

  // Filter ads by tab & search
  const filteredAds = useMemo(() => {
    const list = Array.isArray(ads) ? ads : (ads?.results || []);
    return list.filter((ad) => {
      if (activeTab === 'pending' && ad.status !== 'pending_approval') return false;
      if (activeTab === 'published' && ad.status !== 'published') return false;
      if (activeTab === 'rejected' && ad.status !== 'rejected') return false;

      if (searchQ) {
        const q = searchQ.toLowerCase();
        const titleMatch = ad.title && ad.title.toLowerCase().includes(q);
        const propMatch = ad.property?.title && ad.property.title.toLowerCase().includes(q);
        const creatorMatch = ad.createdByName && ad.createdByName.toLowerCase().includes(q);
        return titleMatch || propMatch || creatorMatch;
      }
      return true;
    });
  }, [ads, activeTab, searchQ]);

  // Filter top banners by search
  const filteredTopBanners = useMemo(() => {
    const list = Array.isArray(topBanners) ? topBanners : (topBanners?.results || []);
    return list.filter((b) => {
      if (!tbSearchQ) return true;
      const q = tbSearchQ.toLowerCase();
      return (
        (b.title && b.title.toLowerCase().includes(q)) ||
        (b.subtitle && b.subtitle.toLowerCase().includes(q)) ||
        (b.link && b.link.toLowerCase().includes(q))
      );
    });
  }, [topBanners, tbSearchQ]);

  // Counts for Mobile Ads
  const counts = useMemo(() => {
    const list = Array.isArray(ads) ? ads : (ads?.results || []);
    return {
      all: list.length,
      pending: list.filter((a) => a.status === 'pending_approval').length,
      published: list.filter((a) => a.status === 'published').length,
      rejected: list.filter((a) => a.status === 'rejected').length,
      totalClicks: list.reduce((acc, a) => acc + (a.clicks || 0), 0),
    };
  }, [ads]);

  // Counts for Top Banners
  const tbCounts = useMemo(() => {
    const list = Array.isArray(topBanners) ? topBanners : (topBanners?.results || []);
    return {
      total: list.length,
      active: list.filter((b) => b.isActive !== false).length,
      inactive: list.filter((b) => b.isActive === false).length,
      clicks: list.reduce((acc, b) => acc + (b.clicks || 0), 0),
    };
  }, [topBanners]);

  // Handle local mobile ad image pick
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose a valid image file');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setRawImageSrc(reader.result);
      setShowCropper(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCropDone = (blob, previewUrl) => {
    setCroppedBlob(blob);
    setCroppedPreviewUrl(previewUrl);
    setShowCropper(false);
  };

  const resetForm = () => {
    setFormTitle('');
    setFormStartDate(new Date().toISOString().split('T')[0]);
    setFormEndDate(new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]);
    setSelectedPropertyId('');
    setPropertySearch('');
    setRawImageSrc(null);
    setCroppedBlob(null);
    setCroppedPreviewUrl('');
    setShowCreateModal(false);
  };

  // Submit Mobile Ad for Super Admin Approval
  const handleCreateAd = async (e) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      toast.error('Please enter an ad title or campaign name');
      return;
    }
    if (!croppedBlob && !croppedPreviewUrl) {
      toast.error('Please upload and crop an ad banner image');
      return;
    }
    if (!selectedPropertyId) {
      toast.error('Please select a redirect property for this ad');
      return;
    }
    if (!formStartDate || !formEndDate) {
      toast.error('Please set both start and end dates');
      return;
    }
    if (new Date(formEndDate) < new Date(formStartDate)) {
      toast.error('End date cannot be earlier than start date');
      return;
    }

    try {
      setActionLoading(true);
      setUploadingImage(true);

      let imageUrl = croppedPreviewUrl;
      if (croppedBlob) {
        imageUrl = await uploadAdImage(croppedBlob);
      }
      if (!imageUrl) {
        throw new Error('Failed to process or upload image');
      }

      setUploadingImage(false);

      await adminService.createAd({
        title: formTitle.trim(),
        image: imageUrl,
        property: selectedPropertyId,
        startDate: formStartDate,
        endDate: formEndDate,
      });

      toast.success('Ad submitted for Super Admin approval!');
      resetForm();
      reload();
    } catch (err) {
      console.error('[Create Ad Error]', err);
      toast.error(err.response?.data?.message || err.message || 'Failed to create ad');
    } finally {
      setActionLoading(false);
      setUploadingImage(false);
    }
  };

  // Publish Mobile Ad
  const handlePublish = async (adId) => {
    try {
      setActionLoading(true);
      await adminService.publishAd(adId);
      toast.success('Ad approved and published live to the mobile app!');
      reload();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to publish ad');
    } finally {
      setActionLoading(false);
    }
  };

  // Reject Mobile Ad
  const handleRejectConfirm = async () => {
    if (!rejectingAd) return;
    try {
      setActionLoading(true);
      await adminService.rejectAd(rejectingAd._id || rejectingAd.id, rejectionReason);
      toast.success('Ad rejected');
      setRejectingAd(null);
      setRejectionReason('');
      reload();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to reject ad');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Mobile Ad
  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    try {
      setActionLoading(true);
      await adminService.deleteAd(deleteId);
      toast.success('Ad deleted');
      setDeleteId(null);
      reload();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to delete ad');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Standalone Top Banner Handlers (Separate Column) ───────────────────
  const resetTbForm = () => {
    setTbTitle('');
    setTbSubtitle('');
    setTbLink('');
    setTbIsActive(true);
    setRawTbSrc(null);
    setCroppedTbBlob(null);
    setCroppedTbUrl('');
    setTbAspectRatio(4.0);
    setShowCreateTbModal(false);
    setEditingTb(null);
  };

  const openEditTb = (tb) => {
    setEditingTb(tb);
    setTbTitle(tb.title || '');
    setTbSubtitle(tb.subtitle || '');
    setTbLink(tb.link || '');
    setTbIsActive(tb.isActive !== false);
    setCroppedTbUrl(tb.image || '');
    setTbAspectRatio(tb.aspectRatio || 4.0);
    setCroppedTbBlob(null);
    setRawTbSrc(null);
    setShowCreateTbModal(true);
  };

  const handleTbFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose a valid image file');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setRawTbSrc(reader.result);
      setShowTbCropper(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleTbCropDone = (blob, previewUrl, ratio) => {
    setCroppedTbBlob(blob);
    setCroppedTbUrl(previewUrl);
    if (ratio) setTbAspectRatio(Number(Number(ratio).toFixed(2)));
    setShowTbCropper(false);
  };

  const handleSaveTopBanner = async (e) => {
    e.preventDefault();
    if (!croppedTbBlob && !croppedTbUrl) {
      toast.error('Please upload a long width top banner image');
      return;
    }

    try {
      setSavingTb(true);
      let imageUrl = croppedTbUrl;
      if (croppedTbBlob) {
        imageUrl = await uploadAdImage(croppedTbBlob);
      }
      if (!imageUrl) {
        throw new Error('Failed to upload top banner image');
      }

      if (editingTb) {
        await adminService.updateTopBanner(editingTb._id || editingTb.id, {
          title: tbTitle.trim(),
          subtitle: tbSubtitle.trim(),
          image: imageUrl,
          link: tbLink.trim(),
          isActive: tbIsActive,
          aspectRatio: tbAspectRatio || 4.0,
        });
        toast.success('Top banner updated successfully!');
      } else {
        await adminService.createTopBanner({
          title: tbTitle.trim(),
          subtitle: tbSubtitle.trim(),
          image: imageUrl,
          link: tbLink.trim(),
          isActive: tbIsActive,
          aspectRatio: tbAspectRatio || 4.0,
        });
        toast.success('Top banner published with matching ratio to website!');
      }

      resetTbForm();
      reloadTb();
    } catch (err) {
      console.error('[Top Banner Save Error]', err);
      toast.error(err.response?.data?.message || err.message || 'Failed to save top banner');
    } finally {
      setSavingTb(false);
    }
  };

  const handleToggleTbActive = async (tb) => {
    try {
      await adminService.updateTopBanner(tb._id || tb.id, {
        isActive: !tb.isActive,
      });
      toast.success(`Top banner ${!tb.isActive ? 'activated' : 'deactivated'}`);
      reloadTb();
    } catch (err) {
      toast.error('Failed to update banner status');
    }
  };

  const handleDeleteTbConfirm = async () => {
    if (!deleteTbId) return;
    try {
      setSavingTb(true);
      await adminService.deleteTopBanner(deleteTbId);
      toast.success('Top banner deleted');
      setDeleteTbId(null);
      reloadTb();
    } catch (err) {
      toast.error('Failed to delete top banner');
    } finally {
      setSavingTb(false);
    }
  };

  return (
    <div className="content">
      {/* ── Page Header ── */}
      <div className="page-head" style={{ marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Banner &amp; Ad Management</h1>
          </div>
          <p className="muted-text" style={{ margin: '4px 0 0', fontSize: 13 }}>
            Manage mobile app promotional campaigns and separate website search bar top banners.
          </p>
        </div>

        {activeSection === 'ads' ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', fontSize: 13 }}
          >
            <Plus size={16} />
            <span>Create Mobile Ad</span>
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              resetTbForm();
              setShowCreateTbModal(true);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 18px',
              fontSize: 13,
              background: '#0D5F4E',
              borderColor: '#0D5F4E',
            }}
          >
            <Plus size={16} />
            <span>Upload Website Top Banner</span>
          </button>
        )}
      </div>

      {/* ── Separate Column Switcher (Tabs) ────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: 6,
          background: 'var(--surface-muted, #f1f5f9)',
          borderRadius: 12,
          border: '1px solid var(--border)',
          marginBottom: 20,
          width: 'fit-content',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveSection('ads')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 18px',
            fontSize: 13,
            fontWeight: 700,
            borderRadius: 8,
            border: activeSection === 'ads' ? '1px solid #bfdbfe' : 'none',
            background: activeSection === 'ads' ? '#ffffff' : 'transparent',
            color: activeSection === 'ads' ? '#1d4ed8' : 'var(--muted)',
            boxShadow: activeSection === 'ads' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
            cursor: 'pointer',
            transition: 'all 0.16s ease',
          }}
        >
          <Smartphone size={16} />
          <span>Mobile App Ads ({counts.all})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('top_banners')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 18px',
            fontSize: 13,
            fontWeight: 700,
            borderRadius: 8,
            border: activeSection === 'top_banners' ? '1px solid #a7f3d0' : 'none',
            background: activeSection === 'top_banners' ? '#ffffff' : 'transparent',
            color: activeSection === 'top_banners' ? '#0D5F4E' : 'var(--muted)',
            boxShadow: activeSection === 'top_banners' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
            cursor: 'pointer',
            transition: 'all 0.16s ease',
          }}
        >
          <Sparkles size={16} color={activeSection === 'top_banners' ? '#0D5F4E' : undefined} />
          <span>Website Top Banners ({tbCounts.total})</span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              padding: '2px 6px',
              borderRadius: 4,
              background: activeSection === 'top_banners' ? '#ecfdf5' : '#e2e8f0',
              color: activeSection === 'top_banners' ? '#065F46' : '#64748b',
            }}
          >
            Standalone
          </span>
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 1: MOBILE APP ADS (Pure Ads, Not Connected to Top Banners)
          ═══════════════════════════════════════════════════════════════════════ */}
      {activeSection === 'ads' && (
        <>
          {/* Stats Bar */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 14,
              marginBottom: 20,
            }}
          >
            <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  background: '#eff6ff',
                  color: '#2563eb',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <Megaphone size={20} />
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{counts.all}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Total Ads</div>
              </div>
            </div>

            <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  background: '#f0fdf4',
                  color: '#16a34a',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <CheckCircle2 size={20} />
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#16a34a' }}>{counts.published}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Live / Published</div>
              </div>
            </div>

            <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  background: '#fffbeb',
                  color: '#d97706',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <Clock size={20} />
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#d97706' }}>{counts.pending}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Pending Approval</div>
              </div>
            </div>

            <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  background: '#faf5ff',
                  color: '#9333ea',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <MousePointerClick size={20} />
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#9333ea' }}>{counts.totalClicks}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>App Taps / Clicks</div>
              </div>
            </div>
          </div>

          {/* Filter Tabs & Search */}
          <div
            className="card"
            style={{
              padding: '12px 18px',
              marginBottom: 16,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 14,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { key: 'all', label: `All Ads (${counts.all})` },
                { key: 'pending', label: `Pending Approval (${counts.pending})` },
                { key: 'published', label: `Published (${counts.published})` },
                { key: 'rejected', label: `Rejected (${counts.rejected})` },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`btn btn-sm ${activeTab === tab.key ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: 12, padding: '5px 12px' }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ position: 'relative', width: 240 }}>
                <Search
                  size={14}
                  style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }}
                />
                <input
                  type="text"
                  placeholder="Search ad or property..."
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 10px 6px 30px',
                    fontSize: 12,
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Ads Table */}
          {loading ? (
            <Loading text="Loading Ads History..." />
          ) : error ? (
            <ErrorState text={error} onRetry={reload} />
          ) : filteredAds.length === 0 ? (
            <div className="card">
              <Empty
                text={
                  activeTab === 'pending'
                    ? 'No ads currently pending approval.'
                    : activeTab === 'published'
                    ? 'No published ads are currently active.'
                    : 'No ads found. Click "Create Mobile Ad" to get started.'
                }
              />
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Ad Banner</th>
                      <th>Campaign Title</th>
                      <th>Redirect Property</th>
                      <th>Ad Duration</th>
                      <th>Status</th>
                      <th>Created By</th>
                      <th>App Clicks</th>
                      <th className="right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAds.map((ad) => {
                      const now = new Date();
                      const start = new Date(ad.startDate);
                      const end = new Date(ad.endDate);
                      const isCurrent = ad.status === 'published' && start <= now && end >= now;

                      return (
                        <tr key={ad._id || ad.id}>
                          {/* Banner Preview */}
                          <td style={{ width: 130 }}>
                            <div
                              onClick={() => setPreviewAd(ad)}
                              style={{
                                width: 110,
                                height: 46,
                                borderRadius: 8,
                                overflow: 'hidden',
                                border: '1px solid var(--border)',
                                cursor: 'pointer',
                                position: 'relative',
                                background: '#0a0f1d',
                              }}
                              title="Click to preview mobile ad banner"
                            >
                              <img
                                src={ad.image}
                                alt={ad.title}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                              <div
                                style={{
                                  position: 'absolute',
                                  bottom: 2,
                                  right: 2,
                                  background: 'rgba(0,0,0,0.65)',
                                  color: '#fff',
                                  borderRadius: 4,
                                  padding: '1px 3px',
                                  display: 'flex',
                                  alignItems: 'center',
                                }}
                              >
                                <Eye size={10} />
                              </div>
                            </div>
                          </td>

                          {/* Title */}
                          <td>
                            <strong style={{ fontSize: 13, display: 'block', color: 'var(--text)' }}>
                              {ad.title}
                            </strong>
                            <small className="muted-text">
                              Created {formatDate(ad.createdAt)}
                            </small>
                          </td>

                          {/* Linked Property */}
                          <td>
                            {ad.property ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {ad.property.image && (
                                  <img
                                    src={ad.property.image}
                                    alt=""
                                    style={{ width: 34, height: 34, borderRadius: 6, objectFit: 'cover' }}
                                  />
                                )}
                                <div>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                                    {ad.property.title}
                                  </div>
                                  <small className="muted-text">
                                    {ad.property.city || ad.property.location || 'India'} •{' '}
                                    <strong style={{ color: '#15803d' }}>{ad.property.price}</strong>
                                  </small>
                                </div>
                              </div>
                            ) : (
                              <span style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>
                                None linked
                              </span>
                            )}
                          </td>

                          {/* Dates */}
                          <td>
                            <div style={{ fontSize: 12 }}>
                              <div><strong>Start:</strong> {formatDate(ad.startDate)}</div>
                              <div><strong>End:</strong> {formatDate(ad.endDate)}</div>
                            </div>
                          </td>

                          {/* Status */}
                          <td>
                            {isCurrent ? (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  padding: '3px 8px',
                                  borderRadius: 6,
                                  background: '#dcfce7',
                                  color: '#16a34a',
                                  border: '1px solid #bbf7d0',
                                }}
                              >
                                <CheckCircle2 size={12} /> Live / Active
                              </span>
                            ) : ad.status === 'published' ? (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  fontSize: 11,
                                  fontWeight: 600,
                                  padding: '3px 8px',
                                  borderRadius: 6,
                                  background: '#f1f5f9',
                                  color: '#64748b',
                                  border: '1px solid #e2e8f0',
                                }}
                              >
                                Expired
                              </span>
                            ) : ad.status === 'pending_approval' ? (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  padding: '3px 8px',
                                  borderRadius: 6,
                                  background: '#fef3c7',
                                  color: '#d97706',
                                  border: '1px solid #fde68a',
                                }}
                              >
                                <Clock size={12} /> Pending Approval
                              </span>
                            ) : ad.status === 'rejected' ? (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  padding: '3px 8px',
                                  borderRadius: 6,
                                  background: '#fef2f2',
                                  color: '#dc2626',
                                  border: '1px solid #fecaca',
                                }}
                              >
                                <XCircle size={12} /> Rejected
                              </span>
                            ) : (
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  padding: '3px 8px',
                                  borderRadius: 6,
                                  background: 'var(--grey-soft)',
                                  color: 'var(--muted)',
                                }}
                              >
                                Archived
                              </span>
                            )}
                            {ad.rejectionReason && (
                              <div style={{ fontSize: 10, color: '#dc2626', marginTop: 2 }}>
                                Reason: {ad.rejectionReason}
                              </div>
                            )}
                          </td>

                          {/* Created By */}
                          <td>
                            <div style={{ fontSize: 12, fontWeight: 600 }}>{ad.createdByName || 'Admin'}</div>
                            {ad.approvedByName && (
                              <small style={{ fontSize: 10, color: '#16a34a', display: 'block' }}>
                                Approved by: {ad.approvedByName}
                              </small>
                            )}
                          </td>

                          {/* Clicks */}
                          <td>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: '#9333ea' }}>
                              <MousePointerClick size={13} /> {ad.clicks || 0}
                            </div>
                          </td>

                          {/* Action buttons */}
                          <td className="right">
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              {isSuperAdmin && ad.status === 'pending_approval' && (
                                <>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-primary"
                                    onClick={() => handlePublish(ad._id || ad.id)}
                                    style={{ background: '#16a34a', fontSize: 11, padding: '4px 10px' }}
                                    title="Approve & Publish Ad"
                                  >
                                    <Check size={12} /> Approve
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-secondary"
                                    onClick={() => setRejectingAd(ad)}
                                    style={{ color: '#dc2626', fontSize: 11, padding: '4px 8px' }}
                                    title="Reject Ad"
                                  >
                                    <X size={12} /> Reject
                                  </button>
                                </>
                              )}

                              <button
                                type="button"
                                className="btn btn-sm btn-secondary"
                                onClick={() => setPreviewAd(ad)}
                                style={{ fontSize: 11, padding: '4px 8px' }}
                                title="Preview on mobile"
                              >
                                <Eye size={12} />
                              </button>

                              <button
                                type="button"
                                className="btn btn-sm btn-secondary"
                                onClick={() => setDeleteId(ad._id || ad.id)}
                                style={{ color: '#ef4444', fontSize: 11, padding: '4px 8px' }}
                                title="Delete ad"
                              >
                                <Trash2 size={12} />
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
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 2: SEPARATE COLUMN FOR WEBSITE TOP BANNERS (NOT CONNECTED TO ADS)
          ═══════════════════════════════════════════════════════════════════════ */}
      {activeSection === 'top_banners' && (
        <div>
          {/* Top Banners Stats Bar */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 14,
              marginBottom: 20,
            }}
          >
            <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  background: '#ecfdf5',
                  color: '#0D5F4E',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <Sparkles size={20} />
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{tbCounts.total}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Total Top Banners</div>
              </div>
            </div>

            <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  background: '#f0fdf4',
                  color: '#16a34a',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <CheckCircle2 size={20} />
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#16a34a' }}>{tbCounts.active}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Active on Search Bar</div>
              </div>
            </div>

            <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  background: '#f8fafc',
                  color: '#64748b',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <Clock size={20} />
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{tbCounts.inactive}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Draft / Paused</div>
              </div>
            </div>

            <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  background: '#eff6ff',
                  color: '#2563eb',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <MousePointerClick size={20} />
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#2563eb' }}>{tbCounts.clicks}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Website Taps</div>
              </div>
            </div>
          </div>

          {/* Search & Actions Bar */}
          <div
            className="card"
            style={{
              padding: '12px 18px',
              marginBottom: 16,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 14,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0D5F4E' }}>
                Separate Website Search Bar Column
              </div>
              <small className="muted-text">
                These banners are displayed one by one in an appear &amp; disappear crossfade animation right above the search bar.
              </small>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ position: 'relative', width: 240 }}>
                <Search
                  size={14}
                  style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }}
                />
                <input
                  type="text"
                  placeholder="Search top banner..."
                  value={tbSearchQ}
                  onChange={(e) => setTbSearchQ(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 10px 6px 30px',
                    fontSize: 12,
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                  }}
                />
              </div>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  resetTbForm();
                  setShowCreateTbModal(true);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 16px',
                  fontSize: 12,
                  background: '#0D5F4E',
                  borderColor: '#0D5F4E',
                }}
              >
                <Plus size={14} />
                <span>Upload Banner</span>
              </button>
            </div>
          </div>

          {/* Standalone Top Banners Table */}
          {loadingTb ? (
            <Loading text="Loading Top Banners..." />
          ) : errorTb ? (
            <ErrorState text={errorTb} onRetry={reloadTb} />
          ) : filteredTopBanners.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  background: '#ecfdf5',
                  color: '#0D5F4E',
                  display: 'grid',
                  placeItems: 'center',
                  margin: '0 auto 12px',
                }}
              >
                <Sparkles size={28} />
              </div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>No Website Top Banners Yet</h3>
              <p className="muted-text" style={{ margin: '6px 0 16px', fontSize: 13 }}>
                Upload a long-width banner image. It will rotate directly above the search bar on the ProBridge website.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  resetTbForm();
                  setShowCreateTbModal(true);
                }}
                style={{ background: '#0D5F4E', borderColor: '#0D5F4E', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Plus size={16} />
                <span>Upload First Top Banner</span>
              </button>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Top Banner (Long Width)</th>
                      <th>Headline &amp; Subtitle</th>
                      <th>Destination Link</th>
                      <th>Status on Website</th>
                      <th>Clicks</th>
                      <th>Created Date</th>
                      <th className="right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTopBanners.map((tb) => (
                      <tr key={tb._id || tb.id}>
                        {/* Long Width Image Preview */}
                        <td style={{ width: 220 }}>
                          <div
                            onClick={() => setPreviewTb(tb)}
                            style={{
                              width: 200,
                              height: 52,
                              borderRadius: 8,
                              overflow: 'hidden',
                              border: '1.5px solid var(--border)',
                              cursor: 'pointer',
                              position: 'relative',
                              background: '#0a0f1d',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                            }}
                            title="Click to preview banner on website hero"
                          >
                            <img
                              src={tb.image}
                              alt={tb.title || 'Top banner'}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                            <div
                              style={{
                                position: 'absolute',
                                bottom: 3,
                                right: 3,
                                background: 'rgba(0,0,0,0.7)',
                                color: '#fff',
                                borderRadius: 4,
                                padding: '1px 4px',
                                display: 'flex',
                                alignItems: 'center',
                              }}
                            >
                              <Eye size={10} />
                            </div>
                          </div>
                        </td>

                        {/* Title & Subtitle */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <strong style={{ fontSize: 13, color: 'var(--text)' }}>
                              {tb.title || 'Untitled Banner'}
                            </strong>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: '1px 6px',
                                borderRadius: 10,
                                background: '#E8F5F0',
                                color: '#0D5F4E',
                                border: '1px solid #A7F3D0',
                              }}
                            >
                              {tb.aspectRatio || 4.0}:1 Ratio
                            </span>
                          </div>
                          {tb.subtitle && (
                            <small className="muted-text" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>
                              {tb.subtitle}
                            </small>
                          )}
                        </td>

                        {/* Destination Link */}
                        <td>
                          {tb.link ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                fontSize: 11,
                                color: '#2563eb',
                                background: '#eff6ff',
                                padding: '3px 8px',
                                borderRadius: 4,
                                maxWidth: 180,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              title={tb.link}
                            >
                              <LinkIcon size={11} />
                              <span>{tb.link}</span>
                            </span>
                          ) : tb.property?.title ? (
                            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                              Property: {tb.property.title}
                            </span>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>
                              Default (Search Page)
                            </span>
                          )}
                        </td>

                        {/* Status Toggle Switch */}
                        <td>
                          <button
                            type="button"
                            onClick={() => handleToggleTbActive(tb)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '4px 10px',
                              borderRadius: 999,
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: 'pointer',
                              border: tb.isActive !== false ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                              background: tb.isActive !== false ? '#f0fdf4' : '#f8fafc',
                              color: tb.isActive !== false ? '#16a34a' : '#64748b',
                              transition: 'all 0.16s ease',
                            }}
                            title="Click to toggle banner active / inactive on website"
                          >
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background: tb.isActive !== false ? '#16a34a' : '#94a3b8',
                              }}
                            />
                            <span>{tb.isActive !== false ? 'Active on Search Bar' : 'Paused / Inactive'}</span>
                          </button>
                        </td>

                        {/* Clicks */}
                        <td>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: '#0D5F4E' }}>
                            <MousePointerClick size={13} /> {tb.clicks || 0}
                          </div>
                        </td>

                        {/* Date */}
                        <td>
                          <small className="muted-text">
                            {formatDate(tb.createdAt)}
                          </small>
                        </td>

                        {/* Actions */}
                        <td className="right">
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <button
                              type="button"
                              className="btn btn-sm btn-secondary"
                              onClick={() => openEditTb(tb)}
                              style={{ fontSize: 11, padding: '4px 8px' }}
                              title="Edit Top Banner"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-secondary"
                              onClick={() => setPreviewTb(tb)}
                              style={{ fontSize: 11, padding: '4px 8px' }}
                              title="Preview on Website Hero"
                            >
                              <Eye size={12} />
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-secondary"
                              onClick={() => setDeleteTbId(tb._id || tb.id)}
                              style={{ color: '#ef4444', fontSize: 11, padding: '4px 8px' }}
                              title="Delete Top Banner"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: Create / Edit Mobile App Ad
          ═══════════════════════════════════════════════════════════════════════ */}
      {showCreateModal && (
        <Modal
          title="Create a New Mobile App Ad"
          onClose={resetForm}
          maxWidth={640}
        >
          <form onSubmit={handleCreateAd} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                borderRadius: 8,
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                fontSize: 12,
                color: '#1e40af',
              }}
            >
              <Smartphone size={18} style={{ flexShrink: 0 }} />
              <span>
                This promotional ad banner appears directly above the search bar on the <strong>mobile app home screen</strong>.
              </span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
                Ad Title / Headline <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Special Festive Offer - Luxury 3 BHK Villa"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  fontSize: 13,
                  color: 'var(--text)',
                }}
              />
            </div>

            {/* Mobile Banner Crop Field */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <label style={{ fontSize: 12, fontWeight: 700 }}>
                  Upload Ad Banner (3:2) <span style={{ color: '#dc2626' }}>*</span>
                </label>
                {croppedPreviewUrl && (
                  <button
                    type="button"
                    onClick={() => setShowCropper(true)}
                    style={{
                      background: 'none',
                      border: 0,
                      color: 'var(--accent, #0D5F4E)',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Crop size={13} /> Re-crop Image
                  </button>
                )}
              </div>

              {croppedPreviewUrl ? (
                <div
                  style={{
                    position: 'relative',
                    borderRadius: 12,
                    overflow: 'hidden',
                    border: '2px solid var(--accent, #0D5F4E)',
                    background: '#0a0f1d',
                    height: 200,
                    maxWidth: 300,
                    aspectRatio: '3 / 2',
                  }}
                >
                  <img
                    src={croppedPreviewUrl}
                    alt="Cropped banner"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => setShowCropper(true)}
                      style={{
                        padding: '4px 8px',
                        background: 'rgba(0,0,0,0.75)',
                        color: '#fff',
                        borderRadius: 6,
                        border: 0,
                        fontSize: 11,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Crop size={12} /> Adjust Crop
                    </button>
                    <label
                      style={{
                        padding: '4px 8px',
                        background: 'rgba(0,0,0,0.75)',
                        color: '#fff',
                        borderRadius: 6,
                        border: 0,
                        fontSize: 11,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Upload size={12} /> Change
                      <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                    </label>
                  </div>
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 8,
                      left: 8,
                      background: '#16a34a',
                      color: '#fff',
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 4,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <CheckCircle2 size={11} /> Cropped (3:2) &amp; Ready
                  </div>
                </div>
              ) : (
                <label
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: '30px 20px',
                    borderRadius: 12,
                    border: '2px dashed var(--border)',
                    background: 'var(--grey-soft)',
                    cursor: 'pointer',
                    transition: 'border-color .15s',
                  }}
                >
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 23,
                      background: 'var(--accent-soft, #E6F4EA)',
                      color: 'var(--accent, #0D5F4E)',
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    <Crop size={22} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent, #0D5F4E)' }}>
                      Click to choose image &amp; crop banner (3:2)
                    </span>
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--muted)' }}>
                      Standard ad ratio (3:2) for mobile app and web banners.
                    </p>
                  </div>
                  <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                </label>
              )}
            </div>

            {/* Campaign Duration */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
                  Ad Start Date <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="date"
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    fontSize: 13,
                    color: 'var(--text)',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
                  Ad End Date <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="date"
                  value={formEndDate}
                  onChange={(e) => setFormEndDate(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    fontSize: 13,
                    color: 'var(--text)',
                  }}
                />
              </div>
            </div>

            {/* Redirect Property Selector */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <label style={{ fontSize: 12, fontWeight: 700 }}>
                  Redirect Property for this Ad <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                  {eligibleProperties.length} available
                </span>
              </div>

              <div
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  background: 'var(--surface)',
                  border: '1.5px solid var(--border)',
                  borderRadius: 8,
                  padding: '7px 10px',
                  marginBottom: 8,
                }}
              >
                <Search size={15} style={{ color: 'var(--muted)', flexShrink: 0, marginRight: 8 }} />
                <input
                  type="text"
                  placeholder="Filter properties..."
                  value={propertySearch}
                  onChange={(e) => setPropertySearch(e.target.value)}
                  style={{
                    border: 0,
                    outline: 'none',
                    padding: 0,
                    background: 'transparent',
                    width: '100%',
                    fontSize: 12,
                    color: 'var(--text)',
                  }}
                />
              </div>

              <div
                style={{
                  maxHeight: 180,
                  overflowY: 'auto',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  background: 'var(--surface)',
                }}
              >
                {eligibleProperties.slice(0, 30).map((p) => {
                  const isSelected = (p.id || p._id) === selectedPropertyId;
                  return (
                    <div
                      key={p.id || p._id}
                      onClick={() => setSelectedPropertyId(p.id || p._id)}
                      style={{
                        padding: '8px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--border)',
                        background: isSelected ? 'var(--accent-soft, #E6F4EA)' : 'transparent',
                      }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{p.title}</span>
                      <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 700 }}>{p.price}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={resetForm}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={actionLoading || uploadingImage || !formTitle || !croppedPreviewUrl || !selectedPropertyId}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 22px',
                  fontWeight: 700,
                  background: 'var(--accent, #0D5F4E)',
                }}
              >
                <CheckCircle2 size={16} />
                <span>{actionLoading ? 'Submitting...' : 'Submit for Super Admin Approval'}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: Create / Edit Standalone Top Banner (Long Width)
          ═══════════════════════════════════════════════════════════════════════ */}
      {showCreateTbModal && (
        <Modal
          title={editingTb ? 'Edit Website Top Banner' : 'Upload Website Top Banner (Search Bar Top)'}
          onClose={resetTbForm}
          maxWidth={620}
        >
          <form onSubmit={handleSaveTopBanner} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                borderRadius: 8,
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                fontSize: 12,
                color: '#065F46',
              }}
            >
              <Sparkles size={18} style={{ flexShrink: 0 }} />
              <span>
                This banner appears directly above the search bar on the ProBridge website. Multiple top banners will smoothly rotate one by one in an appear &amp; disappear style.
              </span>
            </div>

            {/* Long Width Image Upload with Dynamic Aspect Ratio */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 700 }}>
                    Banner Image <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <span
                    style={{
                      background: '#E8F5F0',
                      color: '#0D5F4E',
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 12,
                      border: '1px solid #A7F3D0',
                    }}
                  >
                    Ratio: {tbAspectRatio || 4.0}:1
                  </span>
                </div>
                {croppedTbUrl && (
                  <button
                    type="button"
                    onClick={() => setShowTbCropper(true)}
                    style={{
                      background: 'none',
                      border: 0,
                      color: '#0D5F4E',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Crop size={13} /> Change Ratio / Re-crop
                  </button>
                )}
              </div>

              {croppedTbUrl ? (
                <div
                  style={{
                    position: 'relative',
                    borderRadius: 10,
                    overflow: 'hidden',
                    border: '2px solid #0D5F4E',
                    background: '#0a0f1d',
                    height: 110,
                  }}
                >
                  <img
                    src={croppedTbUrl}
                    alt="Top banner preview"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 6 }}>
                    <label
                      style={{
                        padding: '4px 8px',
                        background: 'rgba(0,0,0,0.75)',
                        color: '#fff',
                        borderRadius: 6,
                        border: 0,
                        fontSize: 11,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Upload size={12} /> Change Image
                      <input type="file" accept="image/*" onChange={handleTbFileChange} style={{ display: 'none' }} />
                    </label>
                  </div>
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 6,
                      left: 6,
                      background: '#0D5F4E',
                      color: '#fff',
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 4,
                    }}
                  >
                    Panoramic Banner Ready
                  </div>
                </div>
              ) : (
                <label
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: '36px 20px',
                    borderRadius: 10,
                    border: '2px dashed #0D5F4E',
                    background: '#f8fafc',
                    cursor: 'pointer',
                    transition: 'border-color .15s',
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      background: '#ecfdf5',
                      color: '#0D5F4E',
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    <Upload size={20} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0D5F4E' }}>
                      Click to choose image &amp; crop banner
                    </span>
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: '#64748b' }}>
                      Recommended: 1200×280 or 1600×320 (wide panoramic 4:1 ratio)
                    </p>
                  </div>
                  <input type="file" accept="image/*" onChange={handleTbFileChange} style={{ display: 'none' }} />
                </label>
              )}
            </div>

            {/* Title / Headline */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
                Banner Headline / Title (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Prestige Waterfront Residences • Luxury 3 & 4 BHK"
                value={tbTitle}
                onChange={(e) => setTbTitle(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  fontSize: 13,
                  color: 'var(--text)',
                }}
              />
            </div>

            {/* Subtitle / Tagline */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
                Banner Subtitle / Tagline (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Prime Whitefield, Bengaluru • Starting at ₹1.45 Cr"
                value={tbSubtitle}
                onChange={(e) => setTbSubtitle(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  fontSize: 13,
                  color: 'var(--text)',
                }}
              />
            </div>

            {/* Destination Link */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
                Click Destination URL or Search Path (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. /search?buildingType=Commercial or /property/6afaa... or https://..."
                value={tbLink}
                onChange={(e) => setTbLink(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  fontSize: 13,
                  color: 'var(--text)',
                }}
              />
              <small className="muted-text" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
                When users click the top banner on the website, they will be redirected to this link.
              </small>
            </div>

            {/* Active Toggle Switch */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={tbIsActive}
                  onChange={(e) => setTbIsActive(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: '#0D5F4E' }}
                />
                <span>Active on ProBridge Website Search Bar</span>
              </label>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={resetTbForm}
                disabled={savingTb}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={savingTb || !croppedTbUrl}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: '#0D5F4E',
                  borderColor: '#0D5F4E',
                  fontWeight: 700,
                }}
              >
                <CheckCircle2 size={16} />
                <span>{savingTb ? 'Publishing...' : editingTb ? 'Save Changes' : 'Publish Top Banner'}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: Croppers
          ═══════════════════════════════════════════════════════════════════════ */}
      {/* Ad Image Cropper (3:2) */}
      {showCropper && rawImageSrc && (
        <AdImageCropModal
          imageSrc={rawImageSrc}
          aspect={1.5}
          aspectOptions={AD_BANNER_ASPECT_OPTIONS}
          title="Crop Ad Banner (3:2)"
          onDone={handleCropDone}
          onCancel={() => setShowCropper(false)}
        />
      )}

      {/* Standalone Website Top Banner Cropper with Dynamic Aspect Ratio */}
      {showTbCropper && rawTbSrc && (
        <AdImageCropModal
          imageSrc={rawTbSrc}
          aspect={tbAspectRatio || 4.0}
          aspectOptions={TOP_BANNER_ASPECT_OPTIONS}
          title={`Set Website Top Banner Ratio (${tbAspectRatio || 4.0}:1)`}
          onDone={handleTbCropDone}
          onCancel={() => setShowTbCropper(false)}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: Preview Mobile Ad
          ═══════════════════════════════════════════════════════════════════════ */}
      {previewAd && (
        <Modal
          title={`Mobile Preview: ${previewAd.title}`}
          onClose={() => setPreviewAd(null)}
          maxWidth={420}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div
              style={{
                width: 320,
                borderRadius: 32,
                border: '10px solid #1e293b',
                background: '#f8fafc',
                boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <div
                style={{
                  height: 20,
                  background: '#1e293b',
                  width: 140,
                  margin: '0 auto',
                  borderBottomLeftRadius: 12,
                  borderBottomRightRadius: 12,
                }}
              />

              <div style={{ padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: 14, fontWeight: 900, color: '#0f172a' }}>PROBRIDGE</span>
                <span style={{ fontSize: 11, color: '#64748b' }}>App Preview</span>
              </div>

              <div style={{ padding: '12px 14px' }}>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: '#64748b', letterSpacing: 0.5, marginBottom: 3 }}>
                    Sponsored Ad
                  </div>
                  <div
                    style={{
                      borderRadius: 12,
                      overflow: 'hidden',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      position: 'relative',
                      border: '1px solid #cbd5e1',
                    }}
                  >
                    <img
                      src={previewAd.image}
                      alt={previewAd.title}
                      style={{ width: '100%', aspectRatio: '3 / 2', objectFit: 'cover', display: 'block' }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: 6,
                        left: 6,
                        background: 'rgba(0,0,0,0.65)',
                        color: '#fff',
                        fontSize: 9,
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 4,
                      }}
                    >
                      FEATURED
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    background: '#fff',
                    borderRadius: 10,
                    padding: '10px 12px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  <Search size={14} color="#94a3b8" />
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>Search locality, builder...</span>
                </div>

                <div style={{ background: '#e2e8f0', height: 40, borderRadius: 8, marginBottom: 8 }} />
                <div style={{ background: '#e2e8f0', height: 80, borderRadius: 8 }} />
              </div>
            </div>

            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                Target: <strong>{previewAd.property?.title || 'Selected Property'}</strong>
              </div>
              <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, marginTop: 2 }}>
                Status: {previewAd.status ? previewAd.status.toUpperCase() : 'PENDING'}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: Preview Standalone Website Top Banner (Realistic Website Hero)
          ═══════════════════════════════════════════════════════════════════════ */}
      {previewTb && (
        <Modal
          title={`Website Search Bar Top Preview: ${previewTb.title || 'Top Banner'}`}
          onClose={() => setPreviewTb(null)}
          maxWidth={720}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                width: '100%',
                borderRadius: 14,
                border: '1.5px solid #cbd5e1',
                background: '#FAF8EC',
                padding: '28px 24px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
              }}
            >
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#0D5F4E', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                  ProBridge Website Hero
                </span>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#134E3A', marginTop: 2 }}>
                  Search Bar Top Banner Preview
                </div>
              </div>

              {/* Top Banner on Top of Search Bar */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  ⭐ Standalone Top Banner (Appears &amp; Disappears in Rotation)
                </div>
                <div
                  style={{
                    position: 'relative',
                    borderRadius: 12,
                    overflow: 'hidden',
                    height: 120,
                    border: '2px solid #0D5F4E',
                    boxShadow: '0 6px 18px rgba(13, 95, 78, 0.2)',
                    background: '#0a0f1d',
                  }}
                >
                  <img
                    src={previewTb.image}
                    alt={previewTb.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: 8,
                      left: 8,
                      background: '#0D5F4E',
                      color: '#fff',
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 4,
                      boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                    }}
                  >
                    SPONSORED
                  </div>
                </div>
              </div>

              {/* Website Search Bar */}
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: 12,
                  padding: '12px 18px',
                  border: '1.5px solid #134E3A',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748b', fontSize: 13 }}>
                  <Search size={16} color="#0D5F4E" />
                  <span>Search City, Locality or Property...</span>
                </div>
                <div
                  style={{
                    padding: '8px 18px',
                    background: '#0D5F4E',
                    color: '#fff',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  Search
                </div>
              </div>
            </div>

            <div style={{ marginTop: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                Destination: <strong>{previewTb.link || 'Search Page'}</strong>
              </div>
              <div style={{ fontSize: 11, color: previewTb.isActive !== false ? '#16a34a' : '#64748b', fontWeight: 700, marginTop: 2 }}>
                Status: {previewTb.isActive !== false ? 'ACTIVE ON WEBSITE' : 'PAUSED'}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: Reject Mobile Ad
          ═══════════════════════════════════════════════════════════════════════ */}
      {rejectingAd && (
        <Modal
          title="Reject Ad Submission"
          onClose={() => setRejectingAd(null)}
          maxWidth={440}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text)' }}>
              Are you sure you want to reject <strong>"{rejectingAd.title}"</strong>?
            </p>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                Rejection Reason (Optional):
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Low resolution image, inaccurate dates..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                style={{
                  width: '100%',
                  padding: 8,
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  fontSize: 12,
                  color: 'var(--text)',
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setRejectingAd(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleRejectConfirm}
                disabled={actionLoading}
                style={{ background: '#dc2626' }}
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          CONFIRM: Delete Mobile Ad
          ═══════════════════════════════════════════════════════════════════════ */}
      {deleteId && (
        <ConfirmDialog
          title="Delete Ad"
          message="Are you sure you want to delete this ad? This action cannot be undone."
          confirmText="Delete"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteId(null)}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          CONFIRM: Delete Standalone Top Banner
          ═══════════════════════════════════════════════════════════════════════ */}
      {deleteTbId && (
        <ConfirmDialog
          title="Delete Top Banner"
          message="Are you sure you want to delete this top banner from the website search bar?"
          confirmText="Delete"
          onConfirm={handleDeleteTbConfirm}
          onCancel={() => setDeleteTbId(null)}
        />
      )}
    </div>
  );
}
