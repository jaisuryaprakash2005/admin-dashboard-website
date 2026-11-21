import { useState, useCallback, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import { X, Check, ZoomIn, ZoomOut, Crop, Sparkles } from 'lucide-react';

// Helper: crop image to canvas blob
function getCroppedBlob(imageSrc, pixelCrop, mimeType = 'image/jpeg') {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(pixelCrop.width);
      canvas.height = Math.round(pixelCrop.height);
      const ctx = canvas.getContext('2d');

      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        canvas.width,
        canvas.height
      );

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas is empty'));
        },
        mimeType,
        0.95
      );
    });
    image.addEventListener('error', reject);
    image.src = imageSrc;
  });
}

export default function AdImageCropModal({
  imageSrc,
  aspect = 4.0, // Default banner aspect ratio
  aspectOptions = null, // Array of { label, value } for selectable ratios
  title = 'Crop Banner Image',
  onDone,
  onCancel,
}) {
  const [currentAspect, setCurrentAspect] = useState(aspect || 4.0);
  const [isOriginal, setIsOriginal] = useState(false);
  const [naturalRatio, setNaturalRatio] = useState(4.0);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [processing, setProcessing] = useState(false);

  // Measure natural image aspect ratio
  useEffect(() => {
    if (!imageSrc) return;
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) {
        const nr = Number((img.naturalWidth / img.naturalHeight).toFixed(2));
        setNaturalRatio(nr);
        if (aspect === 'original') {
          setCurrentAspect(nr);
          setIsOriginal(true);
        }
      }
    };
    img.src = imageSrc;
  }, [imageSrc, aspect]);

  const onCropComplete = useCallback((_, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleSelectRatio = (optValue) => {
    if (optValue === 'original') {
      setIsOriginal(true);
      setCurrentAspect(naturalRatio);
    } else {
      setIsOriginal(false);
      setCurrentAspect(Number(optValue));
    }
  };

  const handleApply = async () => {
    if (!croppedAreaPixels) return;
    setProcessing(true);
    try {
      const blob = await getCroppedBlob(imageSrc, croppedAreaPixels);
      const previewUrl = URL.createObjectURL(blob);
      const finalRatio = isOriginal ? naturalRatio : Number(Number(currentAspect).toFixed(2));
      onDone(blob, previewUrl, finalRatio);
    } catch (err) {
      console.error('[AdCrop] failed:', err);
    } finally {
      setProcessing(false);
    }
  };

  // Skip cropping and use original image directly with its natural ratio
  const handleUseOriginalDirectly = async () => {
    setProcessing(true);
    try {
      const res = await fetch(imageSrc);
      const blob = await res.blob();
      const finalRatio = naturalRatio || 4.0;
      onDone(blob, imageSrc, finalRatio);
    } catch (err) {
      onDone(null, imageSrc, naturalRatio || 4.0);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10, 15, 30, 0.88)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div
        style={{
          background: '#151f33',
          borderRadius: 16,
          width: 'min(720px, 95vw)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff', fontWeight: 700, fontSize: 16 }}>
            <Crop size={18} color="#f59e0b" />
            <span>{title}</span>
          </div>
          <button
            onClick={onCancel}
            style={{
              background: 'none',
              border: 0,
              color: 'rgba(255,255,255,0.6)',
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              padding: 4,
              borderRadius: 6,
            }}
            title="Cancel"
          >
            <X size={18} />
          </button>
        </div>

        {/* Cropper Container */}
        <div style={{ position: 'relative', width: '100%', height: 320, background: '#0a0f1d' }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={currentAspect}
            cropShape="rect"
            showGrid={true}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        {/* Aspect Ratio Selector */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            padding: '10px 18px',
            background: 'rgba(255,255,255,0.03)',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>Banner Ratio:</span>
            {aspectOptions ? (
              aspectOptions.map((opt) => {
                const isSelected =
                  (opt.value === 'original' && isOriginal) ||
                  (!isOriginal && Number(opt.value) === Number(currentAspect));
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => handleSelectRatio(opt.value)}
                    style={{
                      background: isSelected ? 'var(--accent, #0D5F4E)' : 'rgba(255,255,255,0.08)',
                      color: isSelected ? '#fff' : 'rgba(255,255,255,0.8)',
                      border: isSelected ? '1px solid #10B981' : '1px solid rgba(255,255,255,0.15)',
                      borderRadius: 6,
                      padding: '4px 10px',
                      fontSize: 11.5,
                      fontWeight: isSelected ? 700 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })
            ) : (
              <div
                style={{
                  background: 'var(--accent, #0D5F4E)',
                  color: '#fff',
                  borderRadius: 6,
                  padding: '4px 10px',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                <span>Ratio: {currentAspect === 1.5 ? '3:2' : `${currentAspect}:1`}</span>
              </div>
            )}
          </div>

          {/* Quick link to use original image directly without crop */}
          <button
            type="button"
            onClick={handleUseOriginalDirectly}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#34D399',
              borderRadius: 6,
              padding: '4px 10px',
              fontSize: 11.5,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
            title="Use the uploaded image as-is without cropping"
          >
            <Sparkles size={12} />
            <span>Use Original As-Is ({naturalRatio}:1)</span>
          </button>
        </div>

        {/* Zoom Controls */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 20px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <ZoomOut size={16} color="rgba(255,255,255,0.5)" />
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            style={{ flex: 1, accentColor: 'var(--accent, #0D5F4E)', cursor: 'pointer' }}
          />
          <ZoomIn size={16} color="rgba(255,255,255,0.5)" />
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', minWidth: 36, textAlign: 'right' }}>
            {zoom.toFixed(1)}x
          </span>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            padding: '12px 20px',
            background: 'rgba(0,0,0,0.2)',
            borderTop: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'transparent',
              color: 'rgba(255,255,255,0.8)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={processing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 20px',
              borderRadius: 8,
              border: 0,
              background: 'var(--accent, #0D5F4E)',
              color: '#fff',
              fontWeight: 700,
              cursor: processing ? 'not-allowed' : 'pointer',
              opacity: processing ? 0.7 : 1,
              boxShadow: '0 2px 8px rgba(13, 95, 78, 0.4)',
            }}
          >
            <Check size={16} />
            <span>{processing ? 'Processing...' : `Apply (${isOriginal ? naturalRatio : currentAspect}:1)`}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
