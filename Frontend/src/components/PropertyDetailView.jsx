import { useState, useMemo } from 'react';
import {
  ArrowLeft, Building2, Calculator, Camera, Check, CheckCircle2, ChevronDown, ChevronUp,
  Compass, Download, ExternalLink, FileText, Film, Layers, Mail, MapPin, Maximize2, Phone,
  Share2, ShieldCheck, User, Video, X
} from 'lucide-react';
import StatusBadge from './StatusBadge.jsx';
import ImageLightboxModal from './ImageLightboxModal.jsx';
import { APPROVAL, AVAILABILITY, formatDate, shortId } from '../utils/format.js';

const TABS = [
  { id: 'overview',      label: 'Overview' },
  { id: 'floor-plans',   label: 'Floor Plan' },
  { id: 'amenities',     label: 'Amenities' },
  { id: 'gallery',       label: 'Gallery' },
  { id: 'home-loan',     label: 'Home Loan' },
  { id: 'payment-plans', label: 'Payment Plans' },
  { id: 'neighbourhood', label: 'Neighbourhood' },
  { id: 'brochure',      label: 'Brochure' },
  { id: 'builder',       label: 'Builder' },
  { id: 'faq',           label: 'FAQ' },
];

function formatIndianCurrency(num) {
  if (!num || isNaN(num)) return '₹ 0';
  if (num >= 10000000) {
    return `₹ ${(num / 10000000).toFixed(2).replace(/\.00$/, '')} Cr`;
  }
  if (num >= 100000) {
    return `₹ ${(num / 100000).toFixed(2).replace(/\.00$/, '')} Lac`;
  }
  return `₹ ${Math.round(num).toLocaleString('en-IN')}`;
}

function getYouTubeEmbedUrl(url) {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
}

