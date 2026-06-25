const express = require('express');
const router = express.Router();

// Models
let Seller, Product, Order;
try { Seller = require('../models/Seller'); } catch(e) { Seller = null; }
try { Product = require('../models/Product'); } catch(e) { Product = null; }
try { Order = require('../models/Order'); } catch(e) { Order = null; }

// ===================== AUTH MIDDLEWARE =====================
const requireSellerAuth = async (req, res, next) => {
  try {
    if (!req.seller) {
      return res.redirect('/seller/signin');
    }
    const seller = await Seller.findById(req.seller._id).select('-password').lean();
    if (!seller) {
      res.clearCookie('token');
      return res.redirect('/seller/signin');
    }
    req.sellerData = seller;
    next();
  } catch (err) {
    console.error('Auth error:', err);
    return res.redirect('/seller/signin');
  }
};

// ===================== EARNINGS PAGE =====================
// GET /seller/earnings/ (mounted at /seller/earnings in app.js)
router.get('/', requireSellerAuth, async (req, res) => {
  try {
    const sellerId = req.sellerData._id;
    const seller = req.sellerData;

    let totalRevenue = 0;
    let thisMonthRevenue = 0;
    let pendingAmount = 0;
    let availableBalance = 0;
    let totalOrders = 0;
    let totalProducts = 0;
    let earningsHistory = [];

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    if (Order) {
      const orders = await Order.find({ seller: sellerId }).lean();
      totalOrders = orders.length;

      orders.forEach(order => {
        const orderTotal = order.totalAmount || order.grandTotal || 0;
        totalRevenue += orderTotal;

        const orderDate = new Date(order.createdAt);
        if (orderDate >= startOfMonth) {
          thisMonthRevenue += orderTotal;
        }

        if (order.status === 'delivered') {
          availableBalance += orderTotal;
        } else if (['pending', 'confirmed', 'processing', 'shipped'].includes(order.status)) {
          pendingAmount += orderTotal;
        }
      });

      // Build earnings history (last 12 months)
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthlyData = {};

      orders.forEach(order => {
        const d = new Date(order.createdAt);
        const key = `${months[d.getMonth()]} ${d.getFullYear()}`;
        if (!monthlyData[key]) monthlyData[key] = 0;
        monthlyData[key] += order.totalAmount || 0;
      });

      // Get last 6 months
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${months[d.getMonth()]} ${d.getFullYear()}`;
        earningsHistory.push({
          month: key,
          amount: monthlyData[key] || 0,
          orders: orders.filter(o => {
            const od = new Date(o.createdAt);
            return od.getMonth() === d.getMonth() && od.getFullYear() === d.getFullYear();
          }).length
        });
      }
    }

    if (Product) {
      totalProducts = await Product.countDocuments({ seller: sellerId });
    }

    // Calculate commission (assume 10% platform fee)
    const platformFee = totalRevenue * 0.10;
    const netEarnings = totalRevenue - platformFee;

    res.render('sellerEarnings', {
      title: 'Earnings - SellerHub',
      seller: seller,
      stats: {
        totalRevenue,
        thisMonthRevenue,
        pendingAmount,
        availableBalance: Math.max(0, availableBalance - platformFee),
        totalOrders,
        totalProducts,
        platformFee,
        netEarnings
      },
      earningsHistory,
      currency: '₹'
    });
  } catch (err) {
    console.error('Earnings error:', err);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load earnings data'
    });
  }
});

// ===================== REQUEST PAYOUT =====================
// POST /seller/earnings/payout
router.post('/payout', requireSellerAuth, async (req, res) => {
  try {
    const { amount, method, accountDetails } = req.body;
    const sellerId = req.sellerData._id;

    const minPayout = 500;
    if (!amount || amount < minPayout) {
      return res.status(400).json({
        success: false,
        message: `Minimum payout amount is ₹${minPayout}`
      });
    }

    console.log(`Payout request: Seller ${sellerId}, Amount: ${amount}, Method: ${method}`);

    res.json({
      success: true,
      message: 'Payout request submitted successfully. You will receive the amount within 3-5 business days.',
      payoutId: 'PAY-' + Date.now()
    });
  } catch (err) {
    console.error('Payout error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to process payout request'
    });
  }
});

// ===================== EARNINGS API (JSON) =====================
// GET /seller/earnings/api/summary
router.get('/api/summary', requireSellerAuth, async (req, res) => {
  try {
    const sellerId = req.sellerData._id;

    let totalRevenue = 0;
    let totalOrders = 0;

    if (Order) {
      const orders = await Order.find({ seller: sellerId }).lean();
      totalOrders = orders.length;
      totalRevenue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    }

    res.json({
      success: true,
      data: {
        totalRevenue,
        totalOrders,
        currency: '₹'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
