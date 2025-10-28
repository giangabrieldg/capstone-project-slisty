// menu-item-model.js (updated)
module.exports = (sequelize, DataTypes) => {
  const MenuItem = sequelize.define("MenuItem", {
    menuId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    category: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
    },
    image: {
      type: DataTypes.STRING,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    hasSizes: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    basePrice: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.0,
    },
    stock: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
  });

  return MenuItem;
};
