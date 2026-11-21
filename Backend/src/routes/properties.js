const express = require('express');
const router = express.Router();
const Property = require('../models/Property');
const User = require('../models/User');
const optionalAuth = require('../middleware/optionalAuth');
const requireAuth = require('../middleware/requireAuth');
const { getIsConnected } = require('../config/db');
const { syncUserProperty } = require('../services/userDb');
const attachAdmin = require('../middleware/attachAdmin');

// Public app only sees listings that are not waiting for review or rejected.
// $nin (not equals 'approved') so older documents without the field still match.
const PUBLIC_APPROVAL = { $nin: ['pending', 'admin_approved', 'rejected'] };
const STATUSES = ['active', 'sold', 'rented', 'inactive'];

// In-memory fallback properties
let MEMORY_PROPERTIES = [];

function sanitizeProperty(p) {
  if (!p) return null;
  const obj = p.toObject ? p.toObject() : { ...p };
  if (obj._id) obj.id = obj._id.toString();
  if (obj.owner) {
    if (typeof obj.owner === 'object' && obj.owner._id && (obj.owner.name || obj.owner.email || obj.owner.phone)) {
      const ownerObj = obj.owner.toObject ? obj.owner.toObject() : { ...obj.owner };
      ownerObj.id = obj.owner._id.toString();
      obj.ownerId = obj.owner._id.toString();
      obj.owner = ownerObj;
      if (!obj.phone && ownerObj.phone) {
        obj.phone = ownerObj.phone;
      }
      if (!obj.ownerPhone && ownerObj.phone) {
        obj.ownerPhone = ownerObj.phone;
      }
    } else {
      const idStr = obj.owner.toString();
      obj.ownerId = idStr;
      obj.owner = idStr;
    }
  }
  if (!obj.phone && obj.rawFormData?.phone) {
    obj.phone = obj.rawFormData.phone;
  }
  if (!obj.ownerPhone && obj.rawFormData?.phone) {
    obj.ownerPhone = obj.rawFormData.phone;
  }
  delete obj.__v;
  return obj;
}

