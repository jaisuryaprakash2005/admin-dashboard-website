import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Archive,
  Building2,
  CheckCircle2,
  ExternalLink,
  Eye,
  FileText,
  Home,
  Image as ImageIcon,
  KeyRound,
  MapPin,
  Pencil,
  Phone,
  PhoneCall,
  Radio,
  Search,
  ShieldCheck,
  Smartphone,
  Tag,
  Trash2,
  User,
  X,
} from 'lucide-react';
import SearchBar from '../components/SearchBar.jsx';
import Modal from '../components/Modal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { Empty, ErrorState, Loading } from '../components/StateBlock.jsx';
import useData from '../hooks/useData.js';
import { adminService } from '../services/adminService.js';
import { errorMessage } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { formatDate, shortId } from '../utils/format.js';

// Helper to normalize listingType
function normalizeListingType(val) {
  const s = String(val || '').toLowerCase().trim();
  if (s.includes('rent')) return 'Rent';
  if (s.includes('lease')) return 'Lease';
  if (s.includes('pg') || s.includes('paying') || s.includes('co-living')) return 'PG';
  return 'Sell';
}

// ─── App-Style Rich Property Details Modal ───────────────────────────────────
function AppPropertyDetailModal({ property, onClose }) {
  const p = property;
  const raw = p.rawFormData || {};
  const images = Array.isArray(p.images) && p.images.length > 0
    ? p.images
    : p.image
      ? [p.image]
      : [];
  const [activePhoto, setActivePhoto] = useState(0);
  const isPlot = p.propertyType === 'Plot' || raw.propertyType === 'Plot';
  const amenities = Array.isArray(p.amenities) && p.amenities.length > 0 ? p.amenities : (raw.amenities || []);
  const possession = p.possession || raw.possession || 'Ready to Move';

  return (
    <Modal title={`Live App Listing: ${p.title}`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Photo Gallery with Thumbnail Selector */}
        {images.length > 0 ? (
          <div>
            <div style={{ position: 'relative', width: '100%', height: 260, borderRadius: 10, overflow: 'hidden', background: '#0f172a' }}>
              <img
                src={images[activePhoto]}
                alt={p.title}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: 10,
                  left: 10,
                  background: 'rgba(0,0,0,0.7)',
                  color: '#fff',
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 12,
                }}
              >
                Photo {activePhoto + 1} of {images.length}
              </div>
              <div
                style={{
                  position: 'absolute',
                  top: 10,
                  right: 10,
                  background: '#16a34a',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 12,
                }}
              >
                ✓ Live on Mobile App
              </div>
            </div>

            {/* Thumbnail Row */}
            {images.length > 1 && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8, overflowX: 'auto', paddingBottom: 4 }}>
                {images.map((img, i) => (
                  <button
                    key={img + i}
                    type="button"
                    onClick={() => setActivePhoto(i)}
                    style={{
                      border: activePhoto === i ? '2px solid var(--accent)' : '1px solid var(--border)',
                      borderRadius: 6,
                      padding: 0,
                      background: 'none',
                      width: 54,
                      height: 42,
                      overflow: 'hidden',
                      flexShrink: 0,
                      cursor: 'pointer',
                      opacity: activePhoto === i ? 1 : 0.6,
                    }}
                  >
                    <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {/* Pricing & Key Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, background: 'var(--grey-soft)', padding: 12, borderRadius: 8 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{p.price}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              {p.priceNote || (p.perSqft ? `${p.perSqft}` : 'Inclusive of all applicable terms')}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span className="chip" style={{ background: '#ecfdf5', color: '#16a34a', fontWeight: 600 }}>
              {p.status === 'sold' ? 'Sold' : p.status === 'rented' ? 'Rented' : 'Available'}
            </span>
            <span className="chip" style={{ background: '#E6F4EA', color: '#0D5F4E', fontWeight: 600 }}>
              {p.listingType || 'Sell'}
            </span>
            <span className="chip" style={{ background: '#f5f3ff', color: '#7c3aed', fontWeight: 600 }}>
              {p.propertyType || 'Apartment'}
            </span>
          </div>
        </div>

        {/* Full Overview Grid (Everything App Users See) */}
        <div>
          <h4 style={{ margin: '0 0 8px', fontSize: 13, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.04em' }}>
            Property Specifications (App Data)
          </h4>
          <div className="kv-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
            <div className="kv"><span>Listing Type</span><strong>{p.listingType || 'Sell'}</strong></div>
            <div className="kv"><span>Property Type</span><strong>{p.propertyType || 'Apartment'}</strong></div>
            <div className="kv"><span>Building Type</span><strong>{p.buildingType || 'Residential'}</strong></div>
            <div className="kv"><span>Possession Status</span><strong>{possession}</strong></div>
            {!isPlot ? (
              <>
                <div className="kv"><span>Bedrooms</span><strong>{p.bedroom || raw.bedroom || '—'}</strong></div>
                <div className="kv"><span>Bathrooms</span><strong>{p.bathroom || raw.bathroom || '—'}</strong></div>
                <div className="kv"><span>Balconies</span><strong>{p.balconies || raw.balconies || '—'}</strong></div>
                <div className="kv"><span>Furnishing Status</span><strong>{p.furnishingStatus || raw.furnishingStatus || '—'}</strong></div>
                <div className="kv"><span>Door Facing</span><strong>{p.doorFacing || raw.doorFacing || '—'}</strong></div>
                <div className="kv"><span>Floor</span><strong>{p.selectedFloor ? `${p.selectedFloor} of ${p.totalFloors || '—'}` : '—'}</strong></div>
                <div className="kv"><span>Property Age</span><strong>{p.propertyAge || raw.propertyAge || '—'}</strong></div>
                <div className="kv"><span>Maintenance</span><strong>{p.maintenanceCharge ? `₹${p.maintenanceCharge}/mo` : 'Included / None'}</strong></div>
              </>
            ) : (
              <>
                <div className="kv"><span>Plot Type</span><strong>{p.plotType || raw.plotType || '—'}</strong></div>
                <div className="kv"><span>Plot Size</span><strong>{p.plotSize === 'Other' ? (p.customPlotSize || 'Custom') : (p.plotSize || '—')}</strong></div>
                <div className="kv"><span>Road Facing</span><strong>{p.roadFacing || raw.roadFacing || '—'}</strong></div>
                <div className="kv"><span>Plot Dimension</span><strong>{p.plotDimension ? `${p.plotDimension} ${p.plotDimensionUnit || 'ft'}` : '—'}</strong></div>
                <div className="kv"><span>Plot Age</span><strong>{p.plotAge || raw.plotAge || '—'}</strong></div>
              </>
            )}
            <div className="kv"><span>Locality</span><strong>{p.locality || raw.locality || '—'}</strong></div>
            <div className="kv"><span>City</span><strong>{p.city || raw.city || '—'}</strong></div>
            <div className="kv"><span>Postal Code</span><strong>{p.postalCode || raw.postalCode || '—'}</strong></div>
            <div className="kv"><span>Full Address</span><strong>{p.address || raw.address || '—'}</strong></div>
            {p.lat && p.lng && (
              <div className="kv">
                <span>Map Coordinates</span>
                <strong>
                  <a href={`https://www.google.com/maps?q=${p.lat},${p.lng}`} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {Number(p.lat).toFixed(4)}, {Number(p.lng).toFixed(4)} <ExternalLink size={12} />
                  </a>
                </strong>
              </div>
            )}
          </div>
        </div>

        {/* Amenities */}
        {amenities.length > 0 && (
          <div>
            <h4 style={{ margin: '0 0 8px', fontSize: 13, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.04em' }}>
              Amenities & Features ({amenities.length})
            </h4>
            <div className="chips">
              {amenities.map((a) => (
                <span key={a} className="chip" style={{ background: '#f8fafc', border: '1px solid #cbd5e1', color: '#1e293b', fontWeight: 500 }}>
                  ✓ {a}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        {(p.description || raw.description) && (
          <div>
            <h4 style={{ margin: '0 0 6px', fontSize: 13, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.04em' }}>
              Property Description
            </h4>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text)', lineHeight: 1.6, background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
              {p.description || raw.description}
            </p>
          </div>
        )}

        {/* Seller / Contact Info */}
        <div style={{ background: 'var(--grey-soft)', padding: 14, borderRadius: 8 }}>
          <h4 style={{ margin: '0 0 8px', fontSize: 13, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.04em' }}>
            Seller / Owner Information
          </h4>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="avatar" style={{ background: 'var(--accent)', color: '#fff', fontWeight: 700 }}>
                {(p.ownerName || 'O')[0].toUpperCase()}
              </div>
              <div>
                <strong style={{ fontSize: 14, display: 'block' }}>{p.ownerName || 'Property Owner'}</strong>
                <small className="muted-text">{p.ownerEmail || 'No email provided'}</small>
                <span className="chip" style={{ fontSize: 10, padding: '1px 6px', marginTop: 2 }}>{p.userType || 'Owner'}</span>
              </div>
            </div>
            {p.phone && (
              <a href={`tel:${p.phone}`} className="btn btn-success btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <PhoneCall size={14} /> Call {p.phone}
              </a>
            )}
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          <Link to={`/properties/${p.id}/edit`} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Pencil size={15} /> Edit this Property
          </Link>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main LiveProperties Component ──────────────────────────────────────────
export default function LiveProperties() {
  const toast = useToast();
  const { data, setData, loading, error, reload } = useData(() => adminService.listProperties());

  const [q, setQ] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [availFilter, setAvailFilter] = useState('');
  const [activeTab, setActiveTab] = useState('all');     // 'all' | 'Sell' | 'Rent' | 'Lease' | 'PG'
  const [viewing, setViewing] = useState(null);
  const [archiving, setArchiving] = useState(null);

  // Filter ONLY Live Properties (Approved & Not Archived/Inactive)
  const liveProperties = useMemo(() => {
    return (data || []).filter((p) => {
      const isApproved =
        p.approvalStatus === 'approved' ||
        (!p.approvalStatus && (p.status === 'approved' || p.status === 'active'));
      const isNotArchived =
        p.status !== 'inactive' &&
        p.status !== 'archived' &&
        p.isArchived !== true;
      return isApproved && isNotArchived;
    });
  }, [data]);

  // Unique cities from live listings for filter dropdown
  const cities = useMemo(() => {
    const set = new Set();
    liveProperties.forEach((p) => {
      if (p.city && p.city.trim()) set.add(p.city.trim());
    });
    return Array.from(set).sort();
  }, [liveProperties]);

  // Apply search and filter criteria
  const filteredLive = useMemo(() => {
    const term = q.trim().toLowerCase();
    return liveProperties.filter((p) => {
      const matchesSearch =
        !term ||
        [p.title, p.location, p.city, p.locality, p.ownerName, p.ownerEmail, p.phone, p.bedroom, p.propertyType, shortId(p.id)]
          .some((val) => (val || '').toLowerCase().includes(term));

      const matchesCity = !cityFilter || (p.city || '').toLowerCase() === cityFilter.toLowerCase();
      const matchesType = !typeFilter || p.propertyType === typeFilter;
      const matchesAvail =
        !availFilter ||
        (availFilter === 'available' ? p.status !== 'sold' && p.status !== 'rented' : p.status === availFilter);

      return matchesSearch && matchesCity && matchesType && matchesAvail;
    });
  }, [liveProperties, q, cityFilter, typeFilter, availFilter]);

  // Group properties into separate columns by listingType
  const groupedByListingType = useMemo(() => {
    const map = {
      Sell: [],
      Rent: [],
      Lease: [],
      PG: [],
    };

    filteredLive.forEach((p) => {
      const key = normalizeListingType(p.listingType);
      if (map[key]) {
        map[key].push(p);
      } else {
        map.Sell.push(p);
      }
    });

    return map;
  }, [filteredLive]);

  // Handle Archiving (Taking down from mobile app)
  const handleConfirmArchive = async () => {
    if (!archiving) return;
    try {
      await adminService.updateProperty(archiving.id, { status: 'inactive' });
      setData((prev) => prev.map((item) => (item.id === archiving.id ? { ...item, status: 'inactive' } : item)));
      toast.success(`"${archiving.title}" has been taken down and archived.`);
      setArchiving(null);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  // Metric counts
  const totalLive = liveProperties.length;
  const countSell = (liveProperties.filter((p) => normalizeListingType(p.listingType) === 'Sell')).length;
  const countRent = (liveProperties.filter((p) => normalizeListingType(p.listingType) === 'Rent')).length;
  const countLease = (liveProperties.filter((p) => normalizeListingType(p.listingType) === 'Lease')).length;
  const countPG = (liveProperties.filter((p) => normalizeListingType(p.listingType) === 'PG')).length;

  return (
    <>
      {/* Page Header */}
      <div className="page-head">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1>Live Properties</h1>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: '#ecfdf5',
                color: '#047857',
                border: '1px solid #a7f3d0',
                padding: '3px 10px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981' }} />
              Live on Website
            </span>
          </div>
          <span className="muted-text">
            All active property listings published and currently visible to buyers & tenants on the mobile app.
          </span>
        </div>

        {/* New property link */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Link to="/properties/new" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            + Add Property
          </Link>
        </div>
      </div>

      {/* Stats Summary Bar */}
      <div className="grid-stats" style={{ marginBottom: 16 }}>
        <div className="card stat-card">
          <div className="stat-icon tone-green">
            <Smartphone size={20} />
          </div>
          <div>
            <div className="stat-value">{totalLive}</div>
            <div className="stat-label">Total Live on App</div>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon tone-blue">
            <Tag size={20} />
          </div>
          <div>
            <div className="stat-value">{countSell}</div>
            <div className="stat-label">For Sale (Sell)</div>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon tone-green">
            <KeyRound size={20} />
          </div>
          <div>
            <div className="stat-value">{countRent}</div>
            <div className="stat-label">For Rent</div>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon tone-purple">
            <FileText size={20} />
          </div>
          <div>
            <div className="stat-value">{countLease + countPG}</div>
            <div className="stat-label">Lease & PG</div>
          </div>
        </div>
      </div>

      {/* Toolbar / Search Filters */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="toolbar" style={{ margin: 0 }}>
          <SearchBar
            value={q}
            onChange={(val) => setQ(val)}
            placeholder="Search live title, location, owner, BHK or phone…"
          />

          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            aria-label="Filter by city"
          >
            <option value="">All Cities ({cities.length})</option>
            {cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="Filter by property type"
          >
            <option value="">All Property Types</option>
            <option value="Apartment">Apartment</option>
            <option value="Villa">Villa</option>
            <option value="Plot">Plot</option>
            <option value="Independent House">Independent House</option>
            <option value="Commercial">Commercial</option>
          </select>

          <select
            value={availFilter}
            onChange={(e) => setAvailFilter(e.target.value)}
            aria-label="Filter by availability"
          >
            <option value="">All Availability</option>
            <option value="available">Available</option>
            <option value="sold">Sold</option>
            <option value="rented">Rented</option>
          </select>

          {(q || cityFilter || typeFilter || availFilter) && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => { setQ(''); setCityFilter(''); setTypeFilter(''); setAvailFilter(''); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <X size={13} /> Reset Filters
            </button>
          )}

          <div style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--muted)' }}>
            Showing <strong>{filteredLive.length}</strong> of {totalLive} live listings
          </div>
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : filteredLive.length === 0 ? (
        <Empty text="No live properties match your current filters." />
      ) : (
        /* ─── TABLE VIEW: Unified Table with Listing Type Tabs ─────────────── */
        <div className="card">
          {/* Tabs for Table View */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 14, borderBottom: '2px solid var(--border)' }}>
            {[
              { key: 'all', label: `All Live (${filteredLive.length})` },
              { key: 'Sell', label: `Sell (${groupedByListingType.Sell.length})` },
              { key: 'Rent', label: `Rent (${groupedByListingType.Rent.length})` },
              { key: 'Lease', label: `Lease (${groupedByListingType.Lease.length})` },
              { key: 'PG', label: `PG (${groupedByListingType.PG.length})` },
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                style={{
                  padding: '8px 18px',
                  border: 0,
                  background: 'none',
                  cursor: 'pointer',
                  fontWeight: activeTab === key ? 700 : 400,
                  color: activeTab === key ? 'var(--accent)' : 'var(--muted)',
                  borderBottom: activeTab === key ? '2px solid var(--accent)' : '2px solid transparent',
                  marginBottom: -2,
                  fontSize: 14,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Listing Type</th>
                  <th>Property Type & Specs</th>
                  <th>Price & Rate</th>
                  <th>Possession</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Seller</th>
                  <th className="right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(activeTab === 'all' ? filteredLive : groupedByListingType[activeTab] || []).map((p) => {
                  const typeKey = normalizeListingType(p.listingType);
                  const colConfig = {
                    Sell: { bg: '#E6F4EA', color: '#0D5F4E', border: '#A7F3D0', title: 'Sell' },
                    Rent: { bg: '#ecfdf5', color: '#059669', border: '#a7f3d0', title: 'Rent' },
                    Lease: { bg: '#f5f3ff', color: '#7c3aed', border: '#ddd6fe', title: 'Lease' },
                    PG: { bg: '#fffbeb', color: '#d97706', border: '#fde68a', title: 'PG' },
                  }[typeKey] || { bg: '#E6F4EA', color: '#0D5F4E', border: '#A7F3D0', title: 'Sell' };
                  return (
                    <tr key={p.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <img
                            className="thumb-img"
                            src={p.image || (p.images && p.images[0]) || ''}
                            alt=""
                            onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                          />
                          <div>
                            <strong style={{ fontSize: 13, display: 'block' }}>{p.title}</strong>
                            <small className="muted-text">ID: {shortId(p.id)}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '2px 8px',
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 600,
                            background: colConfig.bg,
                            color: colConfig.color,
                            border: `1px solid ${colConfig.border}`,
                          }}
                        >
                          {colConfig.title.split(' ')[0]}
                        </span>
                      </td>
                      <td>
                        <strong style={{ fontSize: 13 }}>{p.propertyType || 'Apartment'}</strong>
                        <small className="muted-text">
                          {p.bedroom ? `${p.bedroom} · ` : ''}
                          {p.bathroom ? `${p.bathroom} Baths · ` : ''}
                          {p.furnishingStatus || 'Unfurnished'}
                        </small>
                      </td>
                      <td>
                        <strong style={{ fontSize: 14 }}>{p.price}</strong>
                        {p.perSqft && <small className="muted-text">{p.perSqft}</small>}
                      </td>
                      <td>
                        <span className="chip" style={{ fontSize: 11, padding: '2px 8px' }}>
                          {p.possession || 'Ready to Move'}
                        </span>
                      </td>
                      <td>
                        <div>{p.locality || p.location || '—'}</div>
                        {p.city && <small className="muted-text">{p.city}</small>}
                      </td>
                      <td>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 600,
                            background: p.status === 'sold' ? '#fee2e2' : p.status === 'rented' ? '#e0f2fe' : '#dcfce7',
                            color: p.status === 'sold' ? '#b91c1c' : p.status === 'rented' ? '#0369a1' : '#15803d',
                          }}
                        >
                          {p.status === 'sold' ? 'Sold' : p.status === 'rented' ? 'Rented' : 'Available'}
                        </span>
                      </td>
                      <td>
                        <div>{p.ownerName || '—'}</div>
                        {p.phone && (
                          <a href={`tel:${p.phone}`} style={{ color: '#16a34a', fontSize: 11, textDecoration: 'none', fontWeight: 600 }}>
                            <PhoneCall size={10} style={{ verticalAlign: -1 }} /> {p.phone}
                          </a>
                        )}
                      </td>
                      <td className="right actions">
                        <button className="icon-btn" title="View App Details" onClick={() => setViewing(p)}>
                          <Eye size={16} />
                        </button>
                        <Link className="icon-btn" title="Edit" to={`/properties/${p.id}/edit`}>
                          <Pencil size={16} />
                        </Link>
                        <button
                          className="icon-btn danger"
                          title="Take down from mobile app (Archive)"
                          onClick={() => setArchiving(p)}
                        >
                          <Archive size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── App-Style Rich Details Modal ──────────────────────────────────── */}
      {viewing && (
        <AppPropertyDetailModal
          property={viewing}
          onClose={() => setViewing(null)}
        />
      )}

      {/* ─── Unpublish / Archive Confirm Dialog ────────────────────────────── */}
      {archiving && (
        <ConfirmDialog
          danger
          title="Take Down Listing from Mobile App?"
          confirmLabel="Take Down & Archive"
          message={`"${archiving.title}" will be unpublished from the mobile app and moved to the Archive. Buyers will no longer be able to view or enquire about it.`}
          onConfirm={handleConfirmArchive}
          onClose={() => setArchiving(null)}
        />
      )}
    </>
  );
}
