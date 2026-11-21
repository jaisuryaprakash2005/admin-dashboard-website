import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Camera, CheckCircle, AlertCircle, Save, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { adminService } from '../services/adminService.js';
import { TOKEN_KEY } from '../services/api.js';
import ImageCropModal from '../components/ImageCropModal.jsx';

const API_BASE         = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
const CLOUD_NAME       = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'elrw6gnd';
const UPLOAD_PRESET    = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'probridge';
const CLOUDINARY_URL   = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

// Try direct Cloudinary upload first; fall back to backend if preset is signed-only
async function uploadBlob(blob) {
  // --- Attempt 1: direct Cloudinary unsigned upload ---
  try {
    const form = new FormData();
    form.append('file', blob, 'profile.jpg');
    form.append('upload_preset', UPLOAD_PRESET);
    form.append('folder', 'probridge/profiles');

    const res  = await fetch(CLOUDINARY_URL, { method: 'POST', body: form });
    const data = await res.json();
    if (res.ok && data.secure_url) return data.secure_url;
    console.warn('[Cloudinary direct] failed:', data?.error?.message, '— trying backend.');
  } catch (e) {
    console.warn('[Cloudinary direct] network error:', e.message, '— trying backend.');
  }

  // --- Attempt 2: backend upload route ---
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });

  const token = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
  const res   = await fetch(`${API_BASE}/api/upload/image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ base64, type: 'profile' }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.warn('[Backend upload] failed:', text.slice(0, 120));
    return URL.createObjectURL(blob);
  }

  const data = await res.json();
  if (!data.url) throw new Error(data.message || 'Upload returned no URL');
  return data.url;
}

export default function AdminProfile() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();

  // ── Form state ──────────────────────────────────────────────────────────────
  const [name, setName]                 = useState(user?.name || '');
  const [phone, setPhone]               = useState(user?.phone || '');
  const [photo, setPhoto]               = useState(user?.photo || '');
  const [photoPreview, setPhotoPreview] = useState(user?.photo || '');

  // Keep form in sync if user object changes/loads
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPhone(user.phone || '');
      setPhoto(user.photo || '');
      setPhotoPreview(user.photo || '');
    }
  }, [user]);

  // ── Dirty tracking ──────────────────────────────────────────────────────────
  const savedPhoto = user?.photo || '';
  const isDirty =
    name.trim()  !== (user?.name  || '').trim() ||
    phone.trim() !== (user?.phone || '').trim() ||
    photo        !== savedPhoto;

  // Cancel: reset all fields back to saved values
  const handleCancel = () => {
    setName(user?.name   || '');
    setPhone(user?.phone || '');
    setPhoto(savedPhoto);
    setPhotoPreview(savedPhoto);
    showToast('info', 'Changes cancelled. Restored original profile.');
  };

  // ── Unsaved changes navigation guard ───────────────────────────────────────
  const [showExitPrompt, setShowExitPrompt] = useState(false);
  const savedRef   = useRef(false);
  const pendingUrl = useRef(null);

  useEffect(() => {
    if (!isDirty) return;

    const orig = window.history.pushState.bind(window.history);

    window.history.pushState = (state, title, url) => {
      if (savedRef.current || !url) return orig(state, title, url);
      const target = String(url);
      if (target === window.location.pathname + window.location.search) return orig(state, title, url);

      pendingUrl.current = target;
      setShowExitPrompt(true);
    };

    return () => {
      window.history.pushState = orig;
    };
  }, [isDirty]);

  useEffect(() => {
    const handler = (e) => {
      if (isDirty && !savedRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const handleKeepEditing = () => {
    setShowExitPrompt(false);
    pendingUrl.current = null;
  };

  const handleDiscardAndExit = () => {
    handleCancel();
    savedRef.current = true;
    setShowExitPrompt(false);
    if (pendingUrl.current) {
      navigate(pendingUrl.current);
      pendingUrl.current = null;
    }
  };

  // ── Crop modal ──────────────────────────────────────────────────────────────
  const [cropSrc, setCropSrc]   = useState(null);
  const [showCrop, setShowCrop] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [toast, setToast]         = useState(null);

  const fileRef = useRef(null);

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  // Step 1: user picks file → open crop modal
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const objectUrl = URL.createObjectURL(file);
    setCropSrc(objectUrl);
    setShowCrop(true);
  };

  // Step 2: crop applied → upload cropped blob
  const handleCropDone = async (blob, previewUrl) => {
    setShowCrop(false);
    setPhotoPreview(previewUrl);
    setUploading(true);
    try {
      const url = await uploadBlob(blob);
      setPhoto(url);
      if (url.startsWith('blob:')) {
        setPhotoPreview(url);
        showToast('error', 'Backend unreachable — photo preview only. Restart the backend and try again.');
      } else {
        setPhotoPreview(url);
        showToast('success', 'Photo cropped and uploaded. Click Save to apply.');
      }
    } catch (err) {
      showToast('error', `Photo upload failed: ${err.message}`);
      setPhotoPreview(savedPhoto);
    } finally {
      setUploading(false);
      URL.revokeObjectURL(cropSrc);
      setCropSrc(null);
    }
  };

  // Step 2 (cancel): close without cropping
  const handleCropCancel = () => {
    setShowCrop(false);
    URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    const trimmedName  = name.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName) {
      showToast('error', 'Name cannot be empty.');
      return false;
    }
    if (trimmedPhone && !/^\d{10}$/.test(trimmedPhone)) {
      showToast('error', 'Phone must be exactly 10 digits.');
      return false;
    }

    setSaving(true);
    try {
      const updates = { name: trimmedName, phone: trimmedPhone, photo: photo || '' };
      await adminService.updateProfile(updates);
      updateUser(updates);
      savedRef.current = true;
      showToast('success', 'Profile updated successfully! 🎉');
      return true;
    } catch (err) {
      showToast('error', err?.response?.data?.message || err?.message || 'Save failed.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndExit = async () => {
    const ok = await handleSave();
    if (ok) {
      setShowExitPrompt(false);
      if (pendingUrl.current) {
        navigate(pendingUrl.current);
        pendingUrl.current = null;
      }
    }
  };

  const initials = (user?.name || 'A')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="content" style={{ maxWidth: 640 }}>
      {/* ── Crop Modal ── */}
      {showCrop && cropSrc && (
        <ImageCropModal
          imageSrc={cropSrc}
          onDone={handleCropDone}
          onCancel={handleCropCancel}
        />
      )}

      {/* ── Unsaved Changes Exit Prompt Modal ── */}
      {showExitPrompt && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(15,23,42,.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: '#fff', borderRadius: 14, padding: '26px 26px 20px',
            maxWidth: 440, width: '92vw',
            boxShadow: '0 20px 50px rgba(0,0,0,.25)',
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <div style={{ fontSize: 28, textAlign: 'center' }}>⚠️</div>
            <h2 style={{ margin: 0, fontSize: 18, textAlign: 'center' }}>Unsaved Profile Changes</h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: 14, textAlign: 'center', lineHeight: 1.5 }}>
              You made changes to your profile. Do you want to save them before leaving?
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleKeepEditing}
                style={{
                  padding: '9px 16px', borderRadius: 8, border: '1px solid #e2e8f0',
                  background: '#fff', color: '#0f172a', fontWeight: 600,
                  cursor: 'pointer', fontSize: 13,
                }}
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={handleDiscardAndExit}
                style={{
                  padding: '9px 16px', borderRadius: 8, border: '1px solid #fca5a5',
                  background: '#fee2e2', color: '#dc2626', fontWeight: 600,
                  cursor: 'pointer', fontSize: 13,
                }}
              >
                Discard & Exit
              </button>
              <button
                type="button"
                onClick={handleSaveAndExit}
                disabled={saving}
                style={{
                  padding: '9px 18px', borderRadius: 8, border: 0,
                  background: 'var(--accent, #0D5F4E)', color: '#fff', fontWeight: 600,
                  boxShadow: '0 2px 6px rgba(13, 95, 78, 0.3)',
                  cursor: 'pointer', fontSize: 13,
                }}
              >
                {saving ? 'Saving…' : 'Save & Exit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast Alert ── */}
      {toast && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
            borderRadius: 8,
            marginBottom: 18,
            background: toast.type === 'success' ? 'var(--green-soft)' : toast.type === 'info' ? 'var(--accent-soft)' : 'var(--red-soft)',
            color: toast.type === 'success' ? 'var(--green)' : toast.type === 'info' ? 'var(--accent)' : 'var(--red)',
            fontWeight: 500,
          }}
        >
          {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          {toast.msg}
        </div>
      )}

      <div className="page-head">
        <div>
          <h1>My Profile</h1>
          <p className="muted-text" style={{ margin: '4px 0 0' }}>
            Update your admin account details
          </p>
        </div>
      </div>

      {/* ── Message banner when field changed ── */}
      {isDirty && (
        <div style={{
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: 10,
          padding: '12px 18px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          boxShadow: '0 2px 8px rgba(37,99,235,0.08)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>✏️</span>
            <div>
              <strong style={{ color: '#1e40af', fontSize: 14 }}>You have unsaved changes</strong>
              <div style={{ fontSize: 12, color: '#3b82f6' }}>Click Save to update your profile or Cancel to revert.</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleCancel}
              disabled={saving || uploading}
              style={{ padding: '7px 16px', fontSize: 13 }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving || uploading}
              style={{ padding: '7px 20px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Save size={15} />
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSave}>
        {/* Profile Photo Card */}
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 16, fontSize: 14, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
            Profile Photo
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {/* Avatar preview */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Profile"
                  style={{
                    width: 88, height: 88,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '3px solid var(--border)',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 88, height: 88,
                    borderRadius: '50%',
                    background: 'var(--accent)',
                    color: '#fff',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 28, fontWeight: 700,
                    border: '3px solid var(--border)',
                  }}
                >
                  {initials}
                </div>
              )}
              {uploading && (
                <div
                  style={{
                    position: 'absolute', inset: 0,
                    borderRadius: '50%',
                    background: 'rgba(0,0,0,.5)',
                    display: 'grid', placeItems: 'center',
                    color: '#fff', fontSize: 11, fontWeight: 600,
                    textAlign: 'center',
                  }}
                >
                  Uploading…
                </div>
              )}
            </div>

            <div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                style={{ display: 'flex', alignItems: 'center', gap: 7 }}
              >
                <Camera size={16} />
                {uploading ? 'Uploading…' : 'Change Photo'}
              </button>
              <small style={{ marginTop: 6 }}>
                JPG, PNG or WEBP — crop tool opens after selecting.
              </small>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />
            </div>
          </div>
        </div>

        {/* Account Details Card */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 16, fontSize: 14, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
            Account Details
          </h3>

          {/* Name */}
          <label style={{ display: 'block', marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>
              Display Name
            </span>
            <input
              className="field"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              required
            />
          </label>

          {/* Email — locked */}
          <label style={{ display: 'block', marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
              Email
              <Lock size={13} style={{ color: 'var(--muted)' }} />
              <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 12 }}>(cannot be changed)</span>
            </span>
            <input
              className="field"
              type="email"
              value={user?.email || ''}
              readOnly
              disabled
              style={{ background: 'var(--grey-soft)', cursor: 'not-allowed', color: 'var(--muted)' }}
            />
          </label>

          {/* Phone */}
          <label style={{ display: 'block', marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>
              Phone Number
            </span>
            <input
              className="field"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="10-digit mobile number"
              maxLength={10}
            />
            <small style={{ marginTop: 4 }}>Optional — 10 digits only.</small>
          </label>
        </div>

        {/* Actions inside form */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {isDirty && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleCancel}
              disabled={saving || uploading}
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving || uploading || !isDirty}
            style={{ minWidth: 120 }}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
