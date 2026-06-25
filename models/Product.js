const mongoose = require('mongoose');

// Size configuration with measurements
const sizeSchema = new mongoose.Schema({
  size: {
    type: String,
    enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', 'Free Size'],
    required: true
  },
  chest: { type: String, default: '' },      // e.g., "38 inches"
  length: { type: String, default: '' },     // e.g., "28 inches"
  shoulder: { type: String, default: '' },   // e.g., "16 inches"
  sleeve: { type: String, default: '' },     // e.g., "24 inches"
  waist: { type: String, default: '' },      // for bottoms
  hip: { type: String, default: '' },        // for bottoms
  stock: { type: Number, default: 0, min: 0 },
  sku: { type: String, default: '' },
  price: { type: Number, default: 0 },       // override price per size if needed
  isAvailable: { type: Boolean, default: true }
}, { _id: true });

// Color variant with images
const colorVariantSchema = new mongoose.Schema({
  colorName: { type: String, required: true },    // e.g., "Navy Blue"
  colorCode: { type: String, default: '' },     // hex code e.g., "#1a237e"
  images: [{ type: String, required: true }],    // array of image URLs
  video: { type: String, default: '' },         // video URL
  sizes: [sizeSchema]
}, { _id: true });

// Review sub-document
const reviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String, maxlength: 1000 },
  images: [{ type: String }],
  createdAt: { type: Date, default: Date.now }
});

const productSchema = new mongoose.Schema({
  // ─── Basic Info ───
  title: {
    type: String,
    required: [true, 'Product title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: [5000, 'Description cannot exceed 5000 characters']
  },
  shortDescription: {
    type: String,
    maxlength: [300, 'Short description cannot exceed 300 characters']
  },

  // ─── Product Type ───
  productType: {
    type: String,
    required: true,
    enum: ['Men', 'Women', 'Kids', 'Boys', 'Girls', 'Unisex'],
    index: true
  },

  // ─── Category & Subcategory ───
  category: {
    type: String,
    required: true,
    enum: [
      'T-Shirt', 'Shirt', 'Kurta', 'Jeans', 'Trousers', 'Shorts',
      'Ethnic Wear', 'Western Wear', 'Sportswear', 'Innerwear',
      'Footwear', 'Accessories', 'Watches', 'Bags', 'Jewelry',
      'Saree', 'Lehenga', 'Dress', 'Jacket', 'Hoodie', 'Sweater',
      'Blazer', 'Suit', 'Co-ord Set', 'Nightwear', 'Swimwear',
      'Pet', 'Other'
    ]
  },
  subCategory: {
    type: String,
    default: ''
  },

  // ─── Pricing ───
  basePrice: {
    type: Number,
    required: [true, 'Base price is required'],
    min: [0, 'Price cannot be negative']
  },
  sellingPrice: {
    type: Number,
    required: [true, 'Selling price is required'],
    min: [0, 'Selling price cannot be negative']
  },
  discountPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 99
  },
  discountAmount: {
    type: Number,
    default: 0
  },

  // ─── GST / Tax ───
  gstRate: {
    type: Number,
    default: 5,  // Default 5%
    enum: [0, 5, 12, 18, 28]
  },
  gstAmount: { type: Number, default: 0 },
  priceInclusiveOfGST: { type: Boolean, default: true },

  // ─── Quantity & Stock ───
  totalStock: { type: Number, default: 0 },
  stockStatus: {
    type: String,
    enum: ['In Stock', 'Low Stock', 'Out of Stock'],
    default: 'In Stock'
  },
  lowStockThreshold: { type: Number, default: 5 },

  // ─── Variants ───
  colorVariants: [colorVariantSchema],
  hasVariants: { type: Boolean, default: false },

  // ─── Media ───
  thumbnail: { type: String, required: true },
  images: [{ type: String }],
  video: { type: String, default: '' },

  // ─── Product Details ───
  brand: { type: String, default: '' },
  material: { type: String, default: '' },
  careInstructions: { type: String, default: '' },
  countryOfOrigin: { type: String, default: 'India' },
  weight: { type: Number, default: 0 },        // in grams
  dimensions: {
    length: { type: Number, default: 0 },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 }
  },

  // ─── Size Chart ───
  sizeChartImage: { type: String, default: '' },
  sizeGuide: { type: String, default: '' },

  // ─── Tags & SEO ───
  tags: [{ type: String }],
  metaTitle: { type: String, default: '' },
  metaDescription: { type: String, default: '' },

  // ─── Seller Info ───
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true,
    index: true
  },
  sellerBusinessName: { type: String, required: true },
  sellerBusinessAddress: {
    street: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    pincode: { type: String, default: '' },
    country: { type: String, default: 'India' }
  },
  sellerGSTIN: { type: String, default: '' },    // GST Number
  sellerContact: { type: String, default: '' },

  // ─── Ratings & Reviews ───
  averageRating: { type: Number, default: 0, min: 0, max: 5 },
  totalReviews: { type: Number, default: 0 },
  reviews: [reviewSchema],

  // ─── Sales Stats ───
  totalSales: { type: Number, default: 0 },
  totalRevenue: { type: Number, default: 0 },

  // ─── Status ───
  status: {
    type: String,
    enum: ['draft', 'pending', 'active', 'inactive', 'suspended', 'out_of_stock'],
    default: 'draft'
  },
  isFeatured: { type: Boolean, default: false },
  isBestSeller: { type: Boolean, default: false },

  // ─── Timestamps ───
}, { timestamps: true });

