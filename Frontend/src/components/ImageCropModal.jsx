import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { X, Check, ZoomIn, ZoomOut } from 'lucide-react';

// ─── Helper: get cropped canvas pixels ───────────────────────────────────────
function getCroppedBlob(imageSrc, pixelCrop, mimeType = 'image/jpeg') {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => {
      const canvas = document.createElement('canvas');
      const size = Math.min(pixelCrop.width, pixelCrop.height); // keep square
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      // Draw circular clip
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.clip();

      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        size,
        size,
      );

      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas is empty'));
      }, mimeType, 0.92);
    });
    image.addEventListener('error', reject);
    image.src = imageSrc;
  });
}

// ─── ImageCropModal ───────────────────────────────────────────────────────────
// Props:
//   imageSrc   — object URL or data URL of the selected image
//   onDone(blob, previewUrl) — called with the cropped blob + preview URL
//   onCancel() — called when user dismisses without cropping
export default function ImageCropModal({ imageSrc, onDone, onCancel }) {
  const [crop, setCrop]             = useState({ x: 0, y: 0 });
  const [zoom, setZoom]             = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [processing, setProcessing] = useState(false);

  const onCropComplete = useCallback((_, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleApply = async () => {
    if (!croppedAreaPixels) return;
    setProcessing(true);
    try {
      const blob = await getCroppedBlob(imageSrc, croppedAreaPixels);
      const previewUrl = URL.createObjectURL(blob);
      onDone(blob, previewUrl);
    } catch (err) {
      console.error('[Crop] failed:', err);
    } finally {
      setProcessing(false);
    }
  };

  return (
    /* Backdrop */
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(10,10,20,.82)',
        zIndex: 9999,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div
        style={{
          background: '#1a2540', borderRadius: 14,
          width: 'min(480px, 94vw)',
          boxShadow: '0 24px 60px rgba(0,0,0,.6)',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,.1)' }}>
          <span style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>Crop Profile Photo</span>
          <button
            onClick={onCancel}
            style={{ background: 'none', border: 0, color: 'rgba(255,255,255,.6)', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 4, borderRadius: 6 }}
            title="Cancel"
          >
            <X size={20} />
          </button>
        </div>

        {/* Cropper Area */}
        <div style={{ position: 'relative', width: '100%', height: 320, background: '#0d1526' }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        {/* Zoom Slider */}
        <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10, borderTop: '1px solid rgba(255,255,255,.07)' }}>
          <ZoomOut size={16} style={{ color: 'rgba(255,255,255,.5)', flexShrink: 0 }} />
          <input
            type="range"
            min={1} max={3} step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            style={{ flex: 1, accentColor: 'var(--accent, #0D5F4E)' }}
          />
          <ZoomIn size={16} style={{ color: 'rgba(255,255,255,.5)', flexShrink: 0 }} />
          <span style={{ color: 'rgba(255,255,255,.5)', fontSize: 12, minWidth: 34, textAlign: 'right' }}>
            {Math.round(zoom * 100)}%
          </span>
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', gap: 10, padding: '0 20px 18px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid rgba(255,255,255,.2)', background: 'none', color: 'rgba(255,255,255,.7)', cursor: 'pointer', fontSize: 14 }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={processing}
            style={{ padding: '8px 20px', borderRadius: 8, border: 0, background: 'var(--accent, #0D5F4E)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 7, opacity: processing ? .6 : 1, boxShadow: '0 2px 8px rgba(13, 95, 78, 0.4)' }}
          >
            <Check size={16} />
            {processing ? 'Processing…' : 'Apply Crop'}
          </button>
        </div>
      </div>
    </div>
  );
}

