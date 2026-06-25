const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Seller = require('../models/Seller');
const { isSellerAuth } = require('../middlewares/auth');

// ─── HELPER: Check product ownership ───
const verifyProductOwnership = async (productId, sellerId) => {
  const product = await Product.findById(productId);
  if (!product) throw new Error('Product not found');
  if (product.seller.toString() !== sellerId.toString()) {
    throw new Error('Unauthorized: This product does not belong to you');
  }
  return product;
};

// ─── GET /products/seller/dashboard ───
router.get('/seller/dashboard', isSellerAuth, async (req, res) => {
  try {
    const sellerId = req.seller._id;
    const [
      totalProducts,
      activeProducts,
      outOfStockProducts,
      lowStockProducts,
      totalRevenueAgg,
      recentProducts
    ] = await Promise.all([
      Product.countDocuments({ seller: sellerId }),
      Product.countDocuments({ seller: sellerId, status: 'active' }),
      Product.countDocuments({ seller: sellerId, stockStatus: 'Out of Stock' }),
      Product.countDocuments({ seller: sellerId, stockStatus: 'Low Stock' }),
      Product.aggregate([
        { $match: { seller: sellerId } },
        { $group: { _id: null, total: { $sum: '$totalRevenue' } } }
      ]),
      Product.find({ seller: sellerId })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('title thumbnail sellingPrice stockStatus status totalSales createdAt')
    ]);

    const topSelling = await Product.find({ seller: sellerId })
      .sort({ totalSales: -1 })
      .limit(5)
      .select('title thumbnail sellingPrice totalSales totalRevenue');

    res.render('sellerDashboard', {
      title: 'Seller Dashboard',
      seller: req.seller,
      stats: {
        totalProducts,
        activeProducts,
        outOfStockProducts,
        lowStockProducts,
        totalRevenue: totalRevenueAgg[0]?.total || 0
      },
      recentProducts,
      topSelling
    });
  } catch (err) {
    console.error('Dashboard Error:', err);
    req.flash('error', 'Failed to load dashboard');
    res.redirect('/');
  }
});

