module.exports = (sequelize, DataTypes) => {
  const Cart = sequelize.define("Cart", {
    cartId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userID: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  });
  return Cart;
};