export default function PropertyDetailView({ p }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [activeImg, setActiveImg] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [galleryTab, setGalleryTab] = useState('photos');
  const [openFaq, setOpenFaq] = useState(0);
  const [neighbourCategory, setNeighbourCategory] = useState('commute');
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const plot = p.propertyType === 'Plot';
  const images = (p.images && p.images.length > 0) ? p.images : (p.image ? [p.image] : []);
  const floorPlans = p.floorPlanImages || [];

  // Home Loan Calculator state
  let rawPrice = 0;
  if (typeof p.priceRaw === 'number' && p.priceRaw > 0) {
    rawPrice = p.priceRaw;
  } else if (p.price) {
    const str = String(p.price);
    if (/cr/i.test(str)) {
      rawPrice = (parseFloat(str.replace(/[^0-9.]/g, '')) || 0) * 10000000;
    } else if (/lac|lakh/i.test(str)) {
      rawPrice = (parseFloat(str.replace(/[^0-9.]/g, '')) || 0) * 100000;
    } else {
      rawPrice = parseFloat(str.replace(/[^0-9.]/g, '')) || 0;
    }
  }

  const [loanAmount, setLoanAmount] = useState(rawPrice > 0 ? Math.round(rawPrice * 0.8) : 5000000);
  const [loanTenure, setLoanTenure] = useState(20);
  const [interestRate, setInterestRate] = useState(8.5);

  const loanStats = useMemo(() => {
    const P = Number(loanAmount) || 0;
    const r = (Number(interestRate) || 8.5) / (12 * 100);
    const n = (Number(loanTenure) || 20) * 12;

    if (P <= 0 || r <= 0 || n <= 0) {
      return { emi: 0, totalPayment: 0, totalInterest: 0, principalRatio: 50 };
    }

    const emi = Math.round((P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
    const totalPayment = emi * n;
    const totalInterest = Math.max(0, totalPayment - P);
    const principalRatio = totalPayment > 0 ? (P / totalPayment) * 100 : 50;

    return { emi, totalPayment, totalInterest, principalRatio };
  }, [loanAmount, loanTenure, interestRate]);

  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
    const el = document.getElementById(`adm-${tabId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const userHighlights = p.propertyHighlights
    ? p.propertyHighlights.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean)
    : [];

  const neighbourhoodPoints = {
    commute: [
      { name: `${p.locality || 'Locality'} Bus Stop`, dist: '0.8 km' },
      { name: `${p.locality || p.city || 'Central'} Metro Station`, dist: '1.4 km' },
      { name: `${p.city || 'City'} Railway Hub`, dist: '4.2 km' },
    ],
    healthcare: [
      { name: `${p.locality || 'Local'} Multi-Speciality Hospital`, dist: '1.2 km' },
      { name: `24×7 Emergency Clinic & Pharmacy`, dist: '2.0 km' },
    ],
    education: [
      { name: `Public & International School`, dist: '1.5 km' },
      { name: `Engineering & Arts College Campus`, dist: '3.1 km' },
    ],
    shopping: [
      { name: `${p.locality || 'Town'} Grand Mall & Multiplex`, dist: '1.8 km' },
      { name: `Daily Fresh Supermarket`, dist: '0.5 km' },
    ],
    food: [
      { name: `Multi-Cuisine Restaurants & Cafes`, dist: '0.7 km' },
      { name: `Family Dine-in Food Hub`, dist: '1.1 km' },
    ],
  };

  const faqs = [
    {
      q: `What is the possession date for ${p.title}?`,
      a: p.possessionDate
        ? `The scheduled possession date is ${p.possessionDate} (Status: ${p.propertyStatus || 'Under Construction'}).`
        : `The current status is ${p.propertyStatus || 'Ready to Move'}. Contact the seller for exact key handover timelines.`,
    },
    {
      q: `What is the RERA registration number for ${p.title}?`,
      a: p.reraNumber
        ? `The official RERA registration number for this property is ${p.reraNumber}.`
        : `RERA compliance documents and statutory approvals are available directly upon requesting seller details.`,
    },
    {
      q: `What is the expected price and maintenance charges?`,
      a: `The expected price is ${p.price}${p.maintenanceCharge ? ` with maintenance charges of ₹${p.maintenanceCharge}/month` : ''}.`,
    },
    {
      q: `What configuration and area details apply to ${p.title}?`,
      a: plot
        ? `This is a ${p.plotType || 'Plot'} property with plot size ${p.plotSize === 'Other' ? p.customPlotSize : p.plotSize || 'standard'}${p.roadFacing ? ` and road facing ${p.roadFacing}` : ''}.`
        : `This unit is a ${p.bedroom || 'residential'} configuration with ${p.bathroom || '2'} bathrooms, ${p.balconies || '1'} balconies${p.doorFacing ? `, facing ${p.doorFacing}` : ''}${p.furnishingStatus ? `, and is ${p.furnishingStatus}` : ''}.`,
    },
    {
      q: `What amenities are available at ${p.title}?`,
      a: p.amenities?.length > 0
        ? `Verified amenities include: ${p.amenities.join(', ')}.`
        : `Please enquire directly with the seller for the full community amenities breakdown.`,
    },
    {
      q: `Where is ${p.title} located?`,
      a: `The property is located at ${[p.address, p.locality, p.city, p.postalCode].filter(Boolean).join(', ')}.`,
    },
  ];

  const embedVideoUrl = getYouTubeEmbedUrl(p.propertyVideo);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── PropTiger Sticky Tabs Navigation ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '8px 0', display: 'flex', gap: 6, overflowX: 'auto',
        borderRadius: '8px 8px 0 0', margin: '-16px -16px 0 -16px', paddingLeft: 16, paddingRight: 16,
      }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleTabClick(tab.id)}
            style={{
              padding: '6px 14px', borderRadius: 6, border: 0, fontSize: 13, fontWeight: 700,
              background: activeTab === tab.id ? 'var(--accent)' : 'transparent',
              color: activeTab === tab.id ? '#fff' : 'var(--muted)',
              cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all .15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── 2-Column Layout matching video ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 24, alignItems: 'flex-start' }}>

        {/* ════ LEFT MAIN COLUMN ════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>

          {/* Hero Gallery Card */}
          <div style={{ background: '#000', borderRadius: 10, overflow: 'hidden', position: 'relative', height: 380 }}>
            {images.length > 0 ? (
              <>
                <img
                  src={images[activeImg]}
                  alt={p.title}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', cursor: 'pointer' }}
                  onClick={() => setLightboxOpen(true)}
                />
                <button
                  type="button"
                  onClick={() => setLightboxOpen(true)}
                  style={{
                    position: 'absolute', bottom: 12, right: 12,
                    background: 'rgba(15, 23, 42, 0.75)', color: '#fff',
                    border: '1px solid rgba(255,255,255,0.2)', borderRadius: 20,
                    padding: '6px 14px', fontSize: 12, fontWeight: 600,
                    display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                  }}
                >
                  <Maximize2 size={13} /> Full view ({images.length} photos)
                </button>
                {activeImg === 0 && (
                  <span style={{ position: 'absolute', top: 12, left: 12, background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4 }}>
                    Cover Photo
                  </span>
                )}
              </>
            ) : (
              <div style={{ color: '#fff', display: 'grid', placeItems: 'center', height: '100%' }}>No images available</div>
            )}
          </div>

          {/* Thumbnail Strip */}
          {images.length > 1 && (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
              {images.map((src, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveImg(i)}
                  style={{
                    width: 64, height: 50, borderRadius: 6, overflow: 'hidden', padding: 0,
                    border: i === activeImg ? '2px solid var(--accent)' : '1px solid var(--border)',
                    cursor: 'pointer', flexShrink: 0, background: '#000',
                  }}
                >
                  <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </button>
              ))}
            </div>
          )}

          {/* Title & Key Highlights Card */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
              <div>
                <h1 style={{ margin: '0 0 6px 0', fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{p.title}</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)', fontSize: 13, marginBottom: 8 }}>
                  <MapPin size={15} style={{ color: 'var(--accent)' }} />
                  <span>{[p.address, p.locality, p.city].filter(Boolean).join(', ') || p.location}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--muted)', flexWrap: 'wrap' }}>
                  {p.builderName && <span>By: <strong style={{ color: 'var(--text)' }}>{p.builderName}</strong> •</span>}
                  <span>Status: <strong style={{ color: 'var(--green)' }}>{p.propertyStatus || p.possessionDate || 'Available'}</strong></span>
                  {p.possessionDate && <span>• Possession: <strong>{p.possessionDate}</strong></span>}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)' }}>{p.price}</div>
                {p.maintenanceCharge && <div style={{ fontSize: 12, color: 'var(--muted)' }}>+ Maint. ₹{p.maintenanceCharge}/mo</div>}
                {p.reraNumber && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(34, 197, 94, 0.1)', color: '#15803d', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, marginTop: 4 }}>
                    <ShieldCheck size={13} /> RERA: {p.reraNumber}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ════ SECTION 1: OVERVIEW & SPECIFICATIONS ════ */}
          <div id="adm-overview" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 17, fontWeight: 700, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
              Project Specifications
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
              <div style={{ background: 'var(--bg)', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', fontWeight: 600 }}>Property Type</span>
                <strong style={{ fontSize: 14 }}>{p.propertyType || 'Residential'}</strong>
              </div>
              <div style={{ background: 'var(--bg)', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', fontWeight: 600 }}>Building Type</span>
                <strong style={{ fontSize: 14 }}>{p.buildingType || 'Residential'}</strong>
              </div>
              {plot ? (
                <>
                  <div style={{ background: 'var(--bg)', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', fontWeight: 600 }}>Plot Type</span>
                    <strong style={{ fontSize: 14 }}>{p.plotType || 'Independent Plot'}</strong>
                  </div>
                  <div style={{ background: 'var(--bg)', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', fontWeight: 600 }}>Plot Size</span>
                    <strong style={{ fontSize: 14 }}>{p.plotSize === 'Other' ? p.customPlotSize : p.plotSize || 'Standard'}</strong>
                  </div>
                  {p.roadFacing && (
                    <div style={{ background: 'var(--bg)', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', fontWeight: 600 }}>Road Facing</span>
                      <strong style={{ fontSize: 14 }}>{p.roadFacing}</strong>
                    </div>
                  )}
                  {p.plotDimension && (
                    <div style={{ background: 'var(--bg)', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', fontWeight: 600 }}>Dimensions</span>
                      <strong style={{ fontSize: 14 }}>{p.plotDimension} {p.plotDimensionUnit || 'Sq. Feet'}</strong>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {p.bedroom && (
                    <div style={{ background: 'var(--bg)', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', fontWeight: 600 }}>Bedrooms</span>
                      <strong style={{ fontSize: 14 }}>{p.bedroom}</strong>
                    </div>
                  )}
                  {p.bathroom && (
                    <div style={{ background: 'var(--bg)', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', fontWeight: 600 }}>Bathrooms</span>
                      <strong style={{ fontSize: 14 }}>{p.bathroom} Baths</strong>
                    </div>
                  )}
                  {p.balconies && (
                    <div style={{ background: 'var(--bg)', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', fontWeight: 600 }}>Balconies</span>
                      <strong style={{ fontSize: 14 }}>{p.balconies}</strong>
                    </div>
                  )}
                  {p.doorFacing && (
                    <div style={{ background: 'var(--bg)', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', fontWeight: 600 }}>Door Facing</span>
                      <strong style={{ fontSize: 14 }}>{p.doorFacing}</strong>
                    </div>
                  )}
                  {p.furnishingStatus && (
                    <div style={{ background: 'var(--bg)', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', fontWeight: 600 }}>Furnishing</span>
                      <strong style={{ fontSize: 14 }}>{p.furnishingStatus}</strong>
                    </div>
                  )}
                  {p.selectedFloor && (
                    <div style={{ background: 'var(--bg)', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', fontWeight: 600 }}>Property Floor</span>
                      <strong style={{ fontSize: 14 }}>Floor {p.selectedFloor} {p.totalFloors ? `of ${p.totalFloors}` : ''}</strong>
                    </div>
                  )}
                  {p.totalProjectFloors && (
                    <div style={{ background: 'var(--bg)', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', fontWeight: 600 }}>Total Project Floors</span>
                      <strong style={{ fontSize: 14 }}>{p.totalProjectFloors} Floors</strong>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Highlights */}
            {userHighlights.length > 0 && (
              <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                <strong style={{ display: 'block', fontSize: 14, marginBottom: 8 }}>Property Highlights</strong>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                  {userHighlights.map((h, i) => <li key={i}>{h}</li>)}
                </ul>
              </div>
            )}

            {/* Description */}
            {p.description && (
              <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                <strong style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>Description</strong>
                <p style={{ margin: 0, fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6 }}>{p.description}</p>
              </div>
            )}
          </div>

          {/* ════ SECTION 2: FLOOR PLANS ════ */}
          <div id="adm-floor-plans" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{p.title} Floor Plans</h3>
              <span style={{ background: 'var(--accent)', color: '#fff', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                {plot ? (p.plotSize || 'Plot Area') : (p.bedroom || 'Standard Unit')}
              </span>
            </div>

            {floorPlans.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
                {floorPlans.map((url, idx) => (
                  <div key={idx} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--bg)' }}>
                    <img src={url} alt={`Plan ${idx + 1}`} style={{ width: '100%', height: 180, objectFit: 'contain', background: '#fff' }} />
                    <div style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600, borderTop: '1px solid var(--border)' }}>
                      Floor Plan #{idx + 1}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '24px', textAlign: 'center', background: 'var(--bg)', borderRadius: 8, border: '1.5px dashed var(--border)' }}>
                <Layers size={32} style={{ color: 'var(--muted)' }} />
                <p style={{ margin: '8px 0 2px', fontSize: 13, fontWeight: 600 }}>{p.bedroom || 'Standard Layout'}</p>
                <small style={{ color: 'var(--muted)' }}>No blueprint image uploaded by seller.</small>
              </div>
            )}
          </div>

          {/* ════ SECTION 3: AMENITIES ════ */}
          <div id="adm-amenities" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
            <h3 style={{ margin: '0 0 14px 0', fontSize: 17, fontWeight: 700 }}>{p.title} Amenities</h3>
            {p.amenities?.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                {p.amenities.map((a) => (
                  <div key={a} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, fontWeight: 600 }}>
                    <Check size={14} style={{ color: 'var(--green)' }} />
                    <span>{a}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>No specific amenities selected for this listing.</p>
            )}
            {p.amenitiesText && (
              <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--bg)', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                <strong style={{ display: 'block', marginBottom: 4, color: 'var(--text-primary)' }}>Additional Amenities & Features:</strong>
                {p.amenitiesText}
              </div>
            )}
          </div>

          {/* ════ SECTION 4: GALLERY & VIDEO ════ */}
          <div id="adm-gallery" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Gallery & Virtual Tour</h3>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  onClick={() => setGalleryTab('photos')}
                  style={{
                    padding: '4px 10px', borderRadius: 4, border: 0, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    background: galleryTab === 'photos' ? 'var(--accent)' : 'var(--bg)',
                    color: galleryTab === 'photos' ? '#fff' : 'inherit',
                  }}
                >
                  Photos ({images.length})
                </button>
                {p.propertyVideo && (
                  <button
                    type="button"
                    onClick={() => setGalleryTab('videos')}
                    style={{
                      padding: '4px 10px', borderRadius: 4, border: 0, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      background: galleryTab === 'videos' ? 'var(--accent)' : 'var(--bg)',
                      color: galleryTab === 'videos' ? '#fff' : 'inherit',
                    }}
                  >
                    Video Tour
                  </button>
                )}
              </div>
            </div>

            {galleryTab === 'photos' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                {images.map((src, i) => (
                  <div
                    key={i}
                    onClick={() => { setActiveImg(i); setLightboxOpen(true); }}
                    style={{ height: 130, borderRadius: 6, overflow: 'hidden', cursor: 'pointer', border: '1px solid var(--border)', background: '#000' }}
                  >
                    <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ))}
              </div>
            )}

            {galleryTab === 'videos' && p.propertyVideo && (
              <div>
                {embedVideoUrl ? (
                  <iframe src={embedVideoUrl} title="Property Video" style={{ width: '100%', height: 320, border: 0, borderRadius: 8 }} allowFullScreen />
                ) : (
                  <div style={{ padding: 20, textAlign: 'center', background: 'var(--bg)', borderRadius: 8 }}>
                    <Film size={32} style={{ color: 'var(--accent)' }} />
                    <p style={{ margin: '8px 0' }}>External Video Tour Link</p>
                    <a href={p.propertyVideo} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-primary">
                      Open Video Tour <ExternalLink size={13} />
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ════ SECTION 5: HOME LOAN CALCULATOR ════ */}
          <div id="adm-home-loan" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 17, fontWeight: 700 }}>Home Loan Calculator</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24, alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <label>Loan Amount</label>
                    <strong style={{ color: 'var(--accent)' }}>{formatIndianCurrency(loanAmount)}</strong>
                  </div>
                  <input
                    type="range" min={500000} max={Math.max(loanAmount * 1.5, 20000000)} step={50000}
                    value={loanAmount} onChange={(e) => setLoanAmount(Number(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
                  />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <label>Loan Tenure</label>
                    <strong style={{ color: 'var(--accent)' }}>{loanTenure} Years</strong>
                  </div>
                  <input
                    type="range" min={5} max={30} step={1}
                    value={loanTenure} onChange={(e) => setLoanTenure(Number(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
                  />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <label>Interest Rate (% P.A.)</label>
                    <strong style={{ color: 'var(--accent)' }}>{interestRate} %</strong>
                  </div>
                  <input
                    type="range" min={7.0} max={15.0} step={0.1}
                    value={interestRate} onChange={(e) => setInterestRate(Number(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
                  />
                </div>
              </div>

              {/* Live Donut & EMI */}
              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 18, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div style={{ position: 'relative', width: 110, height: 110, display: 'grid', placeItems: 'center' }}>
                  <svg width="110" height="110" viewBox="0 0 110 110">
                    <circle cx="55" cy="55" r="44" fill="transparent" stroke="#dc2626" strokeWidth="12" />
                    <circle
                      cx="55" cy="55" r="44" fill="transparent" stroke="#16a34a" strokeWidth="12"
                      strokeDasharray={2 * Math.PI * 44}
                      strokeDashoffset={(2 * Math.PI * 44) * (1 - loanStats.principalRatio / 100)}
                      strokeLinecap="round" transform="rotate(-90 55 55)"
                    />
                  </svg>
                  <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontSize: 14, fontWeight: 800 }}>{formatIndianCurrency(loanStats.emi)}</span>
                    <span style={{ fontSize: 10, color: 'var(--muted)' }}>EMI / month</span>
                  </div>
                </div>
                <div style={{ width: '100%', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#16a34a' }}>● Principal</span>
                    <strong>{formatIndianCurrency(loanAmount)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#dc2626' }}>● Interest</span>
                    <strong>{formatIndianCurrency(loanStats.totalInterest)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border)', paddingTop: 6, fontWeight: 700 }}>
                    <span>Total Payable</span>
                    <span>{formatIndianCurrency(loanStats.totalPayment)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ════ SECTION 6: PAYMENT PLANS ════ */}
          <div id="adm-payment-plans" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
            <h3 style={{ margin: '0 0 14px 0', fontSize: 17, fontWeight: 700 }}>Milestone Payment Schedule</h3>
            {((p.paymentPlanImages && p.paymentPlanImages.length > 0) || p.paymentPlanImage) && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                  {(p.paymentPlanImages && p.paymentPlanImages.length > 0 ? p.paymentPlanImages : [p.paymentPlanImage]).filter(Boolean).map((planImg, idx) => (
                    <a
                      key={idx}
                      href={planImg}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: 'block', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--bg)', textDecoration: 'none' }}
                    >
                      <img
                        src={planImg}
                        alt={`Payment Plan ${idx + 1}`}
                        style={{ width: '100%', height: 200, objectFit: 'contain', background: '#f8fafc', display: 'block' }}
                      />
                      <div style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
                        Payment Plan #{idx + 1} (Click to open full view)
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
              <div style={{ background: 'var(--bg)', padding: '12px 10px', borderRadius: 6, textAlign: 'center', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)' }}>10%</div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>Booking Token</div>
              </div>
              <div style={{ background: 'var(--bg)', padding: '12px 10px', borderRadius: 6, textAlign: 'center', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)' }}>20%</div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>Foundation</div>
              </div>
              <div style={{ background: 'var(--bg)', padding: '12px 10px', borderRadius: 6, textAlign: 'center', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)' }}>40%</div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>Superstructure</div>
              </div>
              <div style={{ background: 'var(--bg)', padding: '12px 10px', borderRadius: 6, textAlign: 'center', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)' }}>20%</div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>Finishing</div>
              </div>
              <div style={{ background: 'var(--bg)', padding: '12px 10px', borderRadius: 6, textAlign: 'center', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)' }}>10%</div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>Possession</div>
              </div>
            </div>
          </div>

          {/* ════ SECTION 7: NEIGHBOURHOOD ════ */}
          <div id="adm-neighbourhood" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
            <h3 style={{ margin: '0 0 14px 0', fontSize: 17, fontWeight: 700 }}>{p.locality || p.city || 'Property'} Neighbourhood</h3>
            <div style={{ height: 220, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', marginBottom: 14 }}>
              <iframe
                title="Location Map"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${(p.lng || 80.27) - 0.02}%2C${(p.lat || 13.08) - 0.02}%2C${(p.lng || 80.27) + 0.02}%2C${(p.lat || 13.08) + 0.02}&layer=mapnik&marker=${p.lat || 13.08}%2C${p.lng || 80.27}`}
                style={{ width: '100%', height: '100%', border: 0 }}
                loading="lazy"
              />
            </div>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 12 }}>
              {['commute', 'healthcare', 'education', 'shopping', 'food'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setNeighbourCategory(cat)}
                  style={{
                    padding: '4px 12px', borderRadius: 20, border: '1px solid var(--border)', fontSize: 12, fontWeight: 600,
                    background: neighbourCategory === cat ? 'var(--accent)' : 'var(--bg)',
                    color: neighbourCategory === cat ? '#fff' : 'inherit', cursor: 'pointer', textTransform: 'capitalize',
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(neighbourhoodPoints[neighbourCategory] || []).map((pt, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg)', borderRadius: 6, fontSize: 13 }}>
                  <span>📍 {pt.name}</span>
                  <strong style={{ color: 'var(--accent)' }}>{pt.dist}</strong>
                </div>
              ))}
            </div>
          </div>

          {/* ════ SECTION 8: BROCHURE ════ */}
          <div id="adm-brochure" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
            <h3 style={{ margin: '0 0 14px 0', fontSize: 17, fontWeight: 700 }}>Property Brochure</h3>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <FileText size={26} style={{ color: '#dc2626' }} />
                <div>
                  <strong style={{ fontSize: 14, display: 'block' }}>{p.title} Official Brochure</strong>
                  <small style={{ color: 'var(--muted)' }}>
                    {p.propertyBrochure ? 'Verified PDF document provided by seller' : 'No brochure link provided by seller'}
                  </small>
                </div>
              </div>
              {p.propertyBrochure ? (
                <a href={p.propertyBrochure} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-primary">
                  <Download size={14} /> Download Brochure
                </a>
              ) : (
                <span className="badge badge-grey">Not Uploaded</span>
              )}
            </div>
          </div>

          {/* ════ SECTION 9: BUILDER & SELLER INFO ════ */}
          <div id="adm-builder" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
            <h3 style={{ margin: '0 0 14px 0', fontSize: 17, fontWeight: 700 }}>About {p.builderName || p.ownerName || 'Seller'}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: 20, fontWeight: 800, display: 'grid', placeItems: 'center' }}>
                {(p.builderName || p.ownerName || 'P')[0]?.toUpperCase()}
              </div>
              <div>
                <h4 style={{ margin: '0 0 2px 0', fontSize: 16 }}>{p.builderName || p.ownerName || 'Property Seller'}</h4>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Role: <strong>{p.userType || 'Owner'}</strong></div>
                {p.phone && <div style={{ fontSize: 12, color: 'var(--green)', marginTop: 2 }}>📞 {p.phone}</div>}
              </div>
            </div>
          </div>

          {/* ════ SECTION 10: FAQ ════ */}
          <div id="adm-faq" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
            <h3 style={{ margin: '0 0 14px 0', fontSize: 17, fontWeight: 700 }}>Frequently Asked Questions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {faqs.map((f, idx) => (
                <div key={idx} style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(openFaq === idx ? -1 : idx)}
                    style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: 0, textAlign: 'left', fontWeight: 600, fontSize: 13.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  >
                    <span>{f.q}</span>
                    {openFaq === idx ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  {openFaq === idx && (
                    <div style={{ padding: '10px 14px', fontSize: 13, color: 'var(--muted)', background: 'var(--surface)', borderTop: '1px solid var(--border)', lineHeight: 1.5 }}>
                      {f.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* ════ RIGHT SIDEBAR (ADMIN DETAILS & SELLER SUMMARY) ════ */}
        <aside style={{ position: 'sticky', top: 60, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Status & Review Summary */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 18 }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted)' }}>
              Listing Review Status
            </h4>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              <StatusBadge map={APPROVAL} value={p.approvalStatus} />
              <StatusBadge map={AVAILABILITY} value={p.status} />
            </div>

            {(p.adminApprovedAt || p.superAdminApprovedAt) && (
              <div style={{ background: 'var(--bg)', borderRadius: 6, padding: 10, fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {p.adminApprovedAt && (
                  <div style={{ color: 'var(--green)' }}>
                    ✓ Admin: <strong>{p.adminApprovedByName || 'Admin'}</strong> ({formatDate(p.adminApprovedAt)})
                  </div>
                )}
                {p.superAdminApprovedAt && (
                  <div style={{ color: 'var(--purple)' }}>
                    👑 Super Admin: <strong>{p.superAdminApprovedByName || 'Super Admin'}</strong> ({formatDate(p.superAdminApprovedAt)})
                  </div>
                )}
              </div>
            )}

            {p.approvalStatus === 'rejected' && p.rejectionReason && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 6, padding: 10, fontSize: 12, marginTop: 10 }}>
                <strong>Rejection Reason:</strong> {p.rejectionReason}
              </div>
            )}
          </div>

          {/* Seller / Contact Card */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 18 }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted)' }}>
              Seller Contact Details
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
              <div>
                <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>Name</span>
                <strong>{p.ownerName || p.owner?.name || 'Owner'}</strong>
              </div>
              {p.ownerEmail && (
                <div>
                  <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>Email Address</span>
                  <a href={`mailto:${p.ownerEmail}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>{p.ownerEmail}</a>
                </div>
              )}
              {(p.phone || p.ownerPhone || p.owner?.phone) && (
                <div>
                  <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>Phone Number</span>
                  <strong>{p.phone || p.ownerPhone || p.owner?.phone}</strong>
                </div>
              )}
              <div>
                <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>Listed Date</span>
                <span>{formatDate(p.createdAt)}</span>
              </div>
              <div>
                <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>Property ID</span>
                <code>{shortId(p.id || p._id)}</code>
              </div>
            </div>
          </div>

        </aside>

      </div>

      {/* Lightbox Modal */}
      {lightboxOpen && images.length > 0 && (
        <ImageLightboxModal
          images={images}
          initialIndex={activeImg}
          onClose={() => setLightboxOpen(false)}
          editLink={p.id ? `/properties/${p.id}/edit` : undefined}
        />
      )}

    </div>
  );
}
