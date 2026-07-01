const Admin = require('../models/Admin');
const { verifyToken } = require('../services/authentication');

/**
 * Unified admin authentication middleware
 * - Supports JWT cookie auth (preferred)
 * - Falls back to session-based adminId when cookie is not present/invalid
 * - Attaches req.admin (full Admin doc when from session, decoded token when from cookie)
 */
const isAdminAuth = async (req, res, next) => {
  try {
    // Try JWT cookie first
    const token = req.cookies?.token;

    if (token) {
      try {
        const decoded = verifyToken(token);
        if (decoded && (decoded.role === 'SUPER_ADMIN' || decoded.role === 'ADMIN')) {
          // Attach decoded token (partial admin info)
          req.admin = decoded;
          res.locals.admin = decoded;
          req.session = req.session || {};
          req.session.adminId = decoded._id || decoded.id;
          return next();
        }
        // If token present but not an admin role, clear token and fall through to session
        res.clearCookie('token', { path: '/' });
      } catch (err) {
        // Invalid token - clear cookie and try session fallback
        res.clearCookie('token', { path: '/' });
      }
    }

    // Session fallback
    if (req.session?.adminId) {
      const admin = await Admin.findById(req.session.adminId).select('-password -salt');
      if (!admin || admin.isDeleted) {
        return res.status(401).json({ success: false, message: 'Admin not found or inactive' });
      }
      req.admin = admin;
      res.locals.admin = admin;
      return next();
    }

    // If this is a browser render route, redirect to admin login; many admin routes expect JSON.
    // Heuristic: if Accept header prefers html, redirect; otherwise return JSON 401.
    const accept = req.get('Accept') || '';
    if (accept.includes('html')) {
      req.flash?.('error', 'Please login as admin');
      return res.redirect('/admin/login');
    }

    return res.status(401).json({ success: false, message: 'Authentication required' });
  } catch (error) {
    console.error('isAdminAuth error:', error);
    res.clearCookie('token', { path: '/' });
    return res.status(500).json({ success: false, message: 'Authentication error' });
  }
};

/**
 * Permission checker for admin routes
 * Usage: checkPermission(['manage_sellers'])
 */
const checkPermission = (requiredPermissions = []) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    // If decoded token was attached (not full Admin doc), permissions may not be present.
    const role = req.admin.role || (req.admin.toObject && req.admin.toObject().role);
    if (role === 'SUPER_ADMIN') return next();

    const permissions = Array.isArray(req.admin.permissions) ? req.admin.permissions : (req.admin.permissions || []);

    if (!requiredPermissions || requiredPermissions.length === 0) return next();

    const hasPermission = requiredPermissions.some(p => permissions.includes(p));
    if (!hasPermission) {
      // If request expects HTML, redirect with flash
      const accept = req.get('Accept') || '';
      if (accept.includes('html')) {
        req.flash?.('error', 'You do not have permission for this action');
        return res.redirect('/admin');
      }

      return res.status(403).json({ success: false, message: 'You do not have permission for this action' });
    }

    next();
  };
};

module.exports = {
  isAdminAuth,
  checkPermission
};
