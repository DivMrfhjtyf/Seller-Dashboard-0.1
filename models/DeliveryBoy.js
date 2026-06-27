const mongoose = require('mongoose');

const deliveryBoySchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true
  },
  password: {
    type: String,
    required: false
  },
  salt: { type: String },

  // Profile
  profileImage: {
    type: String,
    default: '/imgs/default-delivery.png'
  },
  dateOfBirth: { type: Date },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other'],
    default: 'Male'
  },

  // Address
  address: {
    street: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    pincode: { type: String, default: '' },
    country: { type: String, default: 'India' }
  },

  // Documents
  aadharNumber: { type: String, unique: true, sparse: true },
  licenseNumber: { type: String, unique: true, sparse: true },
  bankAccountNumber: { type: String, default: '' },
  ifscCode: { type: String, default: '' },
  bankAccountHolder: { type: String, default: '' },

  // Vehicle Details
  vehicleType: {
    type: String,
    enum: ['bicycle', 'motorcycle', 'scooter', 'car', 'van'],
    default: 'motorcycle'
  },
  vehicleRegistration: { type: String, default: '' },

  // Status
  status: {
    type: String,
    enum: ['pending', 'verified', 'active', 'inactive', 'suspended'],
    default: 'pending'
  },
  verifiedAt: { type: Date },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },

  // Current Location (Real-time tracking)
  currentLocation: {
    coordinates: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] } // [longitude, latitude]
    },
    address: { type: String, default: '' },
    updatedAt: { type: Date, default: Date.now }
  },

  // Performance Stats
  totalDeliveries: { type: Number, default: 0 },
  successfulDeliveries: { type: Number, default: 0 },
  failedDeliveries: { type: Number, default: 0 },
  averageRating: { type: Number, default: 0, min: 0, max: 5 },
  totalRatings: { type: Number, default: 0 },

  // Earnings
  totalEarnings: { type: Number, default: 0 },
  pendingEarnings: { type: Number, default: 0 },
  deliveryChargePerOrder: { type: Number, default: 50 },

  // Availability
  isAvailable: { type: Boolean, default: false },
  currentAssignments: { type: Number, default: 0 },
  maxAssignmentsPerDay: { type: Number, default: 20 },

  // Soft delete
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date }

}, { timestamps: true });

// Geospatial index for location tracking
deliveryBoySchema.index({ 'currentLocation.coordinates': '2dsphere' });
deliveryBoySchema.index({ email: 1 });
deliveryBoySchema.index({ phone: 1 });
deliveryBoySchema.index({ status: 1 });
deliveryBoySchema.index({ isAvailable: 1 });

// Methods
deliveryBoySchema.methods.updateLocation = async function(latitude, longitude, address) {
  this.currentLocation.coordinates.coordinates = [longitude, latitude];
  this.currentLocation.address = address || '';
  this.currentLocation.updatedAt = new Date();
  await this.save();
};

deliveryBoySchema.methods.recordDelivery = async function(isSuccess, rating = null) {
  this.totalDeliveries += 1;
  if (isSuccess) {
    this.successfulDeliveries += 1;
  } else {
    this.failedDeliveries += 1;
  }
  
  if (rating) {
    this.totalRatings += 1;
    this.averageRating = ((this.averageRating * (this.totalRatings - 1)) + rating) / this.totalRatings;
  }
  
  await this.save();
};

deliveryBoySchema.methods.addEarnings = async function(amount, orderId) {
  this.totalEarnings += amount;
  this.pendingEarnings += amount;
  await this.save();
};

module.exports = mongoose.model('DeliveryBoy', deliveryBoySchema);
