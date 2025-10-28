const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./user-model");

const Inquiry = sequelize.define(
  "Inquiry",
  {
    inquiryId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userID: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: User,
        key: "userID",
      },
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isEmail: true,
      },
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    subject: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("Pending", "Replied"),
      defaultValue: "Pending",
      allowNull: false,
    },
    reply: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    repliedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    timestamps: true,
    tableName: "Inquiries",
  }
);

Inquiry.belongsTo(User, { foreignKey: "userID" });

module.exports = Inquiry;
