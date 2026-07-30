import nodemailer from "nodemailer";

let transporter;

const getTransporter = async () => {
  if (transporter) return transporter;

  if (process.env.NODE_ENV === "test") {
    transporter = {
      sendMail: async (options) => {
        return { messageId: "mock-id-" + Date.now() };
      },
    };
    return transporter;
  }

  // Use environmental SMTP settings if provided
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587", 10),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    // Local mock development using Nodemailer Ethereal testing service
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log(`[Email Service] Ethereal mailer account created successfully. User: ${testAccount.user}`);
    } catch (err) {
      console.error("[Email Service] Failed to create Ethereal account, falling back to console logging: ", err.message);
      // fallback mock logger
      transporter = {
        sendMail: async (options) => {
          console.log("\n================ MOCK EMAIL REGISTERED ================");
          console.log(`To: ${options.to}`);
          console.log(`Subject: ${options.subject}`);
          console.log(`Body: ${options.text}`);
          console.log("========================================================\n");
          return { messageId: "mock-id-" + Date.now() };
        },
      };
    }
  }

  return transporter;
};

export const sendVerificationEmail = async (email, token) => {
  const mailer = await getTransporter();
  const verificationLink = `${process.env.CLIENT_URL || "http://localhost:5173"}/verify-email?token=${token}`;
  
  const options = {
    from: `"QuickChat Team" <no-reply@quickchat.dev>`,
    to: email,
    subject: "Verify Your Email Address - QuickChat",
    text: `Welcome to QuickChat! Please verify your email by clicking: ${verificationLink}`,
    html: `
      <div style="font-family: sans-serif; padding: 20px; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 8px;">
        <h2 style="color: #6366f1;">Welcome to QuickChat!</h2>
        <p>Thank you for signing up. Please verify your email address to unlock all premium chat features.</p>
        <div style="margin: 24px 0;">
          <a href="${verificationLink}" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">Verify Email</a>
        </div>
        <p style="font-size: 12px; color: #666; margin-top: 30px;">If the button doesn't work, copy and paste this link in your browser:<br/> <a href="${verificationLink}">${verificationLink}</a></p>
      </div>
    `,
  };

  const info = await mailer.sendMail(options);
  if (info.messageId && info.messageId.startsWith("mock-id-") === false) {
    console.log(`[Email Service] Verification link sent. Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
  }
  return info;
};

export const sendPasswordResetEmail = async (email, token) => {
  const mailer = await getTransporter();
  const resetLink = `${process.env.CLIENT_URL || "http://localhost:5173"}/reset-password?token=${token}`;

  const options = {
    from: `"QuickChat Team" <no-reply@quickchat.dev>`,
    to: email,
    subject: "Reset Your Password - QuickChat",
    text: `You requested a password reset. Please reset it here: ${resetLink}`,
    html: `
      <div style="font-family: sans-serif; padding: 20px; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 8px;">
        <h2 style="color: #ef4444;">Reset Your Password</h2>
        <p>We received a request to reset your password. If you didn't request this, you can ignore this email.</p>
        <div style="margin: 24px 0;">
          <a href="${resetLink}" style="background-color: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">Reset Password</a>
        </div>
        <p style="font-size: 12px; color: #666; margin-top: 30px;">If the button doesn't work, copy and paste this link in your browser:<br/> <a href="${resetLink}">${resetLink}</a></p>
      </div>
    `,
  };

  const info = await mailer.sendMail(options);
  if (info.messageId && info.messageId.startsWith("mock-id-") === false) {
    console.log(`[Email Service] Password reset link sent. Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
  }
  return info;
};
