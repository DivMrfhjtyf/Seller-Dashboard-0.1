const mongoose = require('mongoose');

const deliveryAssignmentSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    unique: true
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true
  },
  deliveryBoy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DeliveryBoy',
    required: true
  },

  // Pickup Details
  pickupLocation: {
    warehouseAddress: { type: String, required: true },
    coordinates: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] }
    },
    pickupTime: { type: Date },
    pickedUpAt: { type: Date }
  },

  // Delivery Details
  deliveryLocation: {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    coordinates: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] }
    }
  },

  // Tracking
  status: {
    type: String,
    enum: ['assigned', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned', 'cancelled'],
    default: 'assigned'
  },

  // Real-time Location Updates
  locationHistory: [{
    coordinates: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] }
    },
    address: { type: String },
    timestamp: { type: Date, default: Date.now },
    status: String
  }],

  // Delivery Proof
  deliveryProof: {
    signature: { type: String },
    photo: { type: String },
    otp: { type: String },
    deliveredAt: { type: Date },
    receivedBy: { type: String }
  },

  // Issues/Failed Delivery
  issue: {
    reason: {
      type: String,
      enum: ['address_incorrect', 'customer_unavailable', 'customer_refused', 'item_damaged', 'weather_delay', 'other']
    },
    description: { type: String },
    photo: { type: String },
    reportedAt: { type: Date }
  },

  // Metrics
  distance: { type: Number, default: 0 }, // in km
  estimatedDeliveryTime: { type: Date },
  actualDeliveryTime: { type: Date },
  deliveryCharges: { type: Number, default: 50 },

  // Ratings
  deliveryBoyRating: { type: Number, min: 1, max: 5 },
  deliveryBoyReview: { type: String },
  customerRating: { type: Number, min: 1, max: 5 },
  customerReview: { type: String },

  // Notes
  notes: { type: String },
  adminNotes: { type: String },

  // Cancellation
  cancelledAt: { type: Date },
  cancelledBy: { type: String, enum: ['admin', 'seller', 'customer', 'delivery_boy'] },
  cancellationReason: { type: String }

}, { timestamps: true });

// Geospatial indexes
deliveryAssignmentSchema.index({ 'deliveryLocation.coordinates': '2dsphere' });
deliveryAssignmentSchema.index({ 'pickupLocation.coordinates': '2dsphere' });
deliveryAssignmentSchema.index({ deliveryBoy: 1, status: 1 });
deliveryAssignmentSchema.index({ order: 1 });
deliveryAssignmentSchema.index({ seller: 1, createdAt: -1 });
deliveryAssignmentSchema.index({ status: 1, createdAt: -1 });

// Methods
deliveryAssignmentSchema.methods.updateLocation = async function(latitude, longitude, address, newStatus) {
  this.locationHistory.push({
    coordinates: {
      type: 'Point',
      coordinates: [longitude, latitude]
    },
    address: address || '',
    timestamp: new Date(),
    status: newStatus || this.status
  });

  if (newStatus) {
    this.status = newStatus;
  }

  await this.save();
};

deliveryAssignmentSchema.methods.markDelivered = async function(proofData) {
  this.status = 'delivered';
  this.deliveryProof = {
    ...proofData,
    deliveredAt: new Date()
  };
  await this.save();
};

deliveryAssignmentSchema.methods.reportIssue = async function(issueData) {
  this.status = 'failed';
  this.issue = {
    ...issueData,
    reportedAt: new Date()
  };
  await this.save();
};

module.exports = mongoose.model('DeliveryAssignment', deliveryAssignmentSchema);
