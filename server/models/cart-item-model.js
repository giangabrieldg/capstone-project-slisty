module.exports = (sequelize, DataTypes) => {
  const CartItem = sequelize.define('CartItem', {
    cartItemId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    cartId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    menuId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    size: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  });
  return CartItem;
};