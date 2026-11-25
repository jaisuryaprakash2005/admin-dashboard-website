const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient:      { type: String, default: null, index: true },
    recipientEmail: { type: String, default: '', index: true },
    sender:         { type: String, default: '' },
    senderName:     { type: String, default: 'Interested Buyer' },
    senderEmail:    { type: String, default: '' },
    senderPhone:    { type: String, default: '' },
    property:       { type: String, default: '' },
    propertyId:     { type: String, default: '', index: true },
    propertyTitle:  { type: String, default: 'Property Listing' },
    propertyImage:  { type: String, default: '' },
    type:           { type: String, default: 'enquiry' },
    source:         { type: String, default: 'property_page', index: true },
    subject:        { type: String, default: '' },
    isContactUs:    { type: Boolean, default: false },
    status: {
      type: String,
      enum: [
        'New',
        'Contact Pending',
        'Contacted',
        'Follow-up',
        'In Progress',
        'Converted',
        'Lost',
        'Closed',
      ],
      default: 'New',
      index: true,
    },
    title:          { type: String, required: true },
    message:        { type: String, default: '' },
    read:           { type: Boolean, default: false },
  },
  { collection: 'Notifications', timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema, 'Notifications');


