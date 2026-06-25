const { verifyToken } = require('../services/authentication');

// Check if seller is logged in via JWT cookie
const isSellerAuth = (req, res, next) => {
    const token = req.cookies['token'];

    if (!token) {
        req.flash('error', 'Please login first');
        return res.redirect('/seller/signin');
    }

    try {
        const decoded = verifyToken(token);
        if (!decoded) {
            res.clearCookie('token', { path: '/' });
            req.flash('error', 'Session expired. Please login again');
            return res.redirect('/seller/signin');
        }

        // Set both req.seller and req.session.sellerId for compatibility
        req.seller = decoded;
        req.session.sellerId = decoded._id || decoded.id;
        next();
    } catch (error) {
        res.clearCookie('token', { path: '/' });
        req.flash('error', 'Invalid session. Please login again');
        return res.redirect('/seller/signin');
    }
};

// Check if user is admin
const isAdmin = (req, res, next) => {
    if (!req.seller || req.seller.role !== 'ADMIN') {
        return res.status(403).send("Access Denied: Admins Only");
    }
    next();
};

// Optional auth - sets req.seller if available, doesn't redirect
const optionalAuth = (req, res, next) => {
    const token = req.cookies['token'];

    if (token) {
        try {
            const decoded = verifyToken(token);
            req.seller = decoded || null;
            if (decoded) {
                req.session.sellerId = decoded._id || decoded.id;
            }
        } catch (error) {
            req.seller = null;
        }
    }
    next();
};

module.exports = { isSellerAuth, isAdmin, optionalAuth };
