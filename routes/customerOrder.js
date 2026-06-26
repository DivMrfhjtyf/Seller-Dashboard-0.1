const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const Seller = require('../models/Seller');

// ====================== PLACE ORDER (CUSTOMER) ======================
router.post('/place', async (req, res) => {
  try {
    const {
      customerId,
      customerName,
      customerEmail,
      customerPhone,
      shippingAddress,
      items,
      paymentMethod,
      paymentDetails
    } = req.body;

    // Validate required fields
    if (!customerId || !customerName || !customerEmail || !items || !items.length) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Validate items and calculate totals
    let subtotal = 0;
    let totalShipping = 0;
    const orderItems = [];
    let sellerId = null;

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product not found: ${item.productId}`
        });
      }

      // All items must be from same seller
      if (sellerId && product.seller.toString() !== sellerId) {
        return res.status(400).json({
          success: false,
          message: 'All items must be from the same seller'
        });
      }
      sellerId = product.seller.toString();

      const itemTotal = product.sellingPrice * item.quantity;
      subtotal += itemTotal;

      orderItems.push({
        product: product._id,
        productTitle: product.title,
        productImage: product.thumbnail,
        productSlug: product.slug,
        quantity: item.quantity,
        price: product.sellingPrice,
        total: itemTotal,
        variant: item.variant || {}
      });
    }

    // Calculate platform fee (10%) and seller earnings (90%)
    const platformFee = Math.round(subtotal * 0.10);
    const sellerEarnings = subtotal - platformFee;
    const totalAmount = subtotal + totalShipping;

    // Create order
    const order = new Order({
      customer: customerId,
      customerName,
      customerEmail,
      customerPhone: customerPhone || '',
      shippingAddress: {
        fullName: shippingAddress?.fullName || customerName,
        phone: shippingAddress?.phone || customerPhone || '',
        street: shippingAddress?.street || '',
        city: shippingAddress?.city || '',
        state: shippingAddress?.state || '',
        pincode: shippingAddress?.pincode || '',
        country: shippingAddress?.country || 'India'
      },
      seller: sellerId,
      sellerBusinessName: (await Seller.findById(sellerId))?.businessName || '',
      items: orderItems,
      subtotal,
      shippingCost: totalShipping,
      taxAmount: 0,
      discountAmount: 0,
      platformFee,
      sellerEarnings,
      totalAmount,
      paymentStatus: paymentMethod === 'cod' ? 'pending' : 'paid',
      paymentMethod,
      paymentDetails: paymentDetails || {},
      returnPolicyDays: 7,
      status: 'pending',
      statusHistory: [{
        status: 'pending',
        note: 'Order placed successfully',
        updatedBy: customerId,
        updatedByRole: 'CUSTOMER'
      }]
    });

    await order.save();

    // Update product sales stats
    for (const item of orderItems) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { totalSales: item.quantity, totalRevenue: item.total }
      });
    }

    // Update seller stats
    await Seller.findByIdAndUpdate(sellerId, {
      $inc: { totalOrders: 1, totalIncome: sellerEarnings }
    });

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      order: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        status: order.status,
        paymentStatus: order.paymentStatus
      }
    });

  } catch (error) {
    console.error('❌ Place Order Error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to place order'
    });
  }
});

// ====================== GET CUSTOMER ORDERS ======================
router.get('/my-orders/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      Order.find({ customer: customerId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('seller', 'businessName')
        .lean(),
      Order.countDocuments({ customer: customerId })
    ]);

    res.json({
      success: true,
      orders,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ====================== GET ORDER DETAILS (CUSTOMER) ======================
router.get('/detail/:orderId', async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate('seller', 'businessName')
      .lean();

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ====================== CANCEL ORDER (CUSTOMER) ======================
router.post('/cancel/:orderId', async (req, res) => {
  try {
    const { customerId, reason } = req.body;
    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.customer.toString() !== customerId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    if (!['pending', 'confirmed'].includes(order.status)) {
      return res.status(400).json({ success: false, message: 'Cannot cancel this order' });
    }

    order.status = 'cancelled';
    order.cancelledAt = new Date();
    order.cancelReason = reason || 'Cancelled by customer';
    order.statusHistory.push({
      status: 'cancelled',
      note: reason || 'Cancelled by customer',
      updatedBy: customerId,
      updatedByRole: 'CUSTOMER'
    });

    await order.save();

    // If paid, mark for refund (admin will process)
    if (order.paymentStatus === 'paid') {
      order.paymentStatus = 'refunded';
      order.paymentDetails.refundReason = 'Customer cancellation';
      await order.save();
    }

    res.json({ success: true, message: 'Order cancelled successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
