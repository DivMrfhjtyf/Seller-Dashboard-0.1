const Seller = require('../models/Seller');
const { verifyToken } = require('../services/authentication');

// ─── Check if seller is logged in ───
// Supports BOTH session auth AND JWT cookie auth
const isSellerAuth = async (req, res, next) => {
  try {
    let sellerId = null;
    let seller = null;

    // ─── Try JWT Cookie first ───
    const token = req.cookies?.token;
    if (token) {
      try {
        const decoded = verifyToken(token);
        if (decoded) {
          sellerId = decoded._id || decoded.id;
          // Fetch full seller data from DB
          seller = await Seller.findById(sellerId).select('-password');
        }
      } catch (jwtErr) {
        // JWT invalid, try session next
      }
    }

    // ─── Fallback to Session ───
    if (!seller && req.session?.sellerId) {
      sellerId = req.session.sellerId;
      seller = await Seller.findById(sellerId).select('-password');
    }

    // ─── No auth found ───
    if (!seller) {
      req.flash('error', 'Please login as a seller to access this page');
      return res.redirect('/seller/signin');
    }

    // ─── Check account status ───
    if (seller.status === 'suspended') {
      res.clearCookie('token', { path: '/' });
      req.session?.destroy?.();
      req.flash('error', 'Your seller account has been suspended. Contact support.');
      return res.redirect('/seller/signin');
    }

    if (seller.status === 'rejected') {
      res.clearCookie('token', { path: '/' });
      req.session?.destroy?.();
      req.flash('error', 'Your seller application was rejected.');
      return res.redirect('/seller/signin');
    }

    // ─── Attach seller to request ───
    req.seller = seller;
    req.session.sellerId = seller._id.toString();
    res.locals.seller = seller;
    next();
  } catch (err) {
    console.error('Auth Middleware Error:', err);
    req.flash('error', 'Authentication failed');
    res.redirect('/seller/signin');
  }
};

// ─── Check if seller is verified/active ───
const isSellerVerified = async (req, res, next) => {
  try {
    // Run auth first
    await new Promise((resolve, reject) => {
      isSellerAuth(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const seller = req.seller;

    if (!seller || seller.verificationStatus !== 'Approved') {
      req.flash('error', 'Your seller account is pending verification. Please wait for approval.');
      return res.redirect('/seller/pending');
    }

    next();
  } catch (err) {
    console.error('Verified Auth Error:', err);
    req.flash('error', 'Authentication failed');
    res.redirect('/seller/signin');
  }
};

// ─── Check if admin is logged in ───
const isAdminAuth = (req, res, next) => {
  // Try JWT first
  const token = req.cookies?.token;
  if (token) {
    try {
      const decoded = verifyToken(token);
      if (decoded && decoded.role === 'ADMIN') {
        req.seller = decoded;
        res.locals.seller = decoded;
        return next();
      }
    } catch (e) {
      // Invalid token
    }
  }

  // Fallback to session
  if (!req.session?.adminId) {
    req.flash('error', 'Please login as admin');
    return res.redirect('/admin/login');
  }
  res.locals.admin = req.session.admin;
  next();
};

// ─── Check if user is logged in (for customers) ───
const isUserAuth = (req, res, next) => {
  if (!req.session?.userId) {
    req.flash('error', 'Please login to continue');
    return res.redirect('/login');
  }
  res.locals.user = req.session.user;
  next();
};

// ─── Guest only (redirect if logged in) ───
const isGuest = (req, res, next) => {
  // Check JWT
  const token = req.cookies?.token;
  if (token) {
    try {
      const decoded = verifyToken(token);
      if (decoded) {
        return res.redirect('/seller/dashboard');
      }
    } catch (e) {
      // Invalid token, continue as guest
    }
  }

  // Check session
  if (req.session?.sellerId) {
    return res.redirect('/seller/dashboard');
  }
  if (req.session?.userId) {
    return res.redirect('/');
  }
  next();
};

module.exports = {
  isSellerAuth,
  isSellerVerified,
  isAdminAuth,
  isUserAuth,
  isGuest
};
