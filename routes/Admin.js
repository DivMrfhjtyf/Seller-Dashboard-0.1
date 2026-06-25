const express = require('express');
const router = express.Router();
const Seller = require('../models/Seller');

// Middleware to check admin role
const restrictToAdmin = (req, res, next) => {
  if (!req.seller || req.seller.role !== 'ADMIN') {
    return res.status(403).render('error', { 
      title: 'Access Denied',
      message: 'Access Denied: Admins Only' 
    });
  }
  next();
};

// Helper: Time ago formatter
const formatTimeAgo = (date) => {
  if (!date) return 'N/A';
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now - then) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return then.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

// ====================== GET ADMIN DASHBOARD ======================
router.get('/', restrictToAdmin, async (req, res) => {
  try {
    const pendingSellers = await Seller.find({
      verificationStatus: 'Pending',
      isGoogleUser: false
    }).sort({ createdAt: -1 }).lean();

    const approvedEmailSellers = await Seller.find({
      verificationStatus: 'Approved',
      isGoogleUser: false
    }).sort({ approvedAt: -1 }).lean();

    const googleSellers = await Seller.find({
      isGoogleUser: true
    }).sort({ createdAt: -1 }).lean();

    const rejectedSellers = await Seller.find({
      verificationStatus: 'Rejected',
      isGoogleUser: false
    }).sort({ rejectedAt: -1 }).lean();

    const stats = {
      total: await Seller.countDocuments(),
      pending: await Seller.countDocuments({ verificationStatus: 'Pending', isGoogleUser: false }),
      approved: await Seller.countDocuments({ verificationStatus: 'Approved', isGoogleUser: false }),
      google: await Seller.countDocuments({ isGoogleUser: true }),
      rejected: await Seller.countDocuments({ verificationStatus: 'Rejected', isGoogleUser: false })
    };

    let Product, Order;
    try { Product = require('../models/Product'); } catch (e) { Product = null; }
    try { Order = require('../models/Order'); } catch (e) { Order = null; }

    let recentOrders = [];
    let topProducts = [];
    let revenueData = [];
    let orderStatusData = { labels: [], data: [] };

    if (Product) {
      recentOrders = await Product.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

      topProducts = await Product.find()
        .sort({ revenue: -1 })
        .limit(10)
        .lean();

      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      revenueData = days.map((day, i) => ({
        label: day,
        value: Math.floor(40000 + Math.random() * 40000)
      }));

      orderStatusData = {
        labels: ['Delivered', 'Pending', 'Processing', 'Cancelled', 'Returned'],
        data: [
          await Product.countDocuments({ status: 'delivered' }),
          await Product.countDocuments({ status: 'pending' }),
          await Product.countDocuments({ status: 'processing' }),
          await Product.countDocuments({ status: 'cancelled' }),
          await Product.countDocuments({ status: 'returned' })
        ]
      };
      if (orderStatusData.data.every(v => v === 0)) {
        orderStatusData.data = [45, 20, 25, 7, 3];
      }
    }

    res.render('adminDashboard', {
      title: 'Admin Dashboard - SellerHub',
      user: req.seller,
      admin: req.seller,
      pendingSellers,
      approvedEmailSellers,
      googleSellers,
      rejectedSellers,
      stats,
      recentOrders,
      topProducts,
      revenueData,
      orderStatusData
    });
  } catch (error) {
    console.error("❌ Admin Dashboard Error:", error.message);
    res.status(500).render('error', { 
      title: 'Error',
      message: 'Internal Server Error' 
    });
  }
});

