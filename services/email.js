const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.gmail.com",
  port: process.env.EMAIL_PORT || 587,
  secure: process.env.EMAIL_SECURE === "true",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

transporter.verify((error, success) => {
  if (error) {
    console.error("❌ Email transporter error:", error.message);
  } else {
    console.log("✅ Email transporter ready");
  }
});

// ====================== SEND OTP EMAIL ======================
const sendOTPEmail = async (email, otp) => {
  const mailOptions = {
    from: `"Shopp123" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Your Shopp123 Verification Code",
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
        <div style="background: white; border-radius: 16px; padding: 30px; text-align: center;">
          <h2 style="color: #667eea; margin-bottom: 10px;">Shopp123 Seller Verification</h2>
          <p style="color: #555; font-size: 16px;">Hello,</p>
          <p style="color: #555; font-size: 16px;">Your verification code is:</p>
          <div style="background: #f5f5f5; border: 3px dashed #667eea; border-radius: 8px; padding: 25px; margin: 20px 0;">
            <h1 style="font-size: 48px; letter-spacing: 15px; color: #333; margin: 0; font-family: 'Courier New', monospace; font-weight: bold;">${otp}</h1>
          </div>
          <p style="color: #888; font-size: 14px;">This code will expire in 5 minutes.</p>
          <p style="color: #888; font-size: 14px;">If you didn't request this, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">Shopp123 Team</p>
        </div>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 OTP email sent to ${email}: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`❌ Failed to send OTP email to ${email}:`, error.message);
    throw error;
  }
};

// ====================== SEND RESET PASSWORD EMAIL ======================
const sendResetPasswordEmail = async (email, resetLink) => {
  const mailOptions = {
    from: `"Shopp123" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Reset Your Shopp123 Password",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <h2 style="color: #667eea; text-align: center;">Password Reset Request</h2>
        <p style="font-size: 16px; color: #333;">Hello,</p>
        <p style="font-size: 16px; color: #333;">You requested to reset your password. Click the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="display: inline-block; padding: 14px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 50px; font-weight: 600;">Reset Password</a>
        </div>
        <p style="font-size: 14px; color: #666;">Or copy: <a href="${resetLink}" style="color: #667eea;">${resetLink}</a></p>
        <p style="font-size: 14px; color: #666;">This link expires in 30 minutes.</p>
        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">Shopp123 Team</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Reset email sent to ${email}: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`❌ Failed to send reset email to ${email}:`, error.message);
    throw error;
  }
};

// ====================== SEND APPROVAL STATUS EMAIL ======================
const sendApprovalEmail = async (email, sellerName, status) => {
  let subject, message, color;
  if (status === 'pending') {
    subject = "Registration Received - Pending Approval";
    color = "#f59e0b";
    message = `
      <p style="font-size: 16px; color: #333;">Thank you for registering as a seller on Shopp123!</p>
      <p style="font-size: 16px; color: #333;">Your application has been received and is currently under review by our admin team.</p>
      <p style="font-size: 16px; color: #333;">You will receive another email once your account is approved.</p>
    `;
  } else if (status === 'approved') {
    subject = "🎉 Your Seller Account is Approved!";
    color = "#10b981";
    message = `
      <p style="font-size: 16px; color: #333;">Congratulations! Your seller account has been approved.</p>
      <p style="font-size: 16px; color: #333;">You can now log in to your dashboard and start listing products.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="https://shopp123.onrender.com/seller/signin" style="display: inline-block; padding: 14px 30px; background: #10b981; color: white; text-decoration: none; border-radius: 50px; font-weight: 600;">Go to Dashboard</a>
      </div>
    `;
  } else if (status === 'rejected') {
    subject = "Seller Account Application Update";
    color = "#ef4444";
    message = `
      <p style="font-size: 16px; color: #333;">We regret to inform you that your seller application could not be approved at this time.</p>
      <p style="font-size: 16px; color: #333;">Please contact our support team for more information.</p>
    `;
  }

  const mailOptions = {
    from: `"Shopp123" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <h2 style="color: ${color}; text-align: center;">Shopp123 Seller ${status === 'approved' ? 'Approval' : 'Update'}</h2>
        <p style="font-size: 16px; color: #333;">Hello ${sellerName},</p>
        ${message}
        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">Shopp123 Team</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Approval email (${status}) sent to ${email}: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`❌ Failed to send approval email to ${email}:`, error.message);
    throw error;
  }
};

module.exports = {
  sendOTPEmail,
  sendResetPasswordEmail,
  sendApprovalEmail,
};