// ─── Indexes ───
productSchema.index({ title: 'text', description: 'text', tags: 'text' });
productSchema.index({ productType: 1, category: 1, status: 1 });
productSchema.index({ seller: 1, status: 1 });
productSchema.index({ sellingPrice: 1 });
productSchema.index({ createdAt: -1 });

// ─── Pre-save Middleware ───
productSchema.pre('save', function(next) {
  // Auto-generate slug
  if (!this.slug) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36);
  }

  // Calculate discount
  if (this.basePrice > 0 && this.sellingPrice < this.basePrice) {
    this.discountAmount = this.basePrice - this.sellingPrice;
    this.discountPercentage = Math.round((this.discountAmount / this.basePrice) * 100);
  }

  // Calculate GST
  if (this.priceInclusiveOfGST) {
    this.gstAmount = (this.sellingPrice * this.gstRate) / (100 + this.gstRate);
  } else {
    this.gstAmount = (this.sellingPrice * this.gstRate) / 100;
  }

  // Calculate total stock from variants
  if (this.colorVariants && this.colorVariants.length > 0) {
    let total = 0;
    this.colorVariants.forEach(variant => {
      if (variant.sizes) {
        variant.sizes.forEach(size => {
          total += size.stock || 0;
        });
      }
    });
    this.totalStock = total;
    this.hasVariants = true;
  }

  // Update stock status
  if (this.totalStock === 0) {
    this.stockStatus = 'Out of Stock';
  } else if (this.totalStock <= this.lowStockThreshold) {
    this.stockStatus = 'Low Stock';
  } else {
    this.stockStatus = 'In Stock';
  }

  next();
});

// ─── Methods ───
productSchema.methods.getFinalPrice = function() {
  return this.priceInclusiveOfGST ? this.sellingPrice : this.sellingPrice + this.gstAmount;
};

productSchema.methods.getPriceWithoutGST = function() {
  return this.priceInclusiveOfGST ? this.sellingPrice - this.gstAmount : this.sellingPrice;
};

productSchema.methods.updateAverageRating = async function() {
  if (this.reviews.length === 0) {
    this.averageRating = 0;
    this.totalReviews = 0;
  } else {
    const sum = this.reviews.reduce((acc, r) => acc + r.rating, 0);
    this.averageRating = Math.round((sum / this.reviews.length) * 10) / 10;
    this.totalReviews = this.reviews.length;
  }
  await this.save();
};

// ─── Static Methods ───
productSchema.statics.findBySeller = function(sellerId) {
  return this.find({ seller: sellerId }).sort({ createdAt: -1 });
};

productSchema.statics.findActive = function() {
  return this.find({ status: 'active' });
};

productSchema.statics.searchProducts = function(query) {
  return this.find(
    { $text: { $search: query }, status: 'active' },
    { score: { $meta: 'textScore' } }
  ).sort({ score: { $meta: 'textScore' } });
};

module.exports = mongoose.model('Product', productSchema);
