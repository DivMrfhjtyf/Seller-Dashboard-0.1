const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password) => {
  return password.length >= 6;
};

const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return input
    .replace(/[<>">]/g, '')
    .trim()
    .substring(0, 5000); // Limit length
};

// Optional: Add seller role validation
const validateSellerRole = (role) => {
  return ['SELLER', 'ADMIN'].includes(role);
};

module.exports = {
  validateEmail,
  validatePassword,
  sanitizeInput,
  validateSellerRole  // optional addition
};