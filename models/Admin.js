const mongoose = require('mongoose');
const { createHmac, randomBytes } = require('crypto');
const { creatTokenForUser } = require('../services/authentication');

const adminSchema = new mongoose.Schema({
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
  password: {
    type: String,
    required: true
  },
  salt: { type: String },
  profileImage: {
    type: String,
    default: '/imgs/default-admin.png'
  },

  // Admin Role & Permissions
  role: {
    type: String,
    enum: ['SUPER_ADMIN', 'ADMIN', 'MODERATOR'],
    default: 'ADMIN'
  },
  permissions: [{
    type: String,
    enum: [
      'manage_sellers',
      'manage_orders',
      'manage_delivery_boys',
      'manage_products',
      'manage_payments',
      'manage_disputes',
      'view_analytics',
      'manage_admins',
      'manage_refunds'
    ]
  }],

  // Contact
  phoneNumber: { type: String, default: '' },

  // Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  lastLogin: { type: Date },

  // Activity Tracking
  activityLog: [{
    action: String,
    targetType: String, // Order, Seller, DeliveryBoy, etc.
    targetId: mongoose.Schema.Types.ObjectId,
    details: String,
    timestamp: { type: Date, default: Date.now }
  }],

  // Soft delete
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date }

}, { timestamps: true });

adminSchema.index({ email: 1 });
adminSchema.index({ role: 1 });
adminSchema.index({ status: 1 });

// Password hashing
adminSchema.pre('save', async function(next) {
  if (!this.password || !this.isModified('password')) return next();
  try {
    const salt = randomBytes(16).toString('hex');
    this.salt = salt;
    this.password = createHmac('sha256', salt).update(this.password).digest('hex');
    next();
  } catch (error) {
    next(error);
  }
});

// Match password
adminSchema.static('matchPassword', async function(email, password) {
  const admin = await this.findOne({ email: email.toLowerCase() });
  if (!admin) throw new Error('Admin not found');

  const adminProvidedHash = createHmac('sha256', admin.salt).update(password).digest('hex');
  if (admin.password !== adminProvidedHash) throw new Error('Incorrect password');

  return creatTokenForUser(admin);
});

// Log activity
adminSchema.methods.logActivity = async function(action, targetType, targetId, details) {
  this.activityLog.push({
    action,
    targetType,
    targetId,
    details,
    timestamp: new Date()
  });
  await this.save();
};

const Admin = mongoose.models.Admin || mongoose.model('Admin', adminSchema);
module.exports = Admin;
