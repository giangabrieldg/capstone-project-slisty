module.exports = (sequelize, DataTypes) => {
  const ItemSize = sequelize.define('ItemSize', {
    sizeId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    menuId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    sizeName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    }
  });

  return ItemSize;
};