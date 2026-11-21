import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Edit2, ExternalLink, FileText, Film, ImagePlus, Link2, Mail, MapPin, Maximize2, Phone, Search, Star, Trash2, Upload, User, UserCheck, X } from 'lucide-react';
import { ErrorState, Loading } from '../components/StateBlock.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import LocationPickerModal from '../components/LocationPickerModal.jsx';
import ImageLightboxModal from '../components/ImageLightboxModal.jsx';
import { adminService } from '../services/adminService.js';
import api, { errorMessage } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { APPROVAL, AVAILABILITY, parsePrice } from '../utils/format.js';
import { PROPERTY_TYPES } from './Properties.jsx';

// Standard option lists matching Mobile App and Website
const BUILDING_TYPES = ['Residential', 'Commercial'];
const LISTING_TYPES = ['Sell', 'Rent', 'Lease', 'PG'];
const USER_TYPES = ['Owner', 'Broker', 'Builder'];
const BEDROOMS = ['1 RK', '1 BHK', '2 BHK', '3 BHK', '4 BHK', '5 BHK'];
const BATHROOMS = ['1', '2', '3', '4', '5'];
const BALCONIES = ['0', '1', '2', '3', '4', '5'];
const FURNISHING = ['Semi Furnished', 'Furnished', 'Unfurnished'];
const DIRECTIONS = ['East', 'West', 'North', 'South'];
const PROPERTY_STATUS = ['Ready to Move', 'Under Construction'];
const PLOT_TYPES = ['Independent Plot', 'Layout', 'Gated Community'];
const PLOT_SIZES = ['30×40', '30×50', '30×60', '60×90', 'Other'];
const DIM_UNITS = ['Sq. Feet', 'Super Built Up Area', 'Built Up Area', 'Carpet Area'];
const AMENITIES = ['Lift', 'Parking', 'Swimming Pool', 'Gym', 'Power Backup', 'Security', 'Club House', 'Garden', 'Play Area', 'Intercom', 'CCTV', 'Water Supply'];
const MAX_IMAGES = 20;
const MIN_IMAGES = 3;
const MAX_FLOOR_PLANS = 2;
const MAX_FILE_KB = 800;

const EMPTY = {
  // Step 1 – Basic Information
  buildingType: 'Residential',
  listingType: 'Sell',
  userType: 'Owner',
  builderName: '',
  propertyType: 'Apartment',
  title: '',
  propertyAge: '',
  propertyStatus: 'Ready to Move',
  city: '',
  locality: '',
  address: '',
  postalCode: '',
  lat: null,
  lng: null,

  // Step 2 – Property Details
  plotType: 'Independent Plot',
  plotSize: '30×40',
  customPlotSize: '',
  roadFacing: 'East',
  plotAge: '',
  plotDimension: '',
  plotDimensionUnit: 'Sq. Feet',
  bedroom: '2 BHK',
  unitConfigurations: [],
  bathroom: '2',
  balconies: '1',
  doorFacing: 'East',
  furnishingStatus: 'Unfurnished',
  superBuiltUpArea: '',
  carpetArea: '',
  projectArea: '',
  totalUnits: '',
  towers: '',
  noOfLifts: '',
  parkingType: '',
  amenities: [],
  amenitiesText: '',
  nearbyPlaces: [],
  totalProjectFloors: '',
  possessionDate: '',

  // Step 3 – Pricing & Description
  totalFloors: '',
  selectedFloor: '',
  priceAmount: '',
  priceUnit: 'Lac',
  pricePerSqft: '',
  maintenanceCharge: '',
  launchDate: '',
  approvals: '',
  description: '',
  propertyHighlights: '',
  reraNumber: '',

  // Step 4 – Photos & Documents
  images: [],
  floorPlanImages: [],
  paymentPlanImages: [],
    paymentPlanText: '',
  propertyVideo: '',
  propertyBrochure: '',
  _brochureFileName: '',

  // Default admin ownership
  ownerName: 'ProBridge Admin',
  ownerEmail: 'admin@probridge.com',
  phone: '',
  ownerPhone: '',
  owner: null,
  status: 'active',
};

function Field({ label, error, children, required, isChanged, previousValue }) {
  return (
    <label className={`field ${isChanged ? 'field-changed' : ''}`}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 2 }}>
        <span>{label}{required && ' *'}</span>
        {isChanged && (
          <span className="changed-badge">
            âœï¸ Modified {previousValue ? `(was: "${previousValue}")` : ''}
          </span>
        )}
      </div>
      {children}
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}

