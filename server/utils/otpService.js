const crypto = require("crypto");
const OTP = require("../models/otp-model");
const { sendOTPEmail } = require("./sendEmail");

class OTPService {
  // Generate a 6-digit OTP code
  static generateCode() {
    return crypto.randomInt(100000, 999999).toString();
  }

  // Create and send OTP
  static async createAndSendOTP(user, type = "login", browserId) {
    try {
      console.log(
        `Creating OTP for user: ${user.email}, browser: ${browserId}`
      );

      // Invalidate any existing OTPs for this user and browser
      await OTP.update(
        { isUsed: true },
        {
          where: {
            userID: user.userID,
            browserId: browserId,
            type: type,
            isUsed: false,
          },
        }
      );

      const code = this.generateCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      console.log(`Generated OTP: ${code}, expires at: ${expiresAt}`);

      const otp = await OTP.create({
        userID: user.userID,
        code: code,
        type: type,
        expiresAt: expiresAt,
        browserId: browserId,
      });

      console.log(`OTP created in database with ID: ${otp.otpID}`);

      // Send OTP via email
      await sendOTPEmail(user.email, code, user.name);

      console.log(`OTP email sent to: ${user.email}`);

      return otp;
    } catch (error) {
      console.error("Error creating OTP:", error);
      throw new Error("Failed to create OTP");
    }
  }

  // Verify OTP
  static async verifyOTP(userID, code, browserId, type = "login") {
    try {
      console.log(
        `Verifying OTP - UserID: ${userID}, Code: ${code}, Browser: ${browserId}, Type: ${type}`
      );

      const otp = await OTP.findOne({
        where: {
          userID: userID,
          code: code,
          browserId: browserId,
          type: type,
          isUsed: false,
        },
      });

      console.log(
        "Found OTP record:",
        otp
          ? {
              id: otp.otpID,
              code: otp.code,
              expiresAt: otp.expiresAt,
              isUsed: otp.isUsed,
              attempts: otp.attempts,
            }
          : "No OTP found"
      );

      if (!otp) {
        // Check if there are any OTPs for this user/browser to understand why it failed
        const existingOTPs = await OTP.findAll({
          where: {
            userID: userID,
            browserId: browserId,
            type: type,
          },
          order: [["createdAt", "DESC"]],
          limit: 5,
        });

        console.log(
          "Recent OTPs for this user/browser:",
          existingOTPs.map((otp) => ({
            id: otp.otpID,
            code: otp.code,
            expiresAt: otp.expiresAt,
            isUsed: otp.isUsed,
            attempts: otp.attempts,
            createdAt: otp.createdAt,
          }))
        );

        // Increment attempts if OTP exists but is invalid
        const latestOTP = existingOTPs[0];
        if (latestOTP && !latestOTP.isUsed) {
          await latestOTP.increment("attempts");
          console.log(
            `Incremented attempts for OTP ${latestOTP.otpID} to ${
              latestOTP.attempts + 1
            }`
          );

          // If too many attempts, mark as used
          if (latestOTP.attempts >= 4) {
            // 5th attempt will trigger this
            await latestOTP.update({ isUsed: true });
            console.log(
              `Marked OTP ${latestOTP.otpID} as used due to too many attempts`
            );
          }
        }

        return { isValid: false, message: "Invalid or expired OTP code" };
      }

      // Check if OTP is expired
      const now = new Date();
      if (otp.expiresAt < now) {
        console.log(`OTP expired. Current: ${now}, Expires: ${otp.expiresAt}`);
        await otp.update({ isUsed: true });
        return { isValid: false, message: "OTP code has expired" };
      }

      // Check if too many attempts
      if (otp.attempts >= 5) {
        console.log(`Too many attempts: ${otp.attempts}`);
        await otp.update({ isUsed: true });
        return { isValid: false, message: "Too many failed OTP attempts" };
      }

      console.log(`OTP is valid! Marking as used.`);

      // Mark OTP as used
      await otp.update({ isUsed: true });

      return { isValid: true, otp: otp };
    } catch (error) {
      console.error("Error verifying OTP:", error);
      throw new Error("Failed to verify OTP");
    }
  }

  // Clean up expired OTPs
  static async cleanupExpiredOTPs() {
    try {
      const result = await OTP.destroy({
        where: {
          expiresAt: {
            $lt: new Date(),
          },
        },
      });
      console.log(`Cleaned up ${result} expired OTPs`);
    } catch (error) {
      console.error("Error cleaning up expired OTPs:", error);
    }
  }
}

module.exports = OTPService;