// ─── GET /api/properties (All public properties for Home / Search) ─────────────
router.get('/', async (req, res) => {
  try {
    const { city, locality, propertyType, listingType } = req.query;

    if (getIsConnected()) {
      const filter = { status: 'active', approvalStatus: PUBLIC_APPROVAL };
      if (city) filter.city = new RegExp(`^${city}$`, 'i');
      if (locality) filter.locality = new RegExp(locality, 'i');
      if (propertyType) filter.propertyType = new RegExp(`^${propertyType}$`, 'i');
      if (listingType) filter.listingType = new RegExp(`^${listingType}$`, 'i');

      const properties = await Property.find(filter)
        .sort({ createdAt: -1 })
        .populate('owner', 'name email photo phone');

      return res.json({
        success: true,
        count: properties.length,
        results: properties.map(sanitizeProperty),
      });
    }

    // In-memory fallback
    let list = [...MEMORY_PROPERTIES];
    if (city) list = list.filter((p) => p.city?.toLowerCase() === city.toLowerCase());
    if (locality) list = list.filter((p) => p.locality?.toLowerCase().includes(locality.toLowerCase()));
    if (propertyType) list = list.filter((p) => p.propertyType?.toLowerCase() === propertyType.toLowerCase());

    return res.json({
      success: true,
      count: list.length,
      results: list.map(sanitizeProperty),
    });
  } catch (err) {
    console.error('💥 ERROR IN POST /api/properties:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/properties/my-listings (Current user's listings only) ─────────
router.get('/my-listings', optionalAuth, async (req, res) => {
  try {
    const userId = req.userId;

    // Unauthenticated / guest users have no server-stored user listings
    if (!userId) {
      return res.json({
        success: true,
        count: 0,
        results: [],
      });
    }

    if (getIsConnected()) {
      const properties = await Property.find({ owner: userId }).sort({ createdAt: -1 });

      return res.json({
        success: true,
        count: properties.length,
        results: properties.map(sanitizeProperty),
      });
    }

    // In-memory fallback
    const list = MEMORY_PROPERTIES.filter((p) => String(p.owner) === String(userId));

    return res.json({
      success: true,
      count: list.length,
      results: list.map(sanitizeProperty),
    });
  } catch (err) {
    console.error('💥 ERROR IN POST /api/properties:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/properties/city-counts (Count of properties by city) ────────────
router.get('/city-counts', async (req, res) => {
  try {
    if (getIsConnected()) {
      const counts = await Property.aggregate([
        { $match: { status: 'active', approvalStatus: PUBLIC_APPROVAL } },
        {
          $group: {
            _id: { $toLower: { $trim: { input: '$city' } } },
            cityName: { $first: '$city' },
            count: { $sum: 1 },
          },
        },
      ]);

      const result = {};
      counts.forEach((c) => {
        if (c.cityName) {
          result[c.cityName.trim()] = c.count;
          result[c.cityName.toLowerCase().trim()] = c.count;
        }
      });

      return res.json({
        success: true,
        counts: result,
      });
    }

    // In-memory fallback
    const result = {};
    MEMORY_PROPERTIES.forEach((p) => {
      if (p.city && p.status === 'active') {
        const c = p.city.trim();
        result[c] = (result[c] || 0) + 1;
        result[c.toLowerCase()] = (result[c.toLowerCase()] || 0) + 1;
      }
    });

    return res.json({
      success: true,
      counts: result,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/properties/category-counts (Count of properties by category) ────
router.get('/category-counts', async (req, res) => {
  try {
    let properties = [];
    if (getIsConnected()) {
      properties = await Property.find({ status: 'active', approvalStatus: PUBLIC_APPROVAL }, 'propertyType buildingType propertyStatus userType');
    } else {
      properties = MEMORY_PROPERTIES.filter((p) => p.status === 'active');
    }

    const counts = {
      apartments: 0,
      villas: 0,
      commercial: 0,
      plots: 0,
      builder: 0,
    };

    properties.forEach((p) => {
      const pType = (p.propertyType || '').toLowerCase().trim();
      const bType = (p.buildingType || '').toLowerCase().trim();
      const status = (p.propertyStatus || '').toLowerCase().trim();
      const uType = (p.userType || '').toLowerCase().trim();

      // Commercial: buildingType is Commercial OR propertyType is Commercial/Office
      if (bType === 'commercial' || pType === 'commercial' || pType === 'office' || pType === 'retail' || pType === 'shop') {
        counts.commercial++;
      }

      // Apartments: propertyType is Apartment/Flat AND buildingType is not Commercial
      if ((pType === 'apartment' || pType === 'flat') && bType !== 'commercial') {
        counts.apartments++;
      }

      // Villas: propertyType is Villa or Independent House AND buildingType is not Commercial
      if ((pType === 'villa' || pType === 'independent house' || pType === 'house' || pType === 'independent') && bType !== 'commercial') {
        counts.villas++;
      }

      // Plots: propertyType is Plot or Land
      if (pType === 'plot' || pType === 'land' || p.plotType) {
        counts.plots++;
      }

      // Builder Projects: builder user type, project type, or Under Construction / Upcoming status
      if (
        uType === 'builder' ||
        pType.includes('builder') ||
        pType.includes('project') ||
        bType.includes('project') ||
        status === 'under construction' ||
        status === 'upcoming' ||
        status === 'new landing'
      ) {
        counts.builder++;
      }
    });

    return res.json({ success: true, counts });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/properties/:id (Single property details) ─────────────────────────
// ─── GET /api/properties/builder-counts ─────────────────────────────────────────
router.get('/builder-counts', async (req, res) => {
  try {
    let properties = [];
    if (getIsConnected()) {
      properties = await Property.find({}, 'builderName rawFormData title description status approvalStatus');
    } else {
      properties = MEMORY_PROPERTIES;
    }

    const counts = {};

    properties.forEach((p) => {
      const b = (p.builderName || p.rawFormData?.builderName || '').trim();
      if (b) {
        counts[b] = (counts[b] || 0) + 1;
        counts[b.toLowerCase()] = (counts[b.toLowerCase()] || 0) + 1;
      }
    });

    const KNOWN_BUILDERS = [
      'Brigade Group', 'Puravankara Limited', 'Godrej Properties', 'Shriram Properties',
      'Mahindra Lifespace', 'Provident Housing', 'Prestige Group', 'Tata Value Homes',
      'TVS Emerald', 'Alliance Group', 'XS Real Properties', 'Hiranandani Communities',
      'Lancor Holdings', 'Navins Housing', 'Urbanrise', 'Pacifica Companies',
      'KG Builders', 'Urban Tree Infrastructures', 'Voora Property', 'S&P Foundation',
      'The Nest Builders', 'Nature Residences Development', 'Lakshmi Construction'
    ];

    KNOWN_BUILDERS.forEach((builderFullName) => {
      const bLower = builderFullName.toLowerCase();
      const brandWord = builderFullName.split(' ')[0].toLowerCase();

      let matchCount = 0;
      properties.forEach((p) => {
        const pb = (p.builderName || p.rawFormData?.builderName || '').trim().toLowerCase();
        const pt = (p.title || '').trim().toLowerCase();

        if (pb) {
          if (pb === bLower || pb.includes(bLower) || bLower.includes(pb)) {
            matchCount++;
            return;
          }
          if (brandWord.length >= 4 && pb.includes(brandWord)) {
            matchCount++;
            return;
          }
        }
        if (brandWord.length >= 4 && pt.includes(brandWord)) {
          matchCount++;
          return;
        }
      });

      if (matchCount > (counts[builderFullName] || 0)) {
        counts[builderFullName] = matchCount;
        counts[bLower] = matchCount;
      }
    });

    res.json({ success: true, counts, totalProperties: properties.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', optionalAuth, attachAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (getIsConnected()) {
      const property = await Property.findById(id).populate('owner', 'name email photo phone');
      if (!property) {
        return res.status(404).json({ success: false, message: 'Property not found' });
      }
      // Pending / rejected listings are visible only to their owner and to admins
      if (['pending', 'admin_approved', 'rejected'].includes(property.approvalStatus)) {
        const ownerId = String(property.owner?._id || property.owner || '');
        if (!req.isAdmin && (!req.userId || ownerId !== String(req.userId))) {
          return res.status(404).json({ success: false, message: 'Property not found' });
        }
      }
      return res.json({ success: true, result: sanitizeProperty(property) });
    }

    const prop = MEMORY_PROPERTIES.find((p) => String(p.id) === String(id) || String(p._id) === String(id));
    if (!prop) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }
    return res.json({ success: true, result: sanitizeProperty(prop) });
  } catch (err) {
    console.error('💥 ERROR IN POST /api/properties:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

function parseAndFormatPrice(price, priceRaw, priceUnit) {
  let formattedPrice = price || 'Price on Request';
  let numericPrice = typeof priceRaw === 'number' && priceRaw > 0 ? priceRaw : 0;
  const strPrice = String(price || '').trim();

  if (/cr/i.test(strPrice) || priceUnit === 'Cr') {
    const pNum = parseFloat(strPrice.replace(/[^0-9.]/g, '')) || 0;
    formattedPrice = `₹ ${pNum} Cr`;
    if (!numericPrice) numericPrice = Math.round(pNum * 10000000);
  } else if (/lac|lakh/i.test(strPrice) || priceUnit === 'Lac') {
    const pNum = parseFloat(strPrice.replace(/[^0-9.]/g, '')) || 0;
    formattedPrice = `₹ ${pNum} Lac`;
    if (!numericPrice) numericPrice = Math.round(pNum * 100000);
  } else if (strPrice) {
    const rawNum = strPrice.replace(/[^0-9.]/g, '');
    const parsed = parseFloat(rawNum) || 0;
    if (!numericPrice) numericPrice = parsed;
    if (numericPrice >= 10000000) {
      formattedPrice = `₹ ${(numericPrice / 10000000).toFixed(2).replace(/\.00$/, '')} Cr`;
    } else if (numericPrice >= 100000) {
      formattedPrice = `₹ ${(numericPrice / 100000).toFixed(2).replace(/\.00$/, '')} Lac`;
    } else if (numericPrice > 0) {
      formattedPrice = `₹ ${numericPrice.toLocaleString('en-IN')}`;
    }
  }

  return { formattedPrice, numericPrice };
}

// ─── POST /api/properties (Create new property) ───────────────────────────────
router.post('/', optionalAuth, attachAdmin, async (req, res) => {
  try {
    const raw = req.body && req.body.rawFormData ? { ...req.body.rawFormData, ...req.body } : (req.body || {});
    const data = raw;
    if (!data.title && !data.propertyName) {
      return res.status(400).json({ success: false, message: 'Property name / title is required' });
    }

    // Compulsory condition: Phone number must be verified to list a property
    let userPhone = '';
    if (req.userId && !req.isAdmin && getIsConnected()) {
      const u = await User.findById(req.userId).catch(() => null);
      if (u && !u.phoneVerified) {
        return res.status(403).json({
          success: false,
          phoneVerificationRequired: true,
          message: 'Phone number verification is compulsory to list a property. Please verify your phone number via OTP.',
        });
      }
      userPhone = u?.phone || '';
    }

    const title = data.title || data.propertyName;
    const locArr = [data.locality, data.city].filter(Boolean);
    const location = data.location || (locArr.length > 0 ? locArr.join(', ') : 'Tamil Nadu, India');

    // Format price with unit (Lac, Cr, etc.)
    const { formattedPrice, numericPrice } = parseAndFormatPrice(data.price, data.priceRaw, data.priceUnit);

    // Images & Cover image
    let images = [];
    if (Array.isArray(data.images) && data.images.length > 0) {
      images = data.images.map((img) => (typeof img === 'string' ? img : img?.uri)).filter(Boolean);
    }
    let coverImage = data.image || (images.length > 0 ? images[0] : '');
    if (!coverImage) {
      coverImage = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80';
    }
    if (images.length === 0) {
      images = [coverImage];
    }

    // Badges
    const badges = Array.isArray(data.badges) && data.badges.length > 0
      ? data.badges
      : [
          { label: data.propertyType || 'Residential', variant: 'sage', textColor: '#153c35', icon: 'home-variant' },
          { label: data.listingType ? `For ${data.listingType}` : 'For Sale', variant: 'white', textColor: '#2d1e00', icon: 'shield-check' },
        ];

    // Specs
    let specs = Array.isArray(data.specs) && data.specs.length > 0 ? data.specs : [];
    if (specs.length === 0) {
      if (data.propertyType === 'Plot') {
        const pSize = data.plotSize === 'Other' ? (data.customPlotSize || 'Custom') : (data.plotSize || 'Standard');
        specs = [
          { label: 'Plot Type', value: data.plotType || 'Residential' },
          { label: 'Plot Size', value: pSize },
          { label: 'Facing', value: data.roadFacing || 'North' },
          { label: 'Dimension', value: data.plotDimension ? `${data.plotDimension} ${data.plotDimensionUnit || 'ft'}` : (data.plotAge || 'New') },
        ];
      } else {
        specs = [
          { label: 'BHK', value: data.bedroom || '2 BHK' },
          { label: 'Baths', value: data.bathroom ? `${data.bathroom} Baths` : '2 Baths' },
          { label: 'Facing', value: data.doorFacing || 'East' },
          { label: 'Furnishing', value: data.furnishingStatus || 'Unfurnished' },
        ];
      }
    }

    let ownerName = data.ownerName || 'Property Owner';
    let ownerEmail = data.ownerEmail || '';
    if (req.userId && !req.isAdmin && getIsConnected()) {
      try {
        const u = await User.findById(req.userId);
        if (u) {
          ownerName = u.name || ownerName;
          ownerEmail = u.email || ownerEmail;
        }
      } catch {}
    }

    const customPlotVal = data.customPlotSize ? String(data.customPlotSize).trim() : '';
    const resolvedPlotSize = (data.propertyType === 'Plot' && data.plotSize === 'Other' && customPlotVal)
      ? customPlotVal
      : data.plotSize;

    const newPropertyData = {
      owner: data.owner || (req.isAdmin ? null : (req.userId || null)),
      ownerName,
      ownerEmail,
      phone: userPhone || data.phone || data.contactPhone || '',
      ownerPhone: userPhone || data.ownerPhone || data.phone || data.contactPhone || '',
      phoneVerified: true,
      title,
      location,
      city: data.city || '',
      locality: data.locality || '',
      address: data.address || '',
      postalCode: data.postalCode || '',
      lat: data.lat !== undefined && data.lat !== null ? Number(data.lat) : null,
      lng: data.lng !== undefined && data.lng !== null ? Number(data.lng) : null,
      price: formattedPrice,
      priceRaw: numericPrice,
      priceNote: data.priceNote || (data.maintenanceCharge ? `+ Maint. ₹${data.maintenanceCharge}/mo` : 'Zero Brokerage'),
      perSqft: data.perSqft || (resolvedPlotSize ? `${resolvedPlotSize} Plot` : (data.plotSize ? `${data.plotSize} Plot` : 'Verified Listing')),
      possession: data.possession || (data.propertyType === 'Plot' ? 'Ready for Construction' : 'Ready to Move'),
      buildingType: data.buildingType || 'Residential',
      listingType: data.listingType || 'Sell',
      propertyType: data.propertyType || 'Apartment',
      userType: data.userType || 'Owner',
      builderName: data.builderName || '',
      propertyAge: data.propertyAge || '',
      propertyStatus: data.propertyStatus || '',

      bedroom: data.bedroom || '',
      bathroom: data.bathroom || '',
      balconies: data.balconies || '',
      doorFacing: data.doorFacing || '',
      furnishingStatus: data.furnishingStatus || '',
      superBuiltUpArea: data.superBuiltUpArea || '',
      carpetArea: data.carpetArea || '',
      unitConfigurations: Array.isArray(data.unitConfigurations) ? data.unitConfigurations : [],
      nearbyPlaces: Array.isArray(data.nearbyPlaces) ? data.nearbyPlaces : [],
      paymentPlanText: data.paymentPlanText || '',

      plotType: data.plotType || '',
      plotSize: resolvedPlotSize || data.plotSize || '',
      customPlotSize: customPlotVal || data.customPlotSize || '',
      roadFacing: data.roadFacing || '',
      plotAge: data.plotAge || '',
      plotDimension: data.plotDimension || '',
      plotDimensionUnit: data.plotDimensionUnit || 'sq.ft',

      totalFloors: data.totalFloors || '',
      selectedFloor: data.selectedFloor || '',
      totalProjectFloors: data.totalProjectFloors || '',
      possessionDate: data.possessionDate || '',
      maintenanceCharge: data.maintenanceCharge || '',
      propertyHighlights: data.propertyHighlights || '',
      reraNumber: data.reraNumber || '',

      description: data.description || '',
      amenities: Array.isArray(data.amenities) ? data.amenities : [],
      amenitiesText: data.amenitiesText || '',
      images,
      floorPlanImages: Array.isArray(data.floorPlanImages) ? data.floorPlanImages : [],
      paymentPlanImages: Array.isArray(data.paymentPlanImages) ? data.paymentPlanImages : (data.paymentPlanImage ? [data.paymentPlanImage] : []),
      paymentPlanImage: data.paymentPlanImage || (Array.isArray(data.paymentPlanImages) && data.paymentPlanImages[0]) || '',
      propertyVideo: data.propertyVideo || '',
      propertyBrochure: data.propertyBrochure || '',
      image: coverImage,
      badges,
      specs,
      secondaryCta: data.secondaryCta || { label: 'Enquire', icon: 'phone-outline' },
      // Listings from app users wait for admin approval. Listings created by an admin are marked admin_approved and wait for super admin.
      status: req.isAdmin && STATUSES.includes(data.status) ? data.status : 'active',
      approvalStatus: req.isAdmin ? 'admin_approved' : 'pending',
      rawFormData: req.body.rawFormData || data,
    };

    // 1. MongoDB Mode
    if (getIsConnected()) {
      const created = await Property.create(newPropertyData);
      console.log(`[MongoDB] Property created in 'properties' collection: ${created._id} ("${created.title}")`);

      // Sync into user's dedicated database "properties" collection
      if (req.userId && !req.isAdmin) {
        syncUserProperty(req.userId, created, 'create').catch(() => {});
      }

      return res.status(201).json({
        success: true,
        pendingApproval: !req.isAdmin,
        message: 'Property created in MongoDB successfully',
        result: sanitizeProperty(created),
      });
    }

    // 2. In-Memory Fallback
    const memItem = {
      ...newPropertyData,
      id: `prop_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    MEMORY_PROPERTIES.unshift(memItem);

    return res.status(201).json({
      success: true,
      message: 'Property created successfully',
      result: sanitizeProperty(memItem),
    });
  } catch (err) {
    console.error('💥 ERROR IN POST /api/properties:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PATCH /api/properties/:id (Update listing) ──────────────────────────────
router.patch('/:id', requireAuth, attachAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const raw = req.body && req.body.rawFormData ? { ...req.body.rawFormData, ...req.body } : (req.body || {});
    const data = raw;

    if (getIsConnected()) {
      const prop = await Property.findById(id);
      if (!prop) {
        return res.status(404).json({ success: false, message: 'Property not found' });
      }

      if (!req.isAdmin && (!prop.owner || String(prop.owner) !== String(req.userId))) {
        return res.status(403).json({ success: false, message: 'Not authorized to edit this property' });
      }

      // Preserve original property title / name
      const rawPropName = req.body?.rawFormData?.propertyName || data.propertyName;
      const title = (data.title && typeof data.title === 'string' && data.title.trim())
        || (rawPropName && typeof rawPropName === 'string' && rawPropName.trim())
        || prop.title;
      const city = data.city !== undefined ? data.city : prop.city;
      const locality = data.locality !== undefined ? data.locality : prop.locality;
      const locArr = [locality, city].filter(Boolean);
      const location = data.location || (locArr.length > 0 ? locArr.join(', ') : prop.location);

      let formattedPrice = prop.price;
      let numericPrice = prop.priceRaw;
      if (data.price !== undefined) {
        const parsed = parseAndFormatPrice(data.price, data.priceRaw, data.priceUnit);
        formattedPrice = parsed.formattedPrice;
        numericPrice = parsed.numericPrice;
      }

      let images = prop.images;
      if (Array.isArray(data.images) && data.images.length > 0) {
        images = data.images.map((img) => (typeof img === 'string' ? img : img?.uri)).filter(Boolean);
      }
      let coverImage = data.image || (images.length > 0 ? images[0] : prop.image);

      let specs = Array.isArray(data.specs) && data.specs.length > 0 ? data.specs : [];
      if (specs.length === 0) {
        const pType = data.propertyType || prop.propertyType;
        if (pType === 'Plot') {
          const pSize = (data.plotSize || prop.plotSize) === 'Other'
            ? (data.customPlotSize || prop.customPlotSize || 'Custom')
            : (data.plotSize || prop.plotSize || 'Standard');
          specs = [
            { label: 'Plot Type', value: data.plotType || prop.plotType || 'Residential' },
            { label: 'Plot Size', value: pSize },
            { label: 'Facing', value: data.roadFacing || prop.roadFacing || 'North' },
            { label: 'Dimension', value: data.plotDimension ? `${data.plotDimension} ${data.plotDimensionUnit || 'ft'}` : (data.plotAge || prop.plotAge || 'New') },
          ];
        } else {
          specs = [
            { label: 'BHK', value: data.bedroom || prop.bedroom || '2 BHK' },
            { label: 'Baths', value: data.bathroom ? `${data.bathroom} Baths` : (prop.bathroom ? `${prop.bathroom} Baths` : '2 Baths') },
            { label: 'Facing', value: data.doorFacing || prop.doorFacing || 'East' },
            { label: 'Furnishing', value: data.furnishingStatus || prop.furnishingStatus || 'Unfurnished' },
          ];
        }
      }

      const updates = {
        title,
        location,
        city,
        locality,
        address: data.address !== undefined ? data.address : prop.address,
        postalCode: data.postalCode !== undefined ? data.postalCode : prop.postalCode,
        lat: data.lat !== undefined ? (data.lat !== null ? Number(data.lat) : null) : prop.lat,
        lng: data.lng !== undefined ? (data.lng !== null ? Number(data.lng) : null) : prop.lng,
        price: formattedPrice,
        priceRaw: numericPrice,
        priceNote: data.priceNote || (data.maintenanceCharge ? `+ Maint. ₹${data.maintenanceCharge}/mo` : prop.priceNote),
        perSqft: data.perSqft || (data.plotSize ? `${data.plotSize} Plot` : prop.perSqft),
        possession: data.possession || prop.possession,
        buildingType: data.buildingType || prop.buildingType,
        listingType: data.listingType || prop.listingType,
        propertyType: data.propertyType || prop.propertyType,
        userType: data.userType || prop.userType,
        builderName: data.builderName !== undefined ? data.builderName : prop.builderName,
        propertyAge: data.propertyAge !== undefined ? data.propertyAge : prop.propertyAge,
        propertyStatus: data.propertyStatus !== undefined ? data.propertyStatus : prop.propertyStatus,
        bedroom: data.bedroom !== undefined ? data.bedroom : prop.bedroom,
        bathroom: data.bathroom !== undefined ? data.bathroom : prop.bathroom,
        balconies: data.balconies !== undefined ? data.balconies : prop.balconies,
        doorFacing: data.doorFacing !== undefined ? data.doorFacing : prop.doorFacing,
        furnishingStatus: data.furnishingStatus !== undefined ? data.furnishingStatus : prop.furnishingStatus,
        superBuiltUpArea: data.superBuiltUpArea !== undefined ? data.superBuiltUpArea : (prop.superBuiltUpArea || ''),
        carpetArea: data.carpetArea !== undefined ? data.carpetArea : (prop.carpetArea || ''),
        unitConfigurations: Array.isArray(data.unitConfigurations) ? data.unitConfigurations : (prop.unitConfigurations || []),
        nearbyPlaces: Array.isArray(data.nearbyPlaces) ? data.nearbyPlaces : (prop.nearbyPlaces || []),
        paymentPlanText: data.paymentPlanText !== undefined ? data.paymentPlanText : (prop.paymentPlanText || ''),
        plotType: data.plotType !== undefined ? data.plotType : prop.plotType,
        plotSize: data.plotSize !== undefined ? data.plotSize : prop.plotSize,
        customPlotSize: data.customPlotSize !== undefined ? data.customPlotSize : prop.customPlotSize,
        roadFacing: data.roadFacing !== undefined ? data.roadFacing : prop.roadFacing,
        plotAge: data.plotAge !== undefined ? data.plotAge : prop.plotAge,
        plotDimension: data.plotDimension !== undefined ? data.plotDimension : prop.plotDimension,
        plotDimensionUnit: data.plotDimensionUnit !== undefined ? data.plotDimensionUnit : prop.plotDimensionUnit,
        totalFloors: data.totalFloors !== undefined ? data.totalFloors : prop.totalFloors,
        selectedFloor: data.selectedFloor !== undefined ? data.selectedFloor : prop.selectedFloor,
        totalProjectFloors: data.totalProjectFloors !== undefined ? data.totalProjectFloors : prop.totalProjectFloors,
        possessionDate: data.possessionDate !== undefined ? data.possessionDate : prop.possessionDate,
        maintenanceCharge: data.maintenanceCharge !== undefined ? data.maintenanceCharge : prop.maintenanceCharge,
        propertyHighlights: data.propertyHighlights !== undefined ? data.propertyHighlights : prop.propertyHighlights,
        reraNumber: data.reraNumber !== undefined ? data.reraNumber : prop.reraNumber,
        floorPlanImages: Array.isArray(data.floorPlanImages) ? data.floorPlanImages : prop.floorPlanImages,
        paymentPlanImages: Array.isArray(data.paymentPlanImages) ? data.paymentPlanImages : (data.paymentPlanImage ? [data.paymentPlanImage] : (prop.paymentPlanImages || [])),
        paymentPlanImage: data.paymentPlanImage !== undefined ? data.paymentPlanImage : (Array.isArray(data.paymentPlanImages) && data.paymentPlanImages[0] ? data.paymentPlanImages[0] : (prop.paymentPlanImage || '')),
        propertyVideo: data.propertyVideo !== undefined ? data.propertyVideo : prop.propertyVideo,
        propertyBrochure: data.propertyBrochure !== undefined ? data.propertyBrochure : prop.propertyBrochure,
        description: data.description !== undefined ? data.description : prop.description,
        amenities: Array.isArray(data.amenities) ? data.amenities : prop.amenities,
        amenitiesText: data.amenitiesText !== undefined ? data.amenitiesText : (prop.amenitiesText || ''),
        images,
        image: coverImage,
        specs,
        rawFormData: req.body.rawFormData || data,
        ...(req.isAdmin
          ? {
              status: STATUSES.includes(data.status) ? data.status : prop.status,
              ...(data.owner !== undefined ? { owner: data.owner || null } : {}),
              ownerName: data.ownerName !== undefined ? data.ownerName : prop.ownerName,
              ownerEmail: data.ownerEmail !== undefined ? data.ownerEmail : prop.ownerEmail,
              ownerPhone: data.ownerPhone !== undefined ? data.ownerPhone : (data.phone !== undefined ? data.phone : prop.ownerPhone),
              phone: data.phone !== undefined ? data.phone : (data.ownerPhone !== undefined ? data.ownerPhone : prop.phone),
            }
          : // An owner's edit goes back to review so approved listings can't be swapped for something else.
            // Delete this line if you do not want re-approval after owner edits.
            { approvalStatus: 'pending', rejectionReason: '' }),
      };

      const updated = await Property.findByIdAndUpdate(id, { $set: updates }, { new: true }).populate('owner', 'name email photo phone');
      const ownerId = req.isAdmin ? prop.owner : (req.userId || prop.owner);
      if (ownerId) {
        syncUserProperty(ownerId, updated, 'create').catch(() => {});
      }

      return res.json({
        success: true,
        message: 'Property updated successfully',
        result: sanitizeProperty(updated),
      });
    }

    // In-Memory Fallback
    const idx = MEMORY_PROPERTIES.findIndex((p) => String(p.id) === String(id) || String(p._id) === String(id));
    if (idx === -1) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }
    const existing = MEMORY_PROPERTIES[idx];
    const updatedMem = { ...existing, ...data, rawFormData: req.body.rawFormData || data };
    MEMORY_PROPERTIES[idx] = updatedMem;
    return res.json({ success: true, message: 'Property updated', result: sanitizeProperty(updatedMem) });
  } catch (err) {
    console.error('💥 ERROR IN PATCH /api/properties/:id:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── DELETE /api/properties/:id (Delete listing) ──────────────────────────────
router.delete('/:id', requireAuth, attachAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (getIsConnected()) {
      const prop = await Property.findById(id);
      if (!prop) {
        return res.status(404).json({ success: false, message: 'Property not found' });
      }

      // Only the owner or an admin may delete
      if (!req.isAdmin && (!prop.owner || String(prop.owner) !== String(req.userId))) {
        return res.status(403).json({ success: false, message: 'Not authorized to delete this property' });
      }

      const ownerId = req.isAdmin ? prop.owner : (req.userId || prop.owner);
      await Property.findByIdAndDelete(id);
      if (ownerId) {
        syncUserProperty(ownerId, { id }, 'delete').catch(() => {});
      }
      return res.json({ success: true, message: 'Property deleted from MongoDB' });
    }

    // In-Memory Fallback
    const idx = MEMORY_PROPERTIES.findIndex((p) => String(p.id) === String(id) || String(p._id) === String(id));
    if (idx === -1) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }
    MEMORY_PROPERTIES.splice(idx, 1);
    return res.json({ success: true, message: 'Property deleted' });
  } catch (err) {
    console.error('💥 ERROR IN POST /api/properties:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

