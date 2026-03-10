const { createTransporter } = require("../config/email");
const {
  getEmailVerificationTemplate,
  getPasswordResetTemplate,
  getWelcomeEmailTemplate,
} = require("./emailTemplates");

const sendEmail = async ({ to, subject, html }) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || "SocialApp"}" <${
        process.env.EMAIL_USER
      }>`,
      to,
      subject,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Email send error:", error);
    return { success: false, error: error.message };
  }
};

const sendVerificationEmail = async (email, username, verificationToken) => {
  const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
  const html = getEmailVerificationTemplate(username, verificationLink);

  return await sendEmail({
    to: email,
    subject: "Verify Your Email - SocialApp",
    html,
  });
};

const sendPasswordResetEmail = async (email, username, resetToken) => {
  const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  const html = getPasswordResetTemplate(username, resetLink);

  return await sendEmail({
    to: email,
    subject: "Reset Your Password - SocialApp",
    html,
  });
};

const sendWelcomeEmail = async (email, username) => {
  const html = getWelcomeEmailTemplate(username);

  return await sendEmail({
    to: email,
    subject: "Welcome to SocialApp!",
    html,
  });
};

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
};