// ====================== GET ALL SELLERS PAGE ======================
router.get('/sellers', restrictToAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const status = req.query.status || 'all';

    let query = {};
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { businessName: { $regex: search, $options: 'i' } }
      ];
    }
    if (status !== 'all') {
      if (status === 'google') {
        query.isGoogleUser = true;
      } else {
        query.verificationStatus = status.charAt(0).toUpperCase() + status.slice(1);
        query.isGoogleUser = false;
      }
    }

    const totalSellers = await Seller.countDocuments(query);
    const totalPages = Math.ceil(totalSellers / limit);

    const sellers = await Seller.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.render('adminSellers', {
      title: 'All Sellers - Admin',
      user: req.seller,
      admin: req.seller,
      sellers,
      currentPage: page,
      totalPages,
      totalSellers,
      search,
      status,
      hasNext: page < totalPages,
      hasPrev: page > 1
    });
  } catch (error) {
    console.error("❌ Sellers Page Error:", error.message);
    res.status(500).render('error', { 
      title: 'Error',
      message: 'Internal Server Error' 
    });
  }
});

// ====================== APPROVE SELLER ======================
router.post('/sellers/:id/approve', restrictToAdmin, async (req, res) => {
  try {
    const seller = await Seller.findById(req.params.id);
    if (!seller) {
      return res.status(404).json({ success: false, message: "Seller not found" });
    }

    seller.verificationStatus = 'Approved';
    seller.approvedBy = req.seller._id;
    seller.approvedAt = new Date();
    await seller.save();

    res.json({
      success: true,
      message: "Seller approved successfully",
      seller: {
        id: seller._id,
        fullName: seller.fullName,
        email: seller.email,
        verificationStatus: seller.verificationStatus
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ====================== REJECT SELLER ======================
router.post('/sellers/:id/reject', restrictToAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    const seller = await Seller.findById(req.params.id);
    if (!seller) {
      return res.status(404).json({ success: false, message: "Seller not found" });
    }

    seller.verificationStatus = 'Rejected';
    seller.rejectionReason = reason || 'Application rejected by admin';
    seller.rejectedAt = new Date();
    await seller.save();

    res.json({
      success: true,
      message: "Seller rejected",
      seller: {
        id: seller._id,
        fullName: seller.fullName,
        email: seller.email,
        verificationStatus: seller.verificationStatus,
        rejectionReason: seller.rejectionReason
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ====================== GET SINGLE SELLER DETAILS ======================
router.get('/sellers/:id', restrictToAdmin, async (req, res) => {
  try {
    const seller = await Seller.findById(req.params.id).lean();
    if (!seller) {
      return res.status(404).json({ success: false, message: "Seller not found" });
    }
    res.json({ success: true, seller });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ====================== GET ADMIN ORDERS PAGE ======================
router.get('/orders', restrictToAdmin, async (req, res) => {
  try {
    let Order;
    try { Order = require('../models/Order'); } catch (e) { Order = null; }

    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;
    const status = req.query.status || '';
    const sort = req.query.sort || 'newest';
    const search = req.query.search || '';

    let orders = [];
    let totalOrders = 0;
    let stats = { total: 0, pending: 0, processing: 0, delivered: 0, cancelled: 0 };

    if (Order) {
      let query = {};
      if (status) query.status = status;
      if (search) {
        query.$or = [
          { orderNumber: { $regex: search, $options: 'i' } },
          { customerName: { $regex: search, $options: 'i' } },
          { customerEmail: { $regex: search, $options: 'i' } }
        ];
      }

      let sortOption = { createdAt: -1 };
      if (sort === 'oldest') sortOption = { createdAt: 1 };
      if (sort === 'amount-high') sortOption = { totalAmount: -1 };
      if (sort === 'amount-low') sortOption = { totalAmount: 1 };

      [orders, totalOrders] = await Promise.all([
        Order.find(query).sort(sortOption).skip(skip).limit(limit).lean(),
        Order.countDocuments(query)
      ]);

      const statAgg = await Order.aggregate([
        { $group: {
          _id: null,
          total: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          processing: { $sum: { $cond: [{ $in: ['$status', ['confirmed', 'processing', 'shipped']] }, 1, 0] } },
          delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } }
        }}
      ]);

      if (statAgg && statAgg[0]) {
        stats = statAgg[0];
      }
    }

    const totalPages = Math.ceil(totalOrders / limit);

    res.render('adminOrders', {
      title: 'Orders - Admin',
      user: req.seller,
      admin: req.seller,
      orders,
      stats,
      currentPage: page,
      totalPages,
      totalOrders,
      limit,
      hasNext: page < totalPages,
      hasPrev: page > 1,
      currentStatus: status,
      currentSort: sort,
      searchQuery: search
    });
  } catch (error) {
    console.error("❌ Orders Page Error:", error.message);
    res.status(500).render('error', { 
      title: 'Error',
      message: 'Failed to load orders' 
    });
  }
});

// ====================== UPDATE ORDER STATUS (ADMIN) ======================
router.post('/orders/:id/status', restrictToAdmin, async (req, res) => {
  try {
    let Order;
    try { Order = require('../models/Order'); } catch (e) {
      return res.status(500).json({ success: false, message: 'Order module not available' });
    }

    const { status, note } = req.body;
    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    order.status = status;
    if (!order.statusHistory) order.statusHistory = [];
    order.statusHistory.push({
      status,
      note: note || `Status changed to ${status} by admin`,
      updatedBy: req.seller._id,
      updatedAt: new Date()
    });

    if (status === 'delivered') {
      order.deliveredAt = new Date();
    }

    await order.save();
    res.json({ success: true, message: 'Status updated', order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ====================== GET ADMIN PRODUCTS PAGE ======================
router.get('/products', restrictToAdmin, async (req, res) => {
  try {
    let Product;
    try { Product = require('../models/Product'); } catch (e) { Product = null; }

    const page = parseInt(req.query.page) || 1;
    const limit = 24;
    const skip = (page - 1) * limit;
    const status = req.query.status || '';
    const category = req.query.category || '';
    const sort = req.query.sort || 'newest';
    const search = req.query.search || '';
    const viewMode = req.query.view || 'grid';

    let products = [];
    let totalProducts = 0;
    let categories = [];

    if (Product) {
      let query = {};
      if (status) query.status = status;
      if (category) query.category = category;
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { brand: { $regex: search, $options: 'i' } }
        ];
      }

      let sortOption = { createdAt: -1 };
      if (sort === 'popular') sortOption = { totalSales: -1 };
      if (sort === 'price-high') sortOption = { sellingPrice: -1 };
      if (sort === 'price-low') sortOption = { sellingPrice: 1 };
      if (sort === 'revenue') sortOption = { totalRevenue: -1 };

      [products, totalProducts, categories] = await Promise.all([
        Product.find(query).sort(sortOption).skip(skip).limit(limit).lean(),
        Product.countDocuments(query),
        Product.distinct('category', { status: 'active' })
      ]);
    }

    const totalPages = Math.ceil(totalProducts / limit);

    res.render('adminProducts', {
      title: 'Products - Admin',
      user: req.seller,
      admin: req.seller,
      products,
      categories,
      currentPage: page,
      totalPages,
      totalProducts,
      limit,
      hasNext: page < totalPages,
      hasPrev: page > 1,
      currentStatus: status,
      currentCategory: category,
      currentSort: sort,
      searchQuery: search,
      viewMode
    });
  } catch (error) {
    console.error("❌ Products Page Error:", error.message);
    res.status(500).render('error', { 
      title: 'Error',
      message: 'Failed to load products' 
    });
  }
});

// ====================== TOGGLE PRODUCT STATUS (ADMIN) ======================
router.post('/products/:id/toggle-status', restrictToAdmin, async (req, res) => {
  try {
    let Product;
    try { Product = require('../models/Product'); } catch (e) {
      return res.status(500).json({ success: false, message: 'Product module not available' });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    product.status = product.status === 'active' ? 'inactive' : 'active';
    await product.save();

    res.json({ 
      success: true, 
      message: `Product ${product.status === 'active' ? 'activated' : 'deactivated'}`,
      status: product.status 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ====================== DELETE PRODUCT (ADMIN) ======================
router.post('/products/:id/delete', restrictToAdmin, async (req, res) => {
  try {
    let Product;
    try { Product = require('../models/Product'); } catch (e) {
      return res.status(500).json({ success: false, message: 'Product module not available' });
    }

    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Decrement seller's product count
    if (product.seller) {
      await Seller.findByIdAndUpdate(product.seller, { $inc: { totalProducts: -1 } });
    }

    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ====================== GET ADMIN ACTIVITY PAGE ======================
router.get('/activity', restrictToAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;
    const type = req.query.type || '';
    const time = req.query.time || 'today';
    const search = req.query.search || '';

    // Build time filter
    let timeFilter = {};
    const now = new Date();
    if (time === 'today') {
      timeFilter = { createdAt: { $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) } };
    } else if (time === 'yesterday') {
      const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
      timeFilter = { createdAt: { $gte: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()), $lt: new Date(now.getFullYear(), now.getMonth(), now.getDate()) } };
    } else if (time === 'week') {
      const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
      timeFilter = { createdAt: { $gte: weekAgo } };
    } else if (time === 'month') {
      timeFilter = { createdAt: { $gte: new Date(now.getFullYear(), now.getMonth(), 1) } };
    }

    // Mock activities (replace with real Activity model when ready)
    const mockActivities = [
      { type: 'order', icon: 'shopping-cart', title: 'New Order Received', description: 'Order #ORD-7842 placed by Rahul Sharma for ₹2,499', user: 'Rahul Sharma', entity: 'Order #ORD-7842', amount: 2499, createdAt: new Date(Date.now() - 2 * 60000), badge: 'New', badgeType: 'success' },
      { type: 'user', icon: 'user-plus', title: 'New Seller Registration', description: 'Fashion Hub Store completed registration and is awaiting approval', user: 'Fashion Hub', entity: 'Seller Registration', createdAt: new Date(Date.now() - 15 * 60000), badge: 'Pending', badgeType: 'warning' },
      { type: 'product', icon: 'box', title: 'Product Added', description: 'Men\'s Cotton Kurta was added to the catalog by Trendy Wear', user: 'Trendy Wear', entity: 'Men\'s Cotton Kurta', createdAt: new Date(Date.now() - 60 * 60000) },
      { type: 'review', icon: 'star', title: 'New 5-Star Review', description: 'Premium T-Shirt received a 5-star review from verified buyer', user: 'Verified Buyer', entity: 'Premium T-Shirt', createdAt: new Date(Date.now() - 3 * 60 * 60000) },
      { type: 'order', icon: 'check-circle', title: 'Order Delivered', description: 'Order #ORD-7839 was successfully delivered to Priya Patel', user: 'Priya Patel', entity: 'Order #ORD-7839', amount: 1899, createdAt: new Date(Date.now() - 5 * 60 * 60000), badge: 'Completed', badgeType: 'success' },
      { type: 'payment', icon: 'credit-card', title: 'Payout Processed', description: '₹15,420 payout processed to Electronics World', user: 'Electronics World', entity: 'Payout #PAY-4521', amount: 15420, createdAt: new Date(Date.now() - 6 * 60 * 60000) },
      { type: 'system', icon: 'cog', title: 'System Update', description: 'Platform maintenance completed successfully. All systems operational.', entity: 'System', createdAt: new Date(Date.now() - 8 * 60 * 60000) },
      { type: 'order', icon: 'times-circle', title: 'Order Cancelled', description: 'Order #ORD-7835 was cancelled by customer request', user: 'Customer', entity: 'Order #ORD-7835', amount: 899, createdAt: new Date(Date.now() - 12 * 60 * 60000), badge: 'Cancelled', badgeType: 'danger' },
      { type: 'user', icon: 'user-check', title: 'Seller Approved', description: 'Gadget Zone seller application was approved by admin', user: 'Gadget Zone', entity: 'Seller Approval', createdAt: new Date(Date.now() - 14 * 60 * 60000), badge: 'Approved', badgeType: 'success' },
      { type: 'product', icon: 'edit', title: 'Product Updated', description: 'Wireless Earbuds price updated from ₹1,999 to ₹1,499', user: 'Tech Store', entity: 'Wireless Earbuds', createdAt: new Date(Date.now() - 16 * 60 * 60000) }
    ];

    let activities = mockActivities;
    let totalActivities = activities.length;

    // Apply type filter
    if (type) {
      activities = activities.filter(a => a.type === type);
      totalActivities = activities.length;
    }

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      activities = activities.filter(a => 
        (a.title && a.title.toLowerCase().includes(searchLower)) ||
        (a.description && a.description.toLowerCase().includes(searchLower)) ||
        (a.user && a.user.toLowerCase().includes(searchLower))
      );
      totalActivities = activities.length;
    }

    // Pagination for mock data
    activities = activities.slice(skip, skip + limit);
    const totalPages = Math.ceil(totalActivities / limit);

    // Stats
    const stats = {
      today: mockActivities.filter(a => new Date(a.createdAt) > new Date(now.getFullYear(), now.getMonth(), now.getDate())).length,
      orders: mockActivities.filter(a => a.type === 'order').length,
      sellers: mockActivities.filter(a => a.type === 'user').length,
      products: mockActivities.filter(a => a.type === 'product').length
    };

    // Active users (mock)
    const activeUsers = [
      { name: 'Rahul Sharma', email: 'rahul@example.com', role: 'CUSTOMER', actionCount: 12, lastActive: new Date(Date.now() - 5 * 60000), avatar: '/images/default-avatar.png' },
      { name: 'Fashion Hub', email: 'contact@fashionhub.com', role: 'SELLER', actionCount: 8, lastActive: new Date(Date.now() - 15 * 60000), avatar: '/images/default-shop.png' },
      { name: 'Admin User', email: 'admin@shopp123.com', role: 'ADMIN', actionCount: 45, lastActive: new Date(Date.now() - 2 * 60000), avatar: '/images/admin-avatar.png' },
      { name: 'Priya Patel', email: 'priya@example.com', role: 'CUSTOMER', actionCount: 6, lastActive: new Date(Date.now() - 30 * 60000), avatar: '/images/default-avatar.png' }
    ];

    res.render('adminActivity', {
      title: 'Activity Feed - Admin',
      user: req.seller,
      admin: req.seller,
      activities,
      activeUsers,
      stats,
      currentPage: page,
      totalPages,
      totalActivities,
      limit,
      hasNext: page < totalPages,
      hasPrev: page > 1,
      currentType: type,
      currentTime: time,
      searchQuery: search,
      formatTimeAgo
    });
  } catch (error) {
    console.error("❌ Activity Page Error:", error.message);
    res.status(500).render('error', { 
      title: 'Error',
      message: 'Failed to load activity feed' 
    });
  }
});

// ====================== GET LATEST ACTIVITIES API (for auto-refresh) ======================
router.get('/activity/api/latest', restrictToAdmin, async (req, res) => {
  try {
    // Return count of new activities since last check
    // In production, this would query your Activity/Log collection
    res.json({ success: true, newCount: 0 });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ====================== GET ADMIN SETTINGS PAGE ======================
router.get('/settings', restrictToAdmin, async (req, res) => {
  try {
    res.render('adminSettings', {
      title: 'Settings - Admin',
      user: req.seller,
      admin: req.seller
    });
  } catch (error) {
    console.error("❌ Settings Page Error:", error.message);
    res.status(500).render('error', { 
      title: 'Error',
      message: 'Failed to load settings' 
    });
  }
});

// ====================== ADMIN LOGOUT ======================
router.get('/logout', restrictToAdmin, (req, res) => {
  res.clearCookie('token', { path: '/' });
  req.session.destroy?.();
  res.redirect('/seller/signin');
});

module.exports = router;
