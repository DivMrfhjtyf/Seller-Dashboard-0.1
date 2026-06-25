const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productTitle: { type: String, required: true },
  productImage: { type: String },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true }, // Price at time of order
  total: { type: Number, required: true }
}, { _id: false });

const addressSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  phone: { type: String, required: true },
  street: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  pincode: { type: String, required: true },
  country: { type: String, default: 'India' }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  // Order identification
  orderNumber: { 
    type: String, 
    unique: true,
    required: true 
  },

  // Customer info
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // or 'Seller' if sellers can also buy
    required: true
  },
  customerName: { type: String, required: true },
  customerEmail: { type: String, required: true },
  customerPhone: { type: String },

  // Seller info (who owns the products)
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true
  },
  sellerBusinessName: { type: String },

  // Order items
  items: [orderItemSchema],

  // Pricing
  subtotal: { type: Number, required: true },
  shippingCost: { type: Number, default: 0 },
  taxAmount: { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },

  // Shipping address
  shippingAddress: addressSchema,

  // Order status
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned', 'refunded'],
    default: 'pending'
  },

  // Payment
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['cod', 'online', 'upi', 'card', 'wallet'],
    default: 'cod'
  },

  // Tracking
  trackingNumber: { type: String },
  trackingUrl: { type: String },
  courierName: { type: String },

  // Timestamps for status changes
  statusHistory: [{
    status: { type: String },
    note: { type: String },
    updatedAt: { type: Date, default: Date.now },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller' }
  }],

  // Notes
  sellerNote: { type: String },
  customerNote: { type: String },

  // Delivery estimate
  estimatedDelivery: { type: Date },
  deliveredAt: { type: Date },

  // Cancellation
  cancelledAt: { type: Date },
  cancelReason: { type: String },

  // Refund
  refundedAt: { type: Date },
  refundAmount: { type: Number },
  refundReason: { type: String }

}, { timestamps: true });

// Generate order number before saving
orderSchema.pre('save', async function(next) {
  if (!this.orderNumber) {
    const date = new Date();
    const prefix = 'ORD';
    const random = Math.floor(1000 + Math.random() * 9000);
    this.orderNumber = `${prefix}${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}-${random}`;
  }
  next();
});

// Index for faster queries
orderSchema.index({ seller: 1, status: 1, createdAt: -1 });
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ customer: 1, createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
