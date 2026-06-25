const JWT = require('jsonwebtoken');
const secret = process.env.JWT_SECRET || "your-secret-key-change-this-in-production";

// Create token for any user (including sellers)
function creatTokenForUser(user) {
    const payload = {
        _id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role || 'SELLER',
        profileImageURL: user.profileImageURL
    };
    
    const token = JWT.sign(payload, secret, { expiresIn: '7d' });
    return token;
}

// Verify token and return decoded payload
function verifyToken(token) {
    try {
        const decoded = JWT.verify(token, secret);
        return decoded;
    } catch (error) {
        console.error("❌ Token verification failed:", error.message);
        return null;
    }
}

module.exports = {
    creatTokenForUser,
    verifyToken
};
