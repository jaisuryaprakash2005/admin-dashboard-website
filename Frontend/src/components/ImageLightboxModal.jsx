import { useEffect, useState, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Edit3,
  ExternalLink,
  ImagePlus,
  Link2,
  Maximize2,
  Minimize2,
  RotateCw,
  Star,
  Trash2,
  X,
} from 'lucide-react';

export default function ImageLightboxModal({
  images = [],
  initialIndex = 0,
  onClose,
  onReplace,      // (index, newSrc) => void
  onDelete,       // (index) => void
  onSetCover,     // (index) => void
  editLink,       // URL string to navigate to property edit form
}) {
  const [index, setIndex] = useState(initialIndex >= 0 && initialIndex < images.length ? initialIndex : 0);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [showReplace, setShowReplace] = useState(false);
  const [replaceUrl, setReplaceUrl] = useState('');
  const fileInputRef = useRef(null);

  // Sync index if initialIndex changes
  useEffect(() => {
    if (initialIndex >= 0 && initialIndex < images.length) {
      setIndex(initialIndex);
      setZoom(1);
      setRotation(0);
      setShowReplace(false);
    }
  }, [initialIndex, images.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && images.length > 1) prev();
      if (e.key === 'ArrowRight' && images.length > 1) next();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [index, images.length]);

  const prev = () => {
    setIndex((i) => (i > 0 ? i - 1 : images.length - 1));
    setZoom(1);
    setRotation(0);
    setShowReplace(false);
  };

  const next = () => {
    setIndex((i) => (i < images.length - 1 ? i + 1 : 0));
    setZoom(1);
    setRotation(0);
    setShowReplace(false);
  };

  const toggleZoom = () => {
    setZoom((z) => (z === 1 ? 1.75 : 1));
  };

  const rotate = () => {
    setRotation((r) => (r + 90) % 360);
  };

  const handleApplyUrl = () => {
    const url = replaceUrl.trim();
    if (!url) return;
    if (onReplace) onReplace(index, url);
    setReplaceUrl('');
    setShowReplace(false);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file || !onReplace) return;
    const reader = new FileReader();
    reader.onload = () => {
      onReplace(index, reader.result);
      setShowReplace(false);
    };
    reader.readAsDataURL(file);
  };

  const currentSrc = images[index];
  if (!currentSrc) return null;

  return (
    <div className="lightbox-backdrop" onClick={onClose}>
      <div className="lightbox-container" onClick={(e) => e.stopPropagation()}>
        {/* Top Header Bar */}
        <div className="lightbox-head">
          <div className="lightbox-counter">
            <span>{index + 1} / {images.length}</span>
            {index === 0 && <span className="lightbox-cover-tag">Cover Photo</span>}
          </div>

          <div className="lightbox-actions">
            {/* Zoom toggle */}
            <button
              type="button"
              className="lightbox-btn"
              onClick={toggleZoom}
              title={zoom === 1 ? 'Zoom in' : 'Reset zoom'}
            >
              {zoom === 1 ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
              <span>{zoom === 1 ? 'Zoom' : 'Reset'}</span>
            </button>

            {/* Rotate */}
            <button
              type="button"
              className="lightbox-btn"
              onClick={rotate}
              title="Rotate 90 degrees"
            >
              <RotateCw size={16} />
              <span>Rotate</span>
            </button>

            {/* Open in new tab */}
            <a
              href={currentSrc}
              target="_blank"
              rel="noopener noreferrer"
              className="lightbox-btn"
              title="Open full resolution in new tab"
            >
              <ExternalLink size={16} />
              <span>Full Tab</span>
            </a>

            {/* Set as Cover (if onSetCover provided and not already cover) */}
            {onSetCover && index !== 0 && (
              <button
                type="button"
                className="lightbox-btn"
                onClick={() => onSetCover(index)}
                title="Make this photo the main cover photo"
              >
                <Star size={16} />
                <span>Make Cover</span>
              </button>
            )}

            {/* Replace / Edit Image button (if onReplace provided) */}
            {onReplace && (
              <button
                type="button"
                className={`lightbox-btn ${showReplace ? 'active' : ''}`}
                onClick={() => setShowReplace((s) => !s)}
                title="Replace with a new image or URL"
              >
                <Edit3 size={16} />
                <span>Replace Image</span>
              </button>
            )}

            {/* Delete button (if onDelete provided) */}
            {onDelete && (
              <button
                type="button"
                className="lightbox-btn lightbox-btn-danger"
                onClick={() => {
                  onDelete(index);
                  if (images.length <= 1) onClose();
                  else if (index >= images.length - 1) setIndex(images.length - 2);
                }}
                title="Delete this image"
              >
                <Trash2 size={16} />
                <span>Delete</span>
              </button>
            )}

            {/* Link to Edit Listing (if viewing from details) */}
            {editLink && (
              <a
                href={editLink}
                className="lightbox-btn lightbox-btn-primary"
                title="Edit this listing"
              >
                <Edit3 size={16} />
                <span>Edit Listing</span>
              </a>
            )}

            {/* Close Button */}
            <button
              type="button"
              className="lightbox-close"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Replace Image Inline Drawer (shown when Replace button clicked) */}
        {showReplace && onReplace && (
          <div className="lightbox-replace-bar">
            <div className="lightbox-replace-content">
              <strong>Replace photo {index + 1}:</strong>
              <div className="input-group grow">
                <input
                  type="text"
                  placeholder="Paste new image URL (https://...)"
                  value={replaceUrl}
                  onChange={(e) => setReplaceUrl(e.target.value)}
                />
                <button type="button" className="btn btn-sm" onClick={handleApplyUrl}>
                  <Link2 size={14} /> Apply URL
                </button>
              </div>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus size={14} /> Upload File
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handleFileUpload}
              />
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowReplace(false)}
                title="Cancel"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Main Image Stage */}
        <div className="lightbox-stage">
          {images.length > 1 && (
            <button
              type="button"
              className="lightbox-arrow lightbox-arrow-left"
              onClick={prev}
              aria-label="Previous image"
            >
              <ChevronLeft size={30} />
            </button>
          )}

          <div className="lightbox-img-wrap">
            <img
              src={currentSrc}
              alt={`Property Photo ${index + 1}`}
              className="lightbox-img"
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                transition: zoom === 1 ? 'transform 0.2s ease' : 'none',
              }}
              onError={(e) => {
                e.currentTarget.style.opacity = '0.3';
              }}
            />
          </div>

          {images.length > 1 && (
            <button
              type="button"
              className="lightbox-arrow lightbox-arrow-right"
              onClick={next}
              aria-label="Next image"
            >
              <ChevronRight size={30} />
            </button>
          )}
        </div>

        {/* Bottom Thumbnail Strip */}
        {images.length > 1 && (
          <div className="lightbox-thumbs">
            {images.map((src, i) => (
              <button
                key={src + i}
                type="button"
                className={`lightbox-thumb ${i === index ? 'on' : ''}`}
                onClick={() => {
                  setIndex(i);
                  setZoom(1);
                  setRotation(0);
                  setShowReplace(false);
                }}
              >
                <img src={src} alt="" />
                {i === 0 && <span className="lightbox-thumb-cover">Cover</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

