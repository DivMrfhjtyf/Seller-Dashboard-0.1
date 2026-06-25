const { verifyToken } = require("../services/authentication");

const checkForAuthenticationCookie = (cookieName) => {
  return (req, res, next) => {
    const token = req.cookies[cookieName];
    if (!token) {
      req.user = null;  // kept as 'req.user' — this is Passport's standard property name
      return next();
    }

    try {
      const seller = verifyToken(token);  // fixed: was 'const user'
      req.user = seller;  // fixed: was 'req.user = user' — assigns seller object to Passport's req.user
    } catch (error) {
      req.user = null;
    }
    next();
  };
};

// Restrict to Logged-in Sellers Only
const restrictToLoggedInSellerOnly = (req, res, next) => {  // fixed: was 'restrictToLoggedInUserOnly'
  if (!req.user) {
    return res.redirect("/seller/signin");  // fixed: was "/user/signin"
  }
  next();
};

// Restrict to Admin Only
const restrictTo = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.redirect("/seller/signin");  // fixed: was "/user/signin"
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).send("Access Denied: Admins Only");
    }
    next();
  };
};

module.exports = {
  checkForAuthenticationCookie,
  restrictTo,
  restrictToLoggedInSellerOnly  // fixed: was 'restrictToLoggedInUserOnly'
};