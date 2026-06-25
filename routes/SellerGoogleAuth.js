const { Router } = require("express");
const passport = require("passport");
const Seller = require("../models/Seller");
const { creatTokenForUser } = require("../services/authentication");

const router = Router();

const GoogleStrategy = require("passport-google-oauth20").Strategy;

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
        "google-seller",
        new GoogleStrategy(
            {
                clientID: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                callbackURL: process.env.GOOGLE_SELLER_CALLBACK_URL || "https://shopp123.onrender.com/seller/auth/google/callback",
            },
            async (accessToken, refreshToken, profile, done) => {
                try {
                    const seller = await Seller.findOrCreateGoogleSeller(profile);
                    return done(null, seller);
                } catch (err) {
                    console.error("❌ Google Strategy Error:", err.message);
                    return done(err, null);
                }
            }
        )
    );
}

// No session needed - we use JWT cookies
passport.serializeUser((seller, done) => done(null, seller._id));
passport.deserializeUser(async (id, done) => {
    try {
        const seller = await Seller.findById(id);
        done(null, seller);
    } catch (err) {
        done(err, null);
    }
});

// Step 1: Redirect to Google
router.get("/auth/google", passport.authenticate("google-seller", { 
    scope: ["profile", "email"],
    session: false 
}));

// Step 2: Google redirects back here
router.get("/auth/google/callback",
    (req, res, next) => {
        passport.authenticate("google-seller", { session: false }, (err, seller, info) => {
            if (err) {
                console.error("❌ Google Auth Error:", err.message);
                return res.redirect("/seller/signin?error=google_auth_failed");
            }
            
            if (!seller) {
                console.error("❌ No seller returned from Google");
                return res.redirect("/seller/signin?error=no_seller_data");
            }

            try {
                // Generate JWT token
                const token = creatTokenForUser(seller);

                // CRITICAL: Set cookie with correct settings for Render
                // Render uses HTTPS in production, but check NODE_ENV
                const isProduction = process.env.NODE_ENV === "production";
                
                res.cookie("token", token, {
                    httpOnly: true,
                    secure: true,           // Render always uses HTTPS
                    sameSite: "none",         // Required for cross-site OAuth
                    maxAge: 7 * 24 * 60 * 60 * 1000,
                    path: "/"
                });
                
                // Google users are auto-approved - go directly to dashboard
                return res.redirect("/seller/dashboard");
                
            } catch (tokenError) {
                console.error("❌ Token creation error:", tokenError.message);
                return res.redirect("/seller/signin?error=token_error");
            }
        })(req, res, next);
    }
);

module.exports = router;
