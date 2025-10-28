module.exports = (sequelize, DataTypes) => {
  const CartItem = sequelize.define(
    "CartItem",
    {
      cartItemId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      cartId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Carts",
          key: "cartId",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      menuId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "MenuItems",
          key: "menuId",
        },
      },
      customCakeId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "CustomCakeOrders",
          key: "customCakeId",
        },
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          min: 1,
        },
      },
      size: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      tableName: "CartItems",
      timestamps: true,
      indexes: [
        {
          fields: ["cartId"],
        },
        {
          fields: ["menuId"],
        },
        {
          fields: ["customCakeId"],
        },
      ],
    }
  );

  CartItem.associate = (models) => {
    CartItem.belongsTo(models.Cart, { foreignKey: "cartId" });
    CartItem.belongsTo(models.MenuItem, { foreignKey: "menuId" });
    CartItem.belongsTo(models.CustomCakeOrder, { foreignKey: "customCakeId" });
  };

  return CartItem;
};
