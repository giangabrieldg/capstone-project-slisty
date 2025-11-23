const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const OTP = sequelize.define(
  "OTP",
  {
    otpID: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userID: {
      type: DataTypes.INTEGER, // Changed to INTEGER to match Users table
      allowNull: false,
      references: {
        model: "Users",
        key: "userID",
      },
    },
    code: {
      type: DataTypes.STRING(6),
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM("login", "password_reset", "email_verification"),
      allowNull: false,
      defaultValue: "login",
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    attempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    isUsed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    browserId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    sessionToken: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "OTPs",
    timestamps: true,
  }
);

module.exports = OTP;