export default function PropertyForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const { refreshPending } = useOutletContext();
  const [f, setF] = useState(EMPTY);
  const [original, setOriginal] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(editing);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [floorPlanUrlInput, setFloorPlanUrlInput] = useState('');
  const [paymentPlanUrlInput, setPaymentPlanUrlInput] = useState('');
  const [customAmenityInput, setCustomAmenityInput] = useState('');
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [brochureUploading, setBrochureUploading] = useState(false);

  // ─€─€ Dirty / unsaved-changes guard ─€─€
  const [isDirty, setIsDirty] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const savedRef = useRef(false);
  const pendingUrl = useRef(null);
  const origPushRef = useRef(null);

  useEffect(() => {
    if (!isDirty) return;

    const orig = window.history.pushState.bind(window.history);
    origPushRef.current = orig;

    window.history.pushState = (state, title, url) => {
      if (savedRef.current || !url) return orig(state, title, url);
      const target = String(url);
      if (target === window.location.pathname + window.location.search) return orig(state, title, url);

      pendingUrl.current = target;
      setShowPrompt(true);
    };

    return () => {
      window.history.pushState = orig;
      origPushRef.current = null;
    };
  }, [isDirty]);

  useEffect(() => {
    const handler = (e) => {
      if (isDirty && !savedRef.current) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const handleLeave = () => {
    savedRef.current = true;
    setShowPrompt(false);
    navigate(pendingUrl.current);
    pendingUrl.current = null;
  };

  const handleKeepEditing = () => {
    setShowPrompt(false);
    pendingUrl.current = null;
  };

  const handleLocationSelected = ({ address, city, locality, postalCode, lat, lng }) => {
    setIsDirty(true);
    setF((prev) => ({
      ...prev,
      address: address || prev.address,
      city: city || prev.city,
      locality: locality || prev.locality,
      postalCode: postalCode || prev.postalCode,
      lat: lat !== undefined && lat !== null ? Number(lat) : prev.lat,
      lng: lng !== undefined && lng !== null ? Number(lng) : prev.lng,
    }));
    setErrors((prev) => ({
      ...prev,
      address: address ? '' : prev.address,
      city: city ? '' : prev.city,
      locality: locality ? '' : prev.locality,
      postalCode: postalCode ? '' : prev.postalCode,
    }));
    toast.success('Address and location auto-filled from Mapbox! 📍');
  };

  useEffect(() => {
    if (!editing) return;
    (async () => {
      try {
        const p = await adminService.getProperty(id);
        const { amount, unit } = parsePrice(p.price);
        setOriginal(p);
        setF({
          ...EMPTY,
          ...p,
          title: p.title || p.propertyName || '',
          buildingType: p.buildingType || 'Residential',
          listingType: p.listingType || 'Sell',
          userType: p.userType || 'Owner',
          builderName: p.builderName || '',
          propertyType: p.propertyType || 'Apartment',
          propertyAge: p.propertyAge || '',
          propertyStatus: p.propertyStatus || 'Ready to Move',
          priceAmount: amount,
          priceUnit: unit,
          amenities: p.amenities || [],
          unitConfigurations: Array.isArray(p.unitConfigurations) ? p.unitConfigurations : [],
          amenitiesText: p.amenitiesText || '',
      nearbyPlaces: Array.isArray(p.nearbyPlaces) ? p.nearbyPlaces : [],
          images: p.images || [],
          floorPlanImages: p.floorPlanImages || [],
          paymentPlanImages: p.paymentPlanImages || (p.paymentPlanImage ? [p.paymentPlanImage] : []),
            paymentPlanText: p.paymentPlanText || '',
          propertyVideo: p.propertyVideo || '',
          propertyBrochure: p.propertyBrochure || '',
          _brochureFileName: p.propertyBrochure ? (p._brochureFileName || 'Uploaded PDF') : '',
          totalProjectFloors: p.totalProjectFloors || '',
          possessionDate: p.possessionDate || '',
          superBuiltUpArea: p.superBuiltUpArea || '',
          carpetArea: p.carpetArea || '',
          projectArea: p.projectArea || '',
          totalUnits: p.totalUnits || '',
          towers: p.towers || '',
          noOfLifts: p.noOfLifts || '',
          parkingType: p.parkingType || '',
          pricePerSqft: p.pricePerSqft || '',
          launchDate: p.launchDate || '',
          approvals: p.approvals || '',
          propertyHighlights: p.propertyHighlights || '',
          reraNumber: p.reraNumber || '',
          ownerName: p.ownerName || 'ProBridge Admin',
          ownerEmail: p.ownerEmail || 'admin@probridge.com',
          phone: p.phone || p.ownerPhone || '',
          ownerPhone: p.ownerPhone || p.phone || '',
          owner: p.owner?._id || p.owner?.id || p.owner || null,
          lat: p.lat != null ? Number(p.lat) : (p.rawFormData?.lat != null ? Number(p.rawFormData.lat) : null),
          lng: p.lng != null ? Number(p.lng) : (p.rawFormData?.lng != null ? Number(p.rawFormData.lng) : null),
          address: p.address || p.rawFormData?.address || '',
          locality: p.locality || p.rawFormData?.locality || '',
          city: p.city || p.rawFormData?.city || '',
          postalCode: p.postalCode || p.rawFormData?.postalCode || '',
        });
      } catch (e) { setLoadError(errorMessage(e)); }
      finally { setLoading(false); }
    })();
  }, [id, editing]);

  const set = (k) => (e) => {
    setIsDirty(true);
    const val = e.target.value;
    setF((s) => {
      const next = { ...s, [k]: val };
      if (k === 'phone') next.ownerPhone = val;
      return next;
    });
  };

  const handlePropertyTypeChange = (e) => {
    setIsDirty(true);
    const val = e.target.value;
    setF((s) => {
      const next = { ...s, propertyType: val };
      if (val === 'Plot') {
        next.propertyAge = '';
        next.bedroom = '';
        next.bathroom = '';
        next.balconies = '';
        next.doorFacing = '';
        next.furnishingStatus = '';
        next.amenities = [];
        next.amenitiesText = '';
        next.totalProjectFloors = '';
        next.totalFloors = '';
        next.selectedFloor = '';
        if (!next.plotType) next.plotType = 'Independent Plot';
        if (!next.plotSize) next.plotSize = '30×40';
        if (!next.roadFacing) next.roadFacing = 'East';
        if (!next.plotDimensionUnit) next.plotDimensionUnit = 'Sq. Feet';
      } else {
        next.plotType = '';
        next.plotSize = '';
        next.customPlotSize = '';
        next.roadFacing = '';
        next.plotAge = '';
        next.plotDimension = '';
        next.plotDimensionUnit = '';
        if (!next.bedroom) next.bedroom = '2 BHK';
        if (!next.bathroom) next.bathroom = '2';
        if (!next.balconies) next.balconies = '1';
        if (!next.doorFacing) next.doorFacing = 'East';
        if (!next.furnishingStatus) next.furnishingStatus = 'Unfurnished';
      }
      return next;
    });
  };

  const plot = f.propertyType === 'Plot';
  const changed = (key) => Boolean(original?.editedFields?.includes(key));
  const prevVal = (key) => original?.previousValues?.[key];

  // ─€─€ Property Images Handlers ─€─€
  const addImageUrl = () => {
    const url = urlInput.trim();
    if (!/^https?:\/\//i.test(url)) { toast.error('Enter a full image link starting with http:// or https://'); return; }
    if (f.images.length >= MAX_IMAGES) { toast.error(`You can add up to ${MAX_IMAGES} images.`); return; }
    setIsDirty(true);
    setF((s) => ({ ...s, images: [...s.images, url] }));
    setUrlInput('');
  };

  const addFiles = (e) => {
    Array.from(e.target.files || []).forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      if (file.size > MAX_FILE_KB * 1024) { toast.error(`${file.name} is larger than ${MAX_FILE_KB} KB.`); return; }
      const reader = new FileReader();
      reader.onload = () => {
        setIsDirty(true);
        setF((s) => (s.images.length >= MAX_IMAGES ? s : { ...s, images: [...s.images, reader.result] }));
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleReplaceImage = (idx, newSrc) => {
    setIsDirty(true);
    setF((s) => {
      const next = [...s.images];
      next[idx] = newSrc;
      return { ...s, images: next };
    });
    toast.success(`Photo ${idx + 1} replaced!`);
  };

  const handleDeleteImage = (idx) => {
    setIsDirty(true);
    setF((s) => ({ ...s, images: s.images.filter((_, j) => j !== idx) }));
    toast.success('Image removed');
  };

  const handleSetCover = (idx) => {
    if (idx === 0) return;
    setIsDirty(true);
    setF((s) => {
      const target = s.images[idx];
      const rest = s.images.filter((_, j) => j !== idx);
      return { ...s, images: [target, ...rest] };
    });
    setLightboxIndex(0);
    toast.success('Cover photo updated!');
  };

  const handleMoveImage = (idx, dir, e) => {
    e?.stopPropagation();
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= f.images.length) return;
    setIsDirty(true);
    setF((s) => {
      const copy = [...s.images];
      const temp = copy[idx];
      copy[idx] = copy[newIdx];
      copy[newIdx] = temp;
      return { ...s, images: copy };
    });
  };

  // ─€─€ Floor Plan Images Handlers ─€─€
  const addFloorPlanUrl = () => {
    const url = floorPlanUrlInput.trim();
    if (!/^https?:\/\//i.test(url)) { toast.error('Enter a full image link starting with http:// or https://'); return; }
    if ((f.floorPlanImages || []).length >= MAX_FLOOR_PLANS) { toast.error(`You can add up to ${MAX_FLOOR_PLANS} floor plan images.`); return; }
    setIsDirty(true);
    setF((s) => ({ ...s, floorPlanImages: [...(s.floorPlanImages || []), url] }));
    setFloorPlanUrlInput('');
  };

  const addFloorPlanFiles = (e) => {
    Array.from(e.target.files || []).forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      if (file.size > MAX_FILE_KB * 1024) { toast.error(`${file.name} is larger than ${MAX_FILE_KB} KB.`); return; }
      const reader = new FileReader();
      reader.onload = () => {
        setIsDirty(true);
        setF((s) => ((s.floorPlanImages || []).length >= MAX_FLOOR_PLANS ? s : { ...s, floorPlanImages: [...(s.floorPlanImages || []), reader.result] }));
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleDeleteFloorPlan = (idx) => {
    setIsDirty(true);
    setF((s) => ({ ...s, floorPlanImages: (s.floorPlanImages || []).filter((_, j) => j !== idx) }));
    toast.success('Floor plan removed');
  };

  // ─€─€ Payment Plan Images Handlers ─€─€
  const MAX_PAYMENT_PLANS = 2;
  const addPaymentPlanUrl = () => {
    const url = paymentPlanUrlInput.trim();
    if (!/^https?:\/\//i.test(url)) { toast.error('Enter a full image link starting with http:// or https://'); return; }
    if ((f.paymentPlanImages || []).length >= MAX_PAYMENT_PLANS) { toast.error(`You can add up to ${MAX_PAYMENT_PLANS} payment plan images.`); return; }
    setIsDirty(true);
    setF((s) => ({ ...s, paymentPlanImages: [...(s.paymentPlanImages || []), url] }));
    setPaymentPlanUrlInput('');
  };

  const addPaymentPlanFiles = (e) => {
    Array.from(e.target.files || []).forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      if (file.size > MAX_FILE_KB * 1024) { toast.error(`${file.name} is larger than ${MAX_FILE_KB} KB.`); return; }
      const reader = new FileReader();
      reader.onload = () => {
        setIsDirty(true);
        setF((s) => ((s.paymentPlanImages || []).length >= MAX_PAYMENT_PLANS ? s : { ...s, paymentPlanImages: [...(s.paymentPlanImages || []), reader.result] }));
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleDeletePaymentPlan = (idx) => {
    setIsDirty(true);
    setF((s) => ({ ...s, paymentPlanImages: (s.paymentPlanImages || []).filter((_, j) => j !== idx) }));
    toast.success('Payment plan removed');
  };

  // ─€─€ Brochure PDF Upload Handler ─€─€
  const handleBrochureUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Only PDF files are allowed.'); return;
    }
    if (file.size > 15 * 1024 * 1024) { toast.error('PDF must be under 15 MB.'); return; }
    setBrochureUploading(true);
    try {
      const formData = new FormData();
      formData.append('brochure', file);
      const { data } = await api.post('/api/upload/pdf', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (data.success) {
        setIsDirty(true);
        setF((s) => ({ ...s, propertyBrochure: data.url, _brochureFileName: data.fileName || file.name }));
        toast.success('Brochure uploaded successfully!');
      } else {
        toast.error(data.message || 'Upload failed.');
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBrochureUploading(false);
      e.target.value = '';
    }
  };

  // ─€─€ Custom Amenity Add Handler ─€─€
  const handleAddCustomAmenity = (e) => {
    e?.preventDefault();
    const val = customAmenityInput.trim();
    if (!val) return;
    if (f.amenities.includes(val)) {
      toast.info(`"${val}" is already added.`);
      setCustomAmenityInput('');
      return;
    }
    setIsDirty(true);
    setF((s) => ({
      ...s,
      amenities: [...s.amenities, val],
    }));
    setCustomAmenityInput('');
  };

  const validate = () => {
    const er = {};
    if (!f.title.trim()) er.title = 'Property Name is required.';
    if (f.userType === 'Builder' && !f.builderName?.trim()) er.builderName = 'Builder / Developer Name is required.';
    if (!f.address.trim()) er.address = 'Full Address is required.';
    if (!f.city.trim()) er.city = 'City is required.';
    if (!f.locality.trim()) er.locality = 'Locality is required.';
    if (f.postalCode && !/^\d{6}$/.test(f.postalCode)) er.postalCode = 'Postal Code must be 6 digits.';
    if (!(Number(f.priceAmount) > 0)) er.priceAmount = 'Enter an Expected Price greater than 0.';
    if (f.ownerEmail && !/^\S+@\S+\.\S+$/.test(f.ownerEmail)) er.ownerEmail = 'Enter a valid Email Address.';
    if (f.phone && !/^\d{10}$/.test(f.phone)) er.phone = 'Phone Number must be 10 digits.';
    if (f.images.length < MIN_IMAGES) er.images = `Add at least ${MIN_IMAGES} Property Images (${f.images.length} of ${MIN_IMAGES} added).`;

    if (plot) {
      if (!f.plotType) er.plotType = 'Plot Type is required.';
      if (!f.plotSize) er.plotSize = 'Plot Size is required.';
      if (f.plotSize === 'Other' && !f.customPlotSize?.trim()) er.customPlotSize = 'Custom Plot Size is required.';
      if (!f.roadFacing) er.roadFacing = 'Road Facing direction is required.';
      if (!f.plotAge) er.plotAge = 'Plot Age is required.';
      if (!f.plotDimension?.trim()) er.plotDimension = 'Plot Dimension is required.';
    }

    setErrors(er);
    return Object.keys(er).length === 0;
  };

  const buildPayload = () => {
    const common = [
      'title', 'buildingType', 'listingType', 'userType', 'builderName', 'propertyType', 'propertyStatus',
      'propertyAge', 'description', 'propertyHighlights', 'reraNumber', 'address', 'city', 'locality',
      'postalCode', 'lat', 'lng', 'maintenanceCharge', 'amenities', 'amenitiesText', 'images', 'floorPlanImages',
      'paymentPlanImages', 'paymentPlanText', 'propertyVideo', 'propertyBrochure', 'ownerName', 'ownerEmail', 'phone', 'ownerPhone',
      'owner', 'status', 'totalProjectFloors', 'possessionDate',
      // New fields from Prestige Palm Court
      'superBuiltUpArea', 'carpetArea', 'projectArea', 'totalUnits', 'towers',
      'noOfLifts', 'parkingType', 'pricePerSqft', 'launchDate', 'approvals',
    ];
    const residential = ['bedroom', 'bathroom', 'balconies', 'doorFacing', 'furnishingStatus', 'totalFloors', 'selectedFloor'];
    const plotFields = ['plotType', 'plotSize', 'customPlotSize', 'roadFacing', 'plotAge', 'plotDimension', 'plotDimensionUnit'];
    const pick = (keys) => Object.fromEntries(keys.map((k) => [k, f[k]]));
    const blank = (keys) => Object.fromEntries(keys.map((k) => [k, '']));
    const customPlotVal = f.customPlotSize?.trim();
    const resolvedPlotSize = (plot && f.plotSize === 'Other' && customPlotVal) ? customPlotVal : f.plotSize;
    return {
      ...pick(common),
      propertyName: f.title,
      ...(plot ? {
        ...pick(plotFields),
        plotSize: resolvedPlotSize,
        customPlotSize: customPlotVal || f.customPlotSize,
        ...blank(residential)
      } : { ...pick(residential), ...blank(plotFields) }),
      owner: f.owner || null,
      ownerName: f.ownerName || 'ProBridge Admin',
      ownerEmail: f.ownerEmail || 'admin@probridge.com',
      paymentPlanImage: f.paymentPlanImages?.[0] || '',
      price: f.priceUnit === 'Rs' ? String(Number(f.priceAmount)) : `${Number(f.priceAmount)} ${f.priceUnit}`,
      priceUnit: f.priceUnit,
      location: [f.locality, f.city].filter(Boolean).join(', '),
      image: f.images[0] || '',
      unitConfigurations: f.unitConfigurations || [],
      nearbyPlaces: f.nearbyPlaces || [],
      approvalStatus: 'approved',
      status: f.status || 'active',
    };
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) { toast.error('Please fix the highlighted fields.'); return; }
    const payload = buildPayload();
    setSaving(true);
    try {
      if (editing) { await adminService.updateProperty(id, payload); toast.success('Property updated.'); }
      else { await adminService.createProperty(payload); toast.success('Property created.'); }
      refreshPending();
      savedRef.current = true;
      navigate('/properties');
    } catch (err) { toast.error(errorMessage(err)); }
    finally { setSaving(false); }
  };

  const handleSaveAndPublish = async () => {
    if (!validate()) { toast.error('Please fix the highlighted fields.'); return; }
    setSaving(true);
    try {
      const payload = buildPayload();
      await adminService.updateProperty(id, payload);
      await adminService.setApproval(id, 'approve');
      toast.success('Property updated, approved & published live! 🎉');
      refreshPending();
      savedRef.current = true;
      navigate('/approvals');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;
  if (loadError) return <ErrorState message={loadError} />;

  const isPending = original?.approvalStatus === 'pending';

  return (
    <>
      {/* ─€─€ Unsaved Changes Blocker Dialog ─€─€ */}
      {showPrompt && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(15,23,42,.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: '#fff', borderRadius: 14, padding: '28px 28px 22px',
            maxWidth: 420, width: '90vw',
            boxShadow: '0 20px 50px rgba(0,0,0,.25)',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{ fontSize: 26, textAlign: 'center' }}>âš ï¸</div>
            <h2 style={{ margin: 0, fontSize: 18, textAlign: 'center' }}>Unsaved Changes</h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: 14, textAlign: 'center', lineHeight: 1.6 }}>
              You have unsaved changes on this page. If you leave now, your changes will be lost.
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 8, justifyContent: 'center' }}>
              <button
                type="button"
                onClick={handleKeepEditing}
                style={{
                  padding: '9px 20px', borderRadius: 8, border: '1px solid #e2e8f0',
                  background: '#fff', color: '#0f172a', fontWeight: 600,
                  cursor: 'pointer', fontSize: 14,
                }}
              >
                âœï¸ Keep Editing
              </button>
              <button
                type="button"
                onClick={handleLeave}
                style={{
                  padding: '9px 20px', borderRadius: 8, border: 0,
                  background: '#dc2626', color: '#fff', fontWeight: 600,
                  cursor: 'pointer', fontSize: 14,
                }}
              >
                Leave Page
              </button>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={submit} noValidate>
        <div className="page-head">
          <h1>{editing ? 'Edit property' : 'Add property'}</h1>
          {editing && original && <div className="badges"><StatusBadge map={APPROVAL} value={original.approvalStatus} /></div>}
        </div>

        {/* ─€─€ Pending Review & Changes Banner ─€─€ */}
        {isPending && (
          <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: 16, marginBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ backgroundColor: '#fef3c7', color: '#92400e', fontWeight: 700, padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>
                  â³ Pending Admin Review
                </span>
                {original.editedFields && original.editedFields.length > 0 && (
                  <span style={{ backgroundColor: '#e0e7ff', color: '#3730a3', fontWeight: 600, padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>
                    âœï¸ User changed {original.editedFields.length} field(s)
                  </span>
                )}
              </div>
              <p style={{ margin: '6px 0 0', color: '#b45309', fontSize: 13, lineHeight: 1.4 }}>
                You can edit any details below. Fields marked in amber with <strong>"âœï¸ Modified"</strong> were changed by the user. Click <strong>"Approve & Publish"</strong> when ready to make it live on the app.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-success"
              disabled={saving}
              onClick={handleSaveAndPublish}
              style={{ whiteSpace: 'nowrap' }}
            >
              <Check size={16} /> Approve & Publish
            </button>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            STEP 1 – BASIC INFORMATION
        ══════════════════════════════════════════════════════════════ */}
        <section className="card form-section">
          <h3>Step 1 – Basic Information</h3>
          <div className="form-grid">
            <Field label="Building Type" isChanged={changed('buildingType')} previousValue={prevVal('buildingType')}>
              <select value={f.buildingType} onChange={set('buildingType')}>
                {BUILDING_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>

            <Field label="Listing Type" isChanged={changed('listingType')} previousValue={prevVal('listingType')}>
              <select value={f.listingType} onChange={set('listingType')}>
                {LISTING_TYPES.map((t) => <option key={t} value={t}>{t === 'Sell' ? 'Sell (For Sale)' : t}</option>)}
              </select>
            </Field>

            <Field label="User Type" isChanged={changed('userType')} previousValue={prevVal('userType')}>
              <select value={f.userType} onChange={set('userType')}>
                {USER_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>

            {f.userType === 'Builder' && (
              <Field label="Builder / Developer Name" required error={errors.builderName} isChanged={changed('builderName')} previousValue={prevVal('builderName')}>
                <input value={f.builderName} onChange={set('builderName')} placeholder="e.g. Prestige Group / Casagrand" />
              </Field>
            )}

            <Field label="Email Address" error={errors.ownerEmail} isChanged={changed('ownerEmail')} previousValue={prevVal('ownerEmail')}>
              <input type="email" value={f.ownerEmail} onChange={set('ownerEmail')} placeholder="seller@example.com" />
            </Field>

            <Field label="Phone Number" error={errors.phone} isChanged={changed('phone')} previousValue={prevVal('phone')}>
              <input inputMode="numeric" maxLength={10} value={f.phone} onChange={set('phone')} placeholder="10-digit mobile number" />
            </Field>

            <Field label="Property Type" isChanged={changed('propertyType')} previousValue={prevVal('propertyType')}>
              <select value={f.propertyType} onChange={handlePropertyTypeChange}>
                {PROPERTY_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>

            <div className="span-2">
              <Field label="Property Name" required error={errors.title} isChanged={changed('title') || changed('propertyName')} previousValue={prevVal('title') || prevVal('propertyName')}>
                <input value={f.title} onChange={set('title')} placeholder="e.g. Luxury 3 BHK Sea View Apartment" />
              </Field>
            </div>

            {!plot && (
              <Field label="Property Age" isChanged={changed('propertyAge')} previousValue={prevVal('propertyAge')}>
                <input type="number" min="0" value={f.propertyAge} onChange={set('propertyAge')} placeholder="e.g. 2 (years)" />
              </Field>
            )}

            <Field label="Property Status" isChanged={changed('propertyStatus')} previousValue={prevVal('propertyStatus')}>
              <select value={f.propertyStatus} onChange={set('propertyStatus')}>
                {PROPERTY_STATUS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>

            <Field label="City" required error={errors.city} isChanged={changed('city')} previousValue={prevVal('city')}>
              <input value={f.city} onChange={set('city')} placeholder="e.g. Chennai" />
            </Field>

            <Field label="Locality" required error={errors.locality} isChanged={changed('locality')} previousValue={prevVal('locality')}>
              <input value={f.locality} onChange={set('locality')} placeholder="e.g. Adyar" />
            </Field>

            <div className="span-2">
              <Field label="Full Address" required error={errors.address} isChanged={changed('address')} previousValue={prevVal('address')}>
                <div className="input-icon">
                  <input
                    value={f.address}
                    onChange={set('address')}
                    onClick={() => { if (!f.address.trim()) setMapModalOpen(true); }}
                    placeholder="Click to pin on Mapbox or type full address..."
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    title="Pin location on Mapbox"
                    onClick={() => setMapModalOpen(true)}
                    style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', color: 'var(--accent)' }}
                  >
                    <MapPin size={18} />
                  </button>
                </div>
              </Field>
            </div>

            <Field label="Postal Code" error={errors.postalCode} isChanged={changed('postalCode')} previousValue={prevVal('postalCode')}>
              <input inputMode="numeric" maxLength={6} value={f.postalCode} onChange={set('postalCode')} placeholder="e.g. 600020" />
            </Field>

            <div className="span-2" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)', marginTop: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <MapPin size={18} style={{ color: 'var(--accent)' }} />
                <div>
                  <strong style={{ fontSize: 13, display: 'block' }}>Property Location</strong>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {f.lat != null && f.lng != null ? `Pinned: Lat ${Number(f.lat).toFixed(4)}, Lng ${Number(f.lng).toFixed(4)}` : 'No map pin selected'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => setMapModalOpen(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <MapPin size={14} /> {f.lat != null && f.lng != null ? 'View / Change Pin' : 'Pin on Map (Mapbox)'}
              </button>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            STEP 2 – PROPERTY DETAILS
        ══════════════════════════════════════════════════════════════ */}
        <section className="card form-section">
          <h3>Step 2 – Property Details</h3>
          <div className="form-grid">
            {plot ? (
              <>
                <Field label="Plot Type" required error={errors.plotType} isChanged={changed('plotType')} previousValue={prevVal('plotType')}>
                  <select value={f.plotType} onChange={set('plotType')}>{PLOT_TYPES.map((v) => <option key={v}>{v}</option>)}</select>
                </Field>
                <Field label="Plot Size" required error={errors.plotSize} isChanged={changed('plotSize')} previousValue={prevVal('plotSize')}>
                  <select
                    value={f.plotSize}
                    onChange={(e) => {
                      setIsDirty(true);
                      const v = e.target.value;
                      setF((s) => ({ ...s, plotSize: v, customPlotSize: v === 'Other' ? s.customPlotSize : '' }));
                    }}
                  >
                    {PLOT_SIZES.map((v) => <option key={v}>{v}</option>)}
                  </select>
                </Field>
                {f.plotSize === 'Other' && (
                  <Field label="Custom Plot Size" required error={errors.customPlotSize} isChanged={changed('customPlotSize')} previousValue={prevVal('customPlotSize')}>
                    <input value={f.customPlotSize} onChange={set('customPlotSize')} placeholder="e.g. 40×70 or 2400 sq.ft" />
                  </Field>
                )}
                <Field label="Road Facing" required error={errors.roadFacing} isChanged={changed('roadFacing')} previousValue={prevVal('roadFacing')}>
                  <select value={f.roadFacing} onChange={set('roadFacing')}>{DIRECTIONS.map((v) => <option key={v}>{v}</option>)}</select>
                </Field>
                <Field label="Plot Age" required error={errors.plotAge} isChanged={changed('plotAge')} previousValue={prevVal('plotAge')}>
                  <input type="number" min="0" value={f.plotAge} onChange={set('plotAge')} placeholder="e.g. 2 (years)" />
                </Field>
                <Field label="Plot Dimensions" required error={errors.plotDimension} isChanged={changed('plotDimension')} previousValue={prevVal('plotDimension')}>
                  <input value={f.plotDimension} onChange={set('plotDimension')} placeholder="e.g. 30 × 40" />
                </Field>
                <Field label="Plot Dimension Unit" required isChanged={changed('plotDimensionUnit')} previousValue={prevVal('plotDimensionUnit')}>
                  <select value={f.plotDimensionUnit} onChange={set('plotDimensionUnit')}>{DIM_UNITS.map((v) => <option key={v}>{v}</option>)}</select>
                </Field>
              </>
            ) : (
              <>
                <Field label="Bedroom Configuration" isChanged={changed('bedroom')} previousValue={prevVal('bedroom')}>
                  <select value={f.bedroom} onChange={set('bedroom')}>{BEDROOMS.map((v) => <option key={v}>{v}</option>)}</select>
                </Field>
                <Field label="Bathrooms" isChanged={changed('bathroom')} previousValue={prevVal('bathroom')}>
                  <select value={f.bathroom} onChange={set('bathroom')}>{BATHROOMS.map((v) => <option key={v}>{v}</option>)}</select>
                </Field>
                <Field label="Balconies" isChanged={changed('balconies')} previousValue={prevVal('balconies')}>
                  <select value={f.balconies} onChange={set('balconies')}>{BALCONIES.map((v) => <option key={v}>{v}</option>)}</select>
                </Field>
                <Field label="Door Facing" isChanged={changed('doorFacing')} previousValue={prevVal('doorFacing')}>
                  <select value={f.doorFacing} onChange={set('doorFacing')}>{DIRECTIONS.map((v) => <option key={v}>{v}</option>)}</select>
                </Field>
                <Field label="Furnishing Status" isChanged={changed('furnishingStatus')} previousValue={prevVal('furnishingStatus')}>
                  <select value={f.furnishingStatus} onChange={set('furnishingStatus')}>{FURNISHING.map((v) => <option key={v}>{v}</option>)}</select>
                </Field>
                <Field label="Total Project Floors" isChanged={changed('totalProjectFloors')} previousValue={prevVal('totalProjectFloors')}>
                  <input type="number" min="0" value={f.totalProjectFloors} onChange={set('totalProjectFloors')} placeholder="e.g. 15" />
                </Field>
                <Field label="Possession Date" isChanged={changed('possessionDate')} previousValue={prevVal('possessionDate')}>
                  <input type="date" value={f.possessionDate} onChange={set('possessionDate')} />
                </Field>

                {/* ─€─€ New Project-Level Fields ─€─€ */}
                <Field label="Super Built-Up Area (sq.ft.)" isChanged={changed('superBuiltUpArea')} previousValue={prevVal('superBuiltUpArea')}>
                  <input type="number" min="0" value={f.superBuiltUpArea} onChange={set('superBuiltUpArea')} placeholder="e.g. 1250" />
                </Field>
                <Field label="Carpet Area (sq.ft.)" isChanged={changed('carpetArea')} previousValue={prevVal('carpetArea')}>
                  <input type="number" min="0" value={f.carpetArea} onChange={set('carpetArea')} placeholder="e.g. 980" />
                </Field>
                <Field label="Project Area (Acres)" isChanged={changed('projectArea')} previousValue={prevVal('projectArea')}>
                  <input type="text" value={f.projectArea} onChange={set('projectArea')} placeholder="e.g. 7.98 Acres" />
                </Field>
                <Field label="Total Units" isChanged={changed('totalUnits')} previousValue={prevVal('totalUnits')}>
                  <input type="number" min="0" value={f.totalUnits} onChange={set('totalUnits')} placeholder="e.g. 910" />
                </Field>
                <Field label="Number of Towers / Blocks" isChanged={changed('towers')} previousValue={prevVal('towers')}>
                  <input type="number" min="0" value={f.towers} onChange={set('towers')} placeholder="e.g. 5" />
                </Field>
                <Field label="Number of Lifts (per Tower)" isChanged={changed('noOfLifts')} previousValue={prevVal('noOfLifts')}>
                  <input type="number" min="0" value={f.noOfLifts} onChange={set('noOfLifts')} placeholder="e.g. 3" />
                </Field>
                <Field label="Parking Type" isChanged={changed('parkingType')} previousValue={prevVal('parkingType')}>
                  <select value={f.parkingType} onChange={set('parkingType')}>
                    <option value="">Select Parking Type</option>
                    <option>Covered Parking</option>
                    <option>Open Parking</option>
                    <option>Multi-Storey Parking</option>
                    <option>Basement Parking</option>
                    <option>Stilt Parking</option>
                    <option>No Parking</option>
                  </select>
                </Field>
              </>
            )}
          </div>

          {!plot && (
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                    Available BHK Unit Configurations (1, 2, 3 BHK Details)
                  </h4>
                  <p className="muted-text" style={{ margin: '4px 0 0', fontSize: 13 }}>
                    Add multiple unit configurations (e.g. 1 BHK, 2 BHK, 3 BHK) with their area, price, and status for this property.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 12, padding: '6px 12px' }}
                    onClick={() => {
                      setIsDirty(true);
                      setF((s) => ({
                        ...s,
                        unitConfigurations: [
                          ...(s.unitConfigurations || []),
                          { bhk: '1 BHK', area: '650 sq.ft', carpetArea: '450 sq.ft', price: '₹45 Lac', bathrooms: '1', balconies: '1', status: 'Ready to Move' },
                          { bhk: '2 BHK', area: '1050 sq.ft', carpetArea: '750 sq.ft', price: '₹75 Lac', bathrooms: '2', balconies: '1', status: 'Ready to Move' },
                          { bhk: '3 BHK', area: '1450 sq.ft', carpetArea: '1050 sq.ft', price: '₹1.15 Cr', bathrooms: '3', balconies: '2', status: 'Ready to Move' },
                        ]
                      }));
                    }}
                  >
                    + Quick Add (1, 2 & 3 BHK)
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ fontSize: 12, padding: '6px 12px' }}
                    onClick={() => {
                      setIsDirty(true);
                      setF((s) => ({
                        ...s,
                        unitConfigurations: [
                          ...(s.unitConfigurations || []),
                          {
                            bhk: `${(s.unitConfigurations?.length || 0) + 1} BHK`,
                            area: '',
                            carpetArea: '',
                            price: '',
                            bathrooms: '2',
                            balconies: '1',
                            status: 'Ready to Move'
                          }
                        ]
                      }));
                    }}
                  >
                    + Add BHK Config
                  </button>
                </div>
              </div>

              {(!f.unitConfigurations || f.unitConfigurations.length === 0) ? (
                <div style={{ padding: '16px', background: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1', textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                  No extra BHK configurations added yet. Click <strong>"+ Add BHK Config"</strong> or <strong>"+ Quick Add (1, 2 & 3 BHK)"</strong> to list multiple options.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {f.unitConfigurations.map((cfg, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '14px',
                        background: '#f8fafc',
                        borderRadius: 8,
                        border: '1px solid #e2e8f0',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr)) 40px',
                        gap: 10,
                        alignItems: 'end'
                      }}
                    >
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                          BHK Type
                        </label>
                        <select
                          value={cfg.bhk}
                          onChange={(e) => {
                            setIsDirty(true);
                            const val = e.target.value;
                            setF((s) => {
                              const list = [...s.unitConfigurations];
                              list[idx] = { ...list[idx], bhk: val };
                              return { ...s, unitConfigurations: list };
                            });
                          }}
                          style={{ width: '100%', padding: '6px 8px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1' }}
                        >
                          {['1 RK', '1 BHK', '1.5 BHK', '2 BHK', '2.5 BHK', '3 BHK', '3.5 BHK', '4 BHK', '5 BHK', 'Studio', 'Duplex', 'Penthouse'].map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                          Super Built-Up Area
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 1250 sq.ft"
                          value={cfg.area}
                          onChange={(e) => {
                            setIsDirty(true);
                            const val = e.target.value;
                            setF((s) => {
                              const list = [...s.unitConfigurations];
                              list[idx] = { ...list[idx], area: val };
                              return { ...s, unitConfigurations: list };
                            });
                          }}
                          style={{ width: '100%', padding: '6px 8px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                          Carpet Area
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 850 sq.ft"
                          value={cfg.carpetArea || ''}
                          onChange={(e) => {
                            setIsDirty(true);
                            const val = e.target.value;
                            setF((s) => {
                              const list = [...s.unitConfigurations];
                              list[idx] = { ...list[idx], carpetArea: val };
                              return { ...s, unitConfigurations: list };
                            });
                          }}
                          style={{ width: '100%', padding: '6px 8px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                          Price
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. ₹75 Lac"
                          value={cfg.price}
                          onChange={(e) => {
                            setIsDirty(true);
                            const val = e.target.value;
                            setF((s) => {
                              const list = [...s.unitConfigurations];
                              list[idx] = { ...list[idx], price: val };
                              return { ...s, unitConfigurations: list };
                            });
                          }}
                          style={{ width: '100%', padding: '6px 8px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                          Baths
                        </label>
                        <select
                          value={cfg.bathrooms || '1'}
                          onChange={(e) => {
                            setIsDirty(true);
                            const val = e.target.value;
                            setF((s) => {
                              const list = [...s.unitConfigurations];
                              list[idx] = { ...list[idx], bathrooms: val };
                              return { ...s, unitConfigurations: list };
                            });
                          }}
                          style={{ width: '100%', padding: '6px 8px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1' }}
                        >
                          {['1', '2', '3', '4', '5+'].map((opt) => (
                            <option key={opt} value={opt}>{opt} Bath</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                          Balconies
                        </label>
                        <select
                          value={cfg.balconies || '1'}
                          onChange={(e) => {
                            setIsDirty(true);
                            const val = e.target.value;
                            setF((s) => {
                              const list = [...s.unitConfigurations];
                              list[idx] = { ...list[idx], balconies: val };
                              return { ...s, unitConfigurations: list };
                            });
                          }}
                          style={{ width: '100%', padding: '6px 8px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1' }}
                        >
                          {['0', '1', '2', '3', '4+'].map((opt) => (
                            <option key={opt} value={opt}>{opt} Balcony</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                          Status
                        </label>
                        <select
                          value={cfg.status || 'Ready to Move'}
                          onChange={(e) => {
                            setIsDirty(true);
                            const val = e.target.value;
                            setF((s) => {
                              const list = [...s.unitConfigurations];
                              list[idx] = { ...list[idx], status: val };
                              return { ...s, unitConfigurations: list };
                            });
                          }}
                          style={{ width: '100%', padding: '6px 8px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1' }}
                        >
                          {['Ready to Move', 'Under Construction', 'Available', 'Booking Open'].map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <button
                          type="button"
                          title="Remove Configuration"
                          onClick={() => {
                            setIsDirty(true);
                            setF((s) => ({
                              ...s,
                              unitConfigurations: s.unitConfigurations.filter((_, i) => i !== idx)
                            }));
                          }}
                          style={{
                            width: '36px',
                            height: '36px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 6,
                            background: '#fee2e2',
                            color: '#dc2626',
                            border: '1px solid #fecaca',
                            cursor: 'pointer'
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!plot && (
            <>
              <h4 style={{ marginTop: 18, marginBottom: 8 }}>Amenities</h4>
              <p className="muted-text" style={{ margin: '0 0 10px 0', fontSize: 13 }}>
                Select standard amenities chips and type custom amenities or descriptive amenities text.
              </p>
              <div className="chips">
                {AMENITIES.map((a) => (
                  <label key={a} className={`chip chip-check ${f.amenities.includes(a) ? 'on' : ''}`}>
                    <input
                      type="checkbox"
                      checked={f.amenities.includes(a)}
                      onChange={() => {
                        setIsDirty(true);
                        setF((s) => ({
                          ...s,
                          amenities: s.amenities.includes(a) ? s.amenities.filter((x) => x !== a) : [...s.amenities, a],
                        }));
                      }}
                    />
                    {a}
                  </label>
                ))}
                {/* Any custom amenities entered */}
                {f.amenities.filter((a) => !AMENITIES.includes(a)).map((a) => (
                  <label key={a} className="chip chip-check on" style={{ background: '#e0f2fe', borderColor: '#0284c7', color: '#0369a1' }}>
                    <input
                      type="checkbox"
                      checked={true}
                      onChange={() => {
                        setIsDirty(true);
                        setF((s) => ({
                          ...s,
                          amenities: s.amenities.filter((x) => x !== a),
                        }));
                      }}
                    />
                    {a} ✕
                  </label>
                ))}
              </div>

              {/* Custom Amenity Text input */}
              <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', maxWidth: 480 }}>
                <input
                  type="text"
                  value={customAmenityInput}
                  onChange={(e) => setCustomAmenityInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomAmenity(); } }}
                  placeholder="Add custom amenity (e.g. CCTV, 24X7 Water, Playground)..."
                  style={{ flex: 1, padding: '7px 12px', fontSize: 13, border: '1.5px solid var(--border)', borderRadius: 6 }}
                />
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={handleAddCustomAmenity}
                  style={{ whiteSpace: 'nowrap', padding: '7px 14px' }}
                >
                  + Add Amenity
                </button>
              </div>

              {/* Full Amenities Text Area */}
              <div style={{ marginTop: 14 }}>
                <Field label="Amenities Text / Highlights" isChanged={changed('amenitiesText')} previousValue={prevVal('amenitiesText')}>
                  <textarea
                    rows={2}
                    value={f.amenitiesText || ''}
                    onChange={set('amenitiesText')}
                    placeholder="Type additional amenities highlights or comma-separated amenities text..."
                  />
                </Field>
              </div>
            </>
          )}
        </section>

        {/* ══════════════════════════════════════════════════════════════
            STEP 3 – PRICING & DESCRIPTION
        ══════════════════════════════════════════════════════════════ */}
        <section className="card form-section">
          <h3>Step 3 – Pricing & Description</h3>
          <div className="form-grid">
            {!plot && (
              <>
                <Field label="Total Floors" isChanged={changed('totalFloors')} previousValue={prevVal('totalFloors')}>
                  <input type="number" min="0" value={f.totalFloors} onChange={set('totalFloors')} placeholder="e.g. 4" />
                </Field>

                <Field label="Property Floor" isChanged={changed('selectedFloor')} previousValue={prevVal('selectedFloor')}>
                  <input type="number" min="0" value={f.selectedFloor} onChange={set('selectedFloor')} placeholder="e.g. 2" />
                </Field>
              </>
            )}

            <Field label="Expected Price" required error={errors.priceAmount} isChanged={changed('price') || changed('priceAmount')} previousValue={prevVal('price')}>
              <div className="input-group">
                <input type="number" min="0" step="any" value={f.priceAmount} onChange={set('priceAmount')} placeholder="e.g. 85" />
                <select value={f.priceUnit} onChange={set('priceUnit')}>
                  <option value="Lac">Lac</option>
                  <option value="Cr">Cr</option>
                  <option value="Rs">₹ (exact)</option>
                </select>
              </div>
            </Field>

            <Field label="Price Unit" isChanged={changed('priceUnit')} previousValue={prevVal('priceUnit')}>
              <select value={f.priceUnit} onChange={set('priceUnit')}>
                <option value="Lac">Lac</option>
                <option value="Cr">Cr</option>
                <option value="Rs">₹ (exact)</option>
              </select>
            </Field>

            <Field label="Maintenance Charges" isChanged={changed('maintenanceCharge')} previousValue={prevVal('maintenanceCharge')}>
              <input type="number" min="0" value={f.maintenanceCharge} onChange={set('maintenanceCharge')} placeholder="₹ / month" />
            </Field>

            <Field label="Price Per Sq.ft. (₹)" isChanged={changed('pricePerSqft')} previousValue={prevVal('pricePerSqft')}>
              <input type="number" min="0" value={f.pricePerSqft} onChange={set('pricePerSqft')} placeholder="e.g. 7500" />
            </Field>

            <Field label="Project Launch Date" isChanged={changed('launchDate')} previousValue={prevVal('launchDate')}>
              <input type="date" value={f.launchDate} onChange={set('launchDate')} />
            </Field>

            <Field label="RERA Registration Number" isChanged={changed('reraNumber')} previousValue={prevVal('reraNumber')}>
              <input value={f.reraNumber} onChange={set('reraNumber')} placeholder="e.g. TN/01/Building/0001/2024" />
            </Field>

            <div className="span-2">
              <Field label="Approvals / Certifications" isChanged={changed('approvals')} previousValue={prevVal('approvals')}>
                <input value={f.approvals} onChange={set('approvals')} placeholder="e.g. DTCP Approved, CMDA Approved, RERA Registered, BDA Sanctioned" />
              </Field>
            </div>

            <div className="span-2">
              <Field label="Property Highlights" isChanged={changed('propertyHighlights')} previousValue={prevVal('propertyHighlights')}>
                <input value={f.propertyHighlights} onChange={set('propertyHighlights')} placeholder="e.g. Corner property, 100m from Metro station, North-East facing" />
              </Field>
            </div>

            <div className="span-2">
              <Field label="Property Description" isChanged={changed('description')} previousValue={prevVal('description')}>
                <textarea rows={4} value={f.description} onChange={set('description')} placeholder="Detailed description of the property, neighborhood, amenities..." />
              </Field>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            STEP 4 – PHOTOS & DOCUMENTS
        ══════════════════════════════════════════════════════════════ */}
        <section className="card form-section">
          <h3>Step 4 – Photos & Documents</h3>

          {/* Property Images */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <h4 style={{ margin: 0 }}>Property Images</h4>
              <span style={{
                fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 20,
                background: f.images.length >= MIN_IMAGES ? 'var(--success-bg, #dcfce7)' : 'var(--warning-bg, #fef9c3)',
                color: f.images.length >= MIN_IMAGES ? '#16a34a' : '#92400e',
                border: `1px solid ${f.images.length >= MIN_IMAGES ? '#86efac' : '#fde68a'}`,
              }}>
                {f.images.length} / {MAX_IMAGES}
              </span>
            </div>
            <p className="muted-text" style={{ margin: '0 0 10px 0', fontSize: 13 }}>
              Minimum {MIN_IMAGES} images required Â· Upload up to {MAX_IMAGES} images. Add direct image URL or upload files (under {MAX_FILE_KB} KB each).
            </p>
            {/* "Need X more" nudge — only shown when under minimum and no validation error yet */}
            {f.images.length > 0 && f.images.length < MIN_IMAGES && !errors.images && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, padding: '6px 12px', borderRadius: 8, background: '#fef3c7', border: '1px solid #fde68a', fontSize: 12, color: '#92400e' }}>
                <ImagePlus size={13} />
                Add {MIN_IMAGES - f.images.length} more image{MIN_IMAGES - f.images.length > 1 ? 's' : ''} to meet the minimum requirement.
              </div>
            )}
            <div className="img-add">
              <div className="input-group grow">
                <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="https://”¦/photo.jpg" />
                <button type="button" className="btn" onClick={addImageUrl}><Link2 size={15} /> Add link</button>
              </div>
              <label className="btn"><ImagePlus size={15} /> Upload files<input type="file" accept="image/*" multiple hidden onChange={addFiles} /></label>
            </div>
            {errors.images && <small className="field-error">{errors.images}</small>}
            <div className="img-previews">
              {f.images.map((src, i) => (
                <div
                  className="img-preview"
                  key={i}
                  onClick={() => setLightboxIndex(i)}
                  title="Click to view full image and edit"
                >
                  <img src={src} alt={`Preview ${i + 1}`} />
                  <div className="img-preview-overlay">
                    <Maximize2 size={13} /> Full view
                  </div>
                  {i === 0 && <span className="cover-tag">Cover</span>}
                  <div className="img-preview-controls">
                    {i > 0 && (
                      <button
                        type="button"
                        className="img-remove"
                        style={{ position: 'static' }}
                        title="Move left"
                        onClick={(e) => handleMoveImage(i, -1, e)}
                      >
                        <ArrowLeft size={12} />
                      </button>
                    )}
                    {i < f.images.length - 1 && (
                      <button
                        type="button"
                        className="img-remove"
                        style={{ position: 'static' }}
                        title="Move right"
                        onClick={(e) => handleMoveImage(i, 1, e)}
                      >
                        <ArrowRight size={12} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="img-remove"
                      style={{ position: 'static' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteImage(i);
                      }}
                      aria-label="Remove image"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Floor Plan Images */}
          <div style={{ marginBottom: 24, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <h4 style={{ margin: '0 0 6px 0' }}>Floor Plan Images</h4>
            <p className="muted-text" style={{ margin: '0 0 10px 0', fontSize: 13 }}>
              Up to {MAX_FLOOR_PLANS} floor plan blueprints / layouts (URL or file upload under {MAX_FILE_KB} KB).
            </p>
            <div className="img-add">
              <div className="input-group grow">
                <input value={floorPlanUrlInput} onChange={(e) => setFloorPlanUrlInput(e.target.value)} placeholder="https://”¦/floorplan.jpg" />
                <button type="button" className="btn" onClick={addFloorPlanUrl}><Link2 size={15} /> Add link</button>
              </div>
              <label className="btn"><ImagePlus size={15} /> Upload floor plan<input type="file" accept="image/*" multiple hidden onChange={addFloorPlanFiles} /></label>
            </div>
            {f.floorPlanImages && f.floorPlanImages.length > 0 && (
              <div className="img-previews" style={{ marginTop: 12 }}>
                {f.floorPlanImages.map((src, i) => (
                  <div className="img-preview" key={i}>
                    <img src={src} alt={`Floor Plan ${i + 1}`} />
                    <span className="cover-tag" style={{ background: '#3b82f6' }}>Plan #{i + 1}</span>
                    <button
                      type="button"
                      className="img-remove"
                      onClick={() => handleDeleteFloorPlan(i)}
                      aria-label="Remove floor plan"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Payment Plan Images */}
          <div style={{ marginBottom: 24, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <h4 style={{ margin: '0 0 6px 0' }}>Payment Plan Image</h4>
            <p className="muted-text" style={{ margin: '0 0 10px 0', fontSize: 13 }}>
              Upload milestone schedule or payment plan structure image (URL or file upload under {MAX_FILE_KB} KB).
            </p>
            <div className="img-add">
              <div className="input-group grow">
                <input
                  value={paymentPlanUrlInput}
                  onChange={(e) => setPaymentPlanUrlInput(e.target.value)}
                  placeholder="https://”¦/payment-plan.jpg"
                />
                <button type="button" className="btn" onClick={addPaymentPlanUrl}>
                  <Link2 size={15} /> Add link
                </button>
              </div>
              <label className="btn">
                <ImagePlus size={15} /> Upload payment plan
                <input type="file" accept="image/*" multiple hidden onChange={addPaymentPlanFiles} />
              </label>
            </div>
            {f.paymentPlanImages && f.paymentPlanImages.length > 0 && (
              <div className="img-previews" style={{ marginTop: 12 }}>
                {f.paymentPlanImages.map((src, i) => (
                  <div className="img-preview" key={i}>
                    <img src={src} alt={`Payment Plan ${i + 1}`} />
                    <span className="cover-tag" style={{ background: '#10b981' }}>Plan #{i + 1}</span>
                    <button
                      type="button"
                      className="img-remove"
                      onClick={() => handleDeletePaymentPlan(i)}
                      aria-label="Remove payment plan"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Payment Plan Text Field */}
            <div style={{ marginTop: 16 }}>
              <Field label="Payment Plan Details / Milestones (Text)" isChanged={changed('paymentPlanText')} previousValue={prevVal('paymentPlanText')}>
                <textarea
                  rows={4}
                  value={f.paymentPlanText || ''}
                  onChange={set('paymentPlanText')}
                  placeholder="Enter payment plan milestones or terms... e.g.&#10;• 10% on Booking&#10;• 20% on Agreement&#10;• 40% Construction Linked&#10;• 20% on Flooring & Finishing&#10;• 10% on Possession"
                />
              </Field>
            </div>
          </div>

          {/* Property Video & Brochure Links */}
          <div style={{ paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <div className="form-grid">
              <Field label="Property Video" isChanged={changed('propertyVideo')} previousValue={prevVal('propertyVideo')}>
                <div className="input-icon">
                  <input
                    value={f.propertyVideo}
                    onChange={set('propertyVideo')}
                    placeholder="e.g. https://www.youtube.com/watch?v=... (video link)"
                  />
                  <Film size={16} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                </div>
              </Field>

              <Field label="Property Brochure (PDF)" isChanged={changed('propertyBrochure')} previousValue={prevVal('propertyBrochure')}>
                <div>
                  <label className="btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', opacity: brochureUploading ? 0.6 : 1 }}>
                    <Upload size={15} />
                    {brochureUploading ? 'Uploading”¦' : f.propertyBrochure ? 'Replace Brochure PDF' : 'Upload Brochure PDF'}
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      hidden
                      onChange={handleBrochureUpload}
                      disabled={brochureUploading}
                    />
                  </label>
                  {f.propertyBrochure && (
                    <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
                      <FileText size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {f._brochureFileName || 'Property Brochure.pdf'}
                        </div>
                        <a href={f.propertyBrochure} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}>
                          View / Download PDF â†—
                        </a>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm"
                        style={{ color: '#dc2626', borderColor: '#fca5a5', background: '#fff', flexShrink: 0 }}
                        onClick={() => { setIsDirty(true); setF((s) => ({ ...s, propertyBrochure: '', _brochureFileName: '' })); }}
                      >
                        <X size={14} /> Remove
                      </button>
                    </div>
                  )}
                  <p className="muted-text" style={{ marginTop: 6, fontSize: 12 }}>
                    Upload a PDF file (max 15 MB). The brochure will be available for download on the property detail page.
                  </p>
                </div>
              </Field>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            STATUS & AVAILABILITY
        ══════════════════════════════════════════════════════════════ */}
        <section className="card form-section">
          <h3>Status</h3>
          <div className="form-grid">
            <Field label="Availability" isChanged={changed('status')} previousValue={prevVal('status')}>
              <select value={f.status} onChange={set('status')}>
                {Object.entries(AVAILABILITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </Field>
          </div>
          <p className="muted-text">
            {editing ? 'To approve or reject without editing, use the Property Approvals page.' : 'Properties you add as admin are published immediately.'}
          </p>
        </section>

        <div className="form-actions">
          <Link className="btn" to={isPending ? '/approvals' : '/properties'}>Cancel</Link>
          <button className="btn" disabled={saving}>{saving ? 'Saving”¦' : 'Save changes'}</button>
          {isPending && (
            <button
              type="button"
              className="btn btn-success"
              disabled={saving}
              onClick={handleSaveAndPublish}
            >
              <Check size={16} /> Save, Approve & Publish
            </button>
          )}
        </div>

        <LocationPickerModal
          isOpen={mapModalOpen}
          onClose={() => setMapModalOpen(false)}
          onSelectLocation={handleLocationSelected}
          initialAddress={f.address}
          initialLocality={f.locality}
          initialCity={f.city}
          initialLat={f.lat}
          initialLng={f.lng}
        />

        {lightboxIndex !== null && f.images[lightboxIndex] && (
          <ImageLightboxModal
            images={f.images}
            initialIndex={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
            onReplace={handleReplaceImage}
            onDelete={handleDeleteImage}
            onSetCover={handleSetCover}
          />
        )}
      </form>
    </>
  );
}



