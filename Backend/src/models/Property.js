const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    ownerName: { type: String, default: 'Property Owner' },
    ownerEmail: { type: String, default: '' },
    ownerPhone: { type: String, default: '' },
    phone: { type: String, default: '' },

    title: { type: String, required: true, trim: true },
    location: { type: String, required: true },
    city: { type: String, default: '' },
    locality: { type: String, default: '' },
    address: { type: String, default: '' },
    postalCode: { type: String, default: '' },

    price: { type: String, required: true },
    priceRaw: { type: Number, default: 0 },
    priceNote: { type: String, default: '' },
    perSqft: { type: String, default: '' },
    possession: { type: String, default: 'Ready to Move' },

    buildingType: { type: String, default: 'Residential' },
    listingType: { type: String, default: 'Sell' },
    propertyType: { type: String, default: 'Apartment' },
    userType: { type: String, default: 'Owner' },
    propertyAge: { type: String, default: '' },
    propertyStatus: { type: String, default: '' },

    // Residential specs
    
    unitConfigurations: [
      {
        bhk: { type: String, default: '' },
        area: { type: String, default: '' },
        carpetArea: { type: String, default: '' },
        price: { type: String, default: '' },
        priceNumeric: { type: Number, default: 0 },
        bathrooms: { type: String, default: '' },
        balconies: { type: String, default: '' },
        status: { type: String, default: '' },
      }
    ],
    bedroom: { type: String, default: '' },
    bathroom: { type: String, default: '' },
    balconies: { type: String, default: '' },
    doorFacing: { type: String, default: '' },
    furnishingStatus: { type: String, default: '' },

    // Plot specs
    plotType: { type: String, default: '' },
    plotSize: { type: String, default: '' },
    customPlotSize: { type: String, default: '' },
    roadFacing: { type: String, default: '' },
    plotAge: { type: String, default: '' },
    plotDimension: { type: String, default: '' },
    plotDimensionUnit: { type: String, default: 'sq.ft' },

    // Floor & Charges
    totalFloors: { type: String, default: '' },
    selectedFloor: { type: String, default: '' },
    totalProjectFloors: { type: String, default: '' },
    possessionDate: { type: String, default: '' },
    maintenanceCharge: { type: String, default: '' },
    propertyHighlights: { type: String, default: '' },
    reraNumber: { type: String, default: '' },
    builderName: { type: String, default: '' },

    description: { type: String, default: '' },
    nearbyPlaces: [
      {
        name: { type: String, default: '' },
        category: { type: String, default: 'Others' },
        distance: { type: String, default: '' },
        icon: { type: String, default: 'map-pin' },
      }
    ],
    amenities: [{ type: String }],
    amenitiesText: { type: String, default: '' },
    images: [{ type: String }],
    floorPlanImages: [{ type: String }],
    paymentPlanImages: [{ type: String }],
    paymentPlanImage: { type: String, default: '' },
    paymentPlanText: { type: String, default: '' },
    propertyVideo: { type: String, default: '' },
    propertyBrochure: { type: String, default: '' },
    image: { type: String, default: '' },

    badges: [
      {
        label: String,
        icon: String,
        variant: { type: String, default: 'sage' },
        textColor: String,
      },
    ],
    specs: [
      {
        label: String,
        value: String,
      },
    ],
    secondaryCta: {
      label: { type: String, default: 'Enquire' },
      icon: { type: String, default: 'phone-outline' },
    },
    views: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['active', 'sold', 'rented', 'inactive'],
      default: 'active',
      index: true,
    },
    // Review status:
    // 'pending'        -> New listing from app user, awaiting Admin review
    // 'admin_approved' -> Admin reviewed and verified, awaiting Super Admin final approval
    // 'approved'       -> Super Admin approved, PUBLISHED and LIVE in the app
    // 'rejected'       -> Rejected by either Admin or Super Admin
    approvalStatus: {
      type: String,
      enum: ['pending', 'admin_approved', 'approved', 'rejected'],
      default: 'approved',
      index: true,
    },
    rejectionReason: { type: String, default: '' },
    rejectedBy: { type: String, enum: ['', 'admin', 'super_admin'], default: '' },
    reviewedAt: { type: Date },
    adminApprovedAt: { type: Date },
    adminApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    adminApprovedByName: { type: String, default: '' },
    superAdminApprovedAt: { type: Date },
    superAdminApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    superAdminApprovedByName: { type: String, default: '' },
    editedFields: [{ type: String }],
    previousValues: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    rawFormData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    collection: 'properties',
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id.toString();
        if (!ret.phone && ret.owner && typeof ret.owner === 'object' && ret.owner.phone) {
          ret.phone = ret.owner.phone;
        }
        if (!ret.ownerPhone && ret.owner && typeof ret.owner === 'object' && ret.owner.phone) {
          ret.ownerPhone = ret.owner.phone;
        }
        if (!ret.ownerName && ret.owner && typeof ret.owner === 'object' && ret.owner.name) {
          ret.ownerName = ret.owner.name;
        }
        if (!ret.ownerEmail && ret.owner && typeof ret.owner === 'object' && ret.owner.email) {
          ret.ownerEmail = ret.owner.email;
        }
        delete ret.__v;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model('Property', propertySchema, 'properties');



