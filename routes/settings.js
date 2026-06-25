const express = require('express');
const router = express.Router();

// Models
let Seller;
try { Seller = require('../models/Seller'); } catch(e) { Seller = null; }

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

// ===================== SETTINGS PAGE (GET) =====================
// GET /seller/settings/ (mounted at /seller/settings in app.js)
router.get('/', requireSellerAuth, async (req, res) => {
  try {
    const seller = req.sellerData;

    res.render('sellerSettings', {
      title: 'Settings - SellerHub',
      seller: seller,
      success_msg: req.query.success || null,
      error_msg: req.query.error || null
    });
  } catch (err) {
    console.error('Settings GET error:', err);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load settings'
    });
  }
});

// ===================== UPDATE PROFILE =====================
// POST /seller/settings/profile
router.post('/profile', requireSellerAuth, async (req, res) => {
  try {
    const sellerId = req.sellerData._id;
    const {
      fullName, email, phone, businessName, businessType,
      address, city, state, pincode,
      gstNumber, panNumber,
      bankAccountName, bankAccountNumber, bankIfsc, bankName,
      storeDescription, returnPolicy
    } = req.body;

    const updateData = {};

    if (fullName) updateData.fullName = fullName.trim();
    if (email) updateData.email = email.trim().toLowerCase();
    if (phone) updateData.phone = phone.trim();
    if (businessName) updateData.businessName = businessName.trim();
    if (businessType) updateData.businessType = businessType;
    if (address) updateData.address = address.trim();
    if (city) updateData.city = city.trim();
    if (state) updateData.state = state.trim();
    if (pincode) updateData.pincode = pincode.trim();
    if (gstNumber) updateData.gstNumber = gstNumber.trim().toUpperCase();
    if (panNumber) updateData.panNumber = panNumber.trim().toUpperCase();
    if (bankAccountName) updateData.bankAccountName = bankAccountName.trim();
    if (bankAccountNumber) updateData.bankAccountNumber = bankAccountNumber.trim();
    if (bankIfsc) updateData.bankIfsc = bankIfsc.trim().toUpperCase();
    if (bankName) updateData.bankName = bankName.trim();
    if (storeDescription) updateData.storeDescription = storeDescription.trim();
    if (returnPolicy) updateData.returnPolicy = returnPolicy.trim();

    await Seller.findByIdAndUpdate(sellerId, updateData, { new: true });

    res.redirect('/seller/settings?success=Profile updated successfully');
  } catch (err) {
    console.error('Profile update error:', err);
    res.redirect('/seller/settings?error=Failed to update profile');
  }
});

// ===================== CHANGE PASSWORD =====================
// POST /seller/settings/password
router.post('/password', requireSellerAuth, async (req, res) => {
  try {
    const sellerId = req.sellerData._id;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.redirect('/seller/settings?error=All password fields are required');
    }

    if (newPassword.length < 6) {
      return res.redirect('/seller/settings?error=New password must be at least 6 characters');
    }

    if (newPassword !== confirmPassword) {
      return res.redirect('/seller/settings?error=New passwords do not match');
    }

    const seller = await Seller.findById(sellerId);
    if (!seller) {
      return res.redirect('/seller/settings?error=Seller not found');
    }

    if (!seller.password) {
      return res.redirect('/seller/settings?error=Password change not available for Google sign-in users');
    }

    const { createHmac } = require('crypto');
    const hashedCurrent = createHmac('sha256', seller.salt)
      .update(currentPassword)
      .digest('hex');

    if (hashedCurrent !== seller.password) {
      return res.redirect('/seller/settings?error=Current password is incorrect');
    }

    const newSalt = require('crypto').randomBytes(16).toString('hex');
    const hashedNew = createHmac('sha256', newSalt)
      .update(newPassword)
      .digest('hex');

    seller.password = hashedNew;
    seller.salt = newSalt;
    await seller.save();

    res.redirect('/seller/settings?success=Password changed successfully');
  } catch (err) {
    console.error('Password change error:', err);
    res.redirect('/seller/settings?error=Failed to change password');
  }
});

// ===================== UPDATE NOTIFICATIONS =====================
// POST /seller/settings/notifications
router.post('/notifications', requireSellerAuth, async (req, res) => {
  try {
    const sellerId = req.sellerData._id;
    const {
      emailNotifications, orderUpdates, paymentAlerts,
      marketingEmails, lowStockAlerts
    } = req.body;

    await Seller.findByIdAndUpdate(sellerId, {
      notifications: {
        email: emailNotifications === 'on',
        orderUpdates: orderUpdates === 'on',
        paymentAlerts: paymentAlerts === 'on',
        marketing: marketingEmails === 'on',
        lowStock: lowStockAlerts === 'on'
      }
    });

    res.redirect('/seller/settings?success=Notification preferences updated');
  } catch (err) {
    console.error('Notification update error:', err);
    res.redirect('/seller/settings?error=Failed to update notifications');
  }
});

// ===================== UPDATE STORE INFO =====================
// POST /seller/settings/store
router.post('/store', requireSellerAuth, async (req, res) => {
  try {
    const sellerId = req.sellerData._id;
    const { storeDescription, returnPolicy, shippingPolicy } = req.body;

    await Seller.findByIdAndUpdate(sellerId, {
      storeDescription: storeDescription?.trim(),
      returnPolicy: returnPolicy?.trim(),
      shippingPolicy: shippingPolicy?.trim()
    });

    res.redirect('/seller/settings?success=Store information updated');
  } catch (err) {
    console.error('Store update error:', err);
    res.redirect('/seller/settings?error=Failed to update store info');
  }
});

// ===================== DELETE ACCOUNT =====================
// POST /seller/settings/delete
router.post('/delete', requireSellerAuth, async (req, res) => {
  try {
    const sellerId = req.sellerData._id;
    const { confirmDelete, password } = req.body;

    if (confirmDelete !== 'DELETE MY ACCOUNT') {
      return res.redirect('/seller/settings?error=Please type DELETE MY ACCOUNT to confirm');
    }

    const seller = await Seller.findById(sellerId);
    if (seller.password && password) {
      const { createHmac } = require('crypto');
      const hashed = createHmac('sha256', seller.salt)
        .update(password)
        .digest('hex');

      if (hashed !== seller.password) {
        return res.redirect('/seller/settings?error=Incorrect password');
      }
    }

    await Seller.findByIdAndUpdate(sellerId, {
      isDeleted: true,
      deletedAt: new Date()
    });

    res.clearCookie('token');
    res.redirect('/?success=Your account has been deleted');
  } catch (err) {
    console.error('Account deletion error:', err);
    res.redirect('/seller/settings?error=Failed to delete account');
  }
});

// ===================== UPLOAD PROFILE IMAGE =====================
// POST /seller/settings/upload-avatar
router.post('/upload-avatar', requireSellerAuth, async (req, res) => {
  try {
    res.json({ success: true, message: 'Avatar upload endpoint ready' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