// ─── GET /products/seller/list ───
router.get('/seller/list', isSellerAuth, async (req, res) => {
  try {
    const sellerId = req.seller._id;
    const { status, category, stock, search, page = 1, limit = 12 } = req.query;

    const filter = { seller: sellerId };
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (stock) filter.stockStatus = stock;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [products, totalCount, categories] = await Promise.all([
      Product.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('title thumbnail basePrice sellingPrice discountPercentage stockStatus status totalSales totalStock category productType createdAt'),
      Product.countDocuments(filter),
      Product.distinct('category', { seller: sellerId })
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    res.render('productList', {
      title: 'My Products',
      seller: req.seller,
      products,
      categories,
      filters: { status, category, stock, search },
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        hasNext: parseInt(page) < totalPages,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (err) {
    console.error('Product List Error:', err);
    req.flash('error', 'Failed to load products');
    res.redirect('/products/seller/dashboard');
  }
});

// ─── GET /products/seller/add ───
router.get('/seller/add', isSellerAuth, async (req, res) => {
  try {
    const seller = await Seller.findById(req.seller._id);
    res.render('addProduct', {
      title: 'Add New Product',
      seller,
      productTypes: ['Men', 'Women', 'Kids', 'Boys', 'Girls', 'Unisex'],
      categories: [
        'T-Shirt', 'Shirt', 'Kurta', 'Jeans', 'Trousers', 'Shorts',
        'Ethnic Wear', 'Western Wear', 'Sportswear', 'Innerwear',
        'Footwear', 'Accessories', 'Watches', 'Bags', 'Jewelry',
        'Saree', 'Lehenga', 'Dress', 'Jacket', 'Hoodie', 'Sweater',
        'Blazer', 'Suit', 'Co-ord Set', 'Nightwear', 'Swimwear',
        'Pet', 'Other'
      ],
      gstRates: [0, 5, 12, 18, 28],
      sizeOptions: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', 'Free Size']
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Something went wrong');
    res.redirect('/products/seller/list');
  }
});

// ─── POST /products/seller/add ───
router.post('/seller/add', isSellerAuth, async (req, res) => {
  try {
    const sellerId = req.seller._id;
    const seller = await Seller.findById(sellerId);

    const {
      title, description, shortDescription,
      productType, category, subCategory,
      basePrice, sellingPrice, gstRate,
      brand, material, careInstructions,
      countryOfOrigin, weight,
      tags, metaTitle, metaDescription,
      colorVariants,
      sizeChartImage, sizeGuide,
      hasVariants
    } = req.body;

    const thumbnail = req.files?.thumbnail?.[0]?.path || req.body.thumbnail || '';
    const productImages = req.files?.images?.map(f => f.path) || req.body.images?.split(',') || [];
    const productVideo = req.files?.video?.[0]?.path || req.body.video || '';

    let parsedVariants = [];
    if (colorVariants) {
      try {
        parsedVariants = typeof colorVariants === 'string' ? JSON.parse(colorVariants) : colorVariants;
      } catch (e) {
        parsedVariants = [];
      }
    }

    const businessAddress = {
      street: seller.businessAddress?.street || '',
      city: seller.businessAddress?.city || '',
      state: seller.businessAddress?.state || '',
      pincode: seller.businessAddress?.pincode || '',
      country: seller.businessAddress?.country || 'India'
    };

    const newProduct = new Product({
      title,
      description,
      shortDescription,
      productType,
      category,
      subCategory: subCategory || '',
      basePrice: parseFloat(basePrice),
      sellingPrice: parseFloat(sellingPrice),
      gstRate: parseInt(gstRate) || 5,
      brand: brand || '',
      material: material || '',
      careInstructions: careInstructions || '',
      countryOfOrigin: countryOfOrigin || 'India',
      weight: parseFloat(weight) || 0,
      tags: tags ? tags.split(',').map(t => t.trim()) : [],
      metaTitle: metaTitle || title,
      metaDescription: metaDescription || shortDescription || description.substring(0, 160),
      thumbnail,
      images: productImages,
      video: productVideo,
      colorVariants: parsedVariants,
      hasVariants: hasVariants === 'true' || parsedVariants.length > 0,
      sizeChartImage: sizeChartImage || '',
      sizeGuide: sizeGuide || '',
      seller: sellerId,
      sellerBusinessName: seller.businessName,
      sellerBusinessAddress: businessAddress,
      sellerGSTIN: seller.gstin || '',
      sellerContact: seller.phone,
      status: 'active'
    });

    await newProduct.save();
    await Seller.findByIdAndUpdate(sellerId, { $inc: { totalProducts: 1 } });

    req.flash('success', 'Product added successfully!');
    res.redirect('/products/seller/list');
  } catch (err) {
    console.error('Add Product Error:', err);
    req.flash('error', err.message || 'Failed to add product');
    res.redirect('/products/seller/add');
  }
});

// ─── GET /products/seller/edit/:id ───
router.get('/seller/edit/:id', isSellerAuth, async (req, res) => {
  try {
    const product = await verifyProductOwnership(req.params.id, req.seller._id);
    const seller = await Seller.findById(req.seller._id);

    res.render('editProduct', {
      title: 'Edit Product',
      product,
      seller,
      productTypes: ['Men', 'Women', 'Kids', 'Boys', 'Girls', 'Unisex'],
      categories: [
        'T-Shirt', 'Shirt', 'Kurta', 'Jeans', 'Trousers', 'Shorts',
        'Ethnic Wear', 'Western Wear', 'Sportswear', 'Innerwear',
        'Footwear', 'Accessories', 'Watches', 'Bags', 'Jewelry',
        'Saree', 'Lehenga', 'Dress', 'Jacket', 'Hoodie', 'Sweater',
        'Blazer', 'Suit', 'Co-ord Set', 'Nightwear', 'Swimwear',
        'Pet', 'Other'
      ],
      gstRates: [0, 5, 12, 18, 28],
      sizeOptions: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', 'Free Size']
    });
  } catch (err) {
    console.error(err);
    req.flash('error', err.message);
    res.redirect('/products/seller/list');
  }
});

// ─── POST /products/seller/edit/:id ───
router.post('/seller/edit/:id', isSellerAuth, async (req, res) => {
  try {
    const product = await verifyProductOwnership(req.params.id, req.seller._id);

    const {
      title, description, shortDescription,
      productType, category, subCategory,
      basePrice, sellingPrice, gstRate,
      brand, material, careInstructions,
      countryOfOrigin, weight,
      tags, metaTitle, metaDescription,
      colorVariants,
      sizeChartImage, sizeGuide,
      status
    } = req.body;

    const thumbnail = req.files?.thumbnail?.[0]?.path || product.thumbnail;
    const productImages = req.files?.images?.map(f => f.path) || product.images;
    const productVideo = req.files?.video?.[0]?.path || product.video;

    let parsedVariants = product.colorVariants;
    if (colorVariants) {
      try {
        parsedVariants = typeof colorVariants === 'string' ? JSON.parse(colorVariants) : colorVariants;
      } catch (e) {
        // keep existing
      }
    }

    const updates = {
      title,
      description,
      shortDescription,
      productType,
      category,
      subCategory: subCategory || '',
      basePrice: parseFloat(basePrice),
      sellingPrice: parseFloat(sellingPrice),
      gstRate: parseInt(gstRate) || product.gstRate,
      brand: brand || '',
      material: material || '',
      careInstructions: careInstructions || '',
      countryOfOrigin: countryOfOrigin || 'India',
      weight: parseFloat(weight) || 0,
      tags: tags ? tags.split(',').map(t => t.trim()) : product.tags,
      metaTitle: metaTitle || title,
      metaDescription: metaDescription || description?.substring(0, 160),
      thumbnail,
      images: productImages,
      video: productVideo,
      colorVariants: parsedVariants,
      hasVariants: parsedVariants.length > 0,
      sizeChartImage: sizeChartImage || product.sizeChartImage,
      sizeGuide: sizeGuide || product.sizeGuide,
      status: status || product.status
    };

    await Product.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });

    req.flash('success', 'Product updated successfully!');
    res.redirect('/products/seller/list');
  } catch (err) {
    console.error('Edit Product Error:', err);
    req.flash('error', err.message || 'Failed to update product');
    res.redirect(`/products/seller/edit/${req.params.id}`);
  }
});

// ─── POST /products/seller/delete/:id ───
router.post('/seller/delete/:id', isSellerAuth, async (req, res) => {
  try {
    const product = await verifyProductOwnership(req.params.id, req.seller._id);
    await Product.findByIdAndDelete(req.params.id);
    await Seller.findByIdAndUpdate(req.seller._id, { $inc: { totalProducts: -1 } });

    req.flash('success', 'Product deleted successfully');
    res.redirect('/products/seller/list');
  } catch (err) {
    console.error(err);
    req.flash('error', err.message || 'Failed to delete product');
    res.redirect('/products/seller/list');
  }
});

// ─── POST /products/seller/toggle-status/:id ───
router.post('/seller/toggle-status/:id', isSellerAuth, async (req, res) => {
  try {
    const product = await verifyProductOwnership(req.params.id, req.seller._id);
    const newStatus = product.status === 'active' ? 'inactive' : 'active';
    await Product.findByIdAndUpdate(req.params.id, { status: newStatus });

    req.flash('success', `Product ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`);
    res.redirect('/products/seller/list');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to update status');
    res.redirect('/products/seller/list');
  }
});

// ─── GET /products/seller/stock-alert ───
router.get('/seller/stock-alert', isSellerAuth, async (req, res) => {
  try {
    const sellerId = req.seller._id;

    const [lowStockProducts, outOfStockCount, lowStockCount] = await Promise.all([
      Product.find({
        seller: sellerId,
        $or: [
          { stockStatus: 'Low Stock' },
          { stockStatus: 'Out of Stock' }
        ]
      }).sort({ totalStock: 1 }),
      Product.countDocuments({ seller: sellerId, stockStatus: 'Out of Stock' }),
      Product.countDocuments({ seller: sellerId, stockStatus: 'Low Stock' })
    ]);

    res.render('stockAlert', {
      title: 'Stock Alerts',
      seller: req.seller,
      products: lowStockProducts,
      outOfStockCount,
      lowStockCount
    });
  } catch (err) {
    console.error('Stock Alert Error:', err);
    req.flash('error', 'Failed to load stock alerts');
    res.redirect('/products/seller/dashboard');
  }
});

// ═══════════════════════════════════════════════
// PUBLIC / CUSTOMER ROUTES
// ═══════════════════════════════════════════════

// GET /products — All Active Products (Customer View)
router.get('/', async (req, res) => {
  try {
    const { productType, category, minPrice, maxPrice, sort, page = 1, search } = req.query;
    const limit = 20;

    const filter = { status: 'active' };
    if (productType) filter.productType = productType;
    if (category) filter.category = category;
    if (minPrice || maxPrice) {
      filter.sellingPrice = {};
      if (minPrice) filter.sellingPrice.$gte = parseFloat(minPrice);
      if (maxPrice) filter.sellingPrice.$lte = parseFloat(maxPrice);
    }
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    let sortOption = { createdAt: -1 };
    if (sort === 'price-low') sortOption = { sellingPrice: 1 };
    if (sort === 'price-high') sortOption = { sellingPrice: -1 };
    if (sort === 'popular') sortOption = { totalSales: -1 };
    if (sort === 'rating') sortOption = { averageRating: -1 };
    if (sort === 'newest') sortOption = { createdAt: -1 };

    const skip = (parseInt(page) - 1) * limit;

    const [products, totalCount, categories, types] = await Promise.all([
      Product.find(filter)
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .select('title slug thumbnail basePrice sellingPrice discountPercentage averageRating totalReviews stockStatus productType category sellerBusinessName'),
      Product.countDocuments(filter),
      Product.distinct('category', { status: 'active' }),
      Product.distinct('productType', { status: 'active' })
    ]);

    res.render('products', {
      title: 'All Products',
      products,
      categories,
      types,
      filters: { productType, category, minPrice, maxPrice, sort, search },
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        totalCount
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Failed to load products' });
  }
});

// GET /products/:slug — Single Product Detail
router.get('/:slug', async (req, res) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug, status: 'active' })
      .populate('seller', 'businessName businessLogo rating isVerified')
      .populate('reviews.user', 'name avatar');

    if (!product) {
      return res.status(404).render('404', { message: 'Product not found' });
    }

    const relatedProducts = await Product.find({
      _id: { $ne: product._id },
      category: product.category,
      status: 'active'
    }).limit(8).select('title slug thumbnail sellingPrice discountPercentage');

    res.render('productDetail', {
      title: product.title,
      product,
      relatedProducts
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Failed to load product' });
  }
});

// POST /products/:id/review — Add Review
router.post('/:id/review', async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Please login to review' });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const existingReview = product.reviews.find(r => r.user.toString() === userId.toString());
    if (existingReview) {
      existingReview.rating = rating;
      existingReview.comment = comment;
    } else {
      product.reviews.push({ user: userId, rating, comment });
    }

    await product.updateAverageRating();
    res.json({ success: true, message: 'Review added successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
