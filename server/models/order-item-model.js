module.exports = (sequelize, DataTypes) => {
  const OrderItem = sequelize.define('OrderItem', {
    orderItemId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    orderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Orders',
        key: 'orderId',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    menuId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'MenuItems',
        key: 'menuId',
      },
    },
    sizeId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'ItemSizes',
        key: 'sizeId',
      },
    },
    customCakeId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'CustomCakeOrders',
        key: 'customCakeId',
      },
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
      },
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    item_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    size_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  }, {
    tableName: 'OrderItems',
    timestamps: true,
    indexes: [
      {
        fields: ['orderId'],
      },
      {
        fields: ['menuId'],
      },
      {
        fields: ['customCakeId'],
      },
    ],
  });

  OrderItem.associate = (models) => {
    OrderItem.belongsTo(models.Order, { foreignKey: 'orderId' });
    OrderItem.belongsTo(models.MenuItem, { foreignKey: 'menuId' });
    OrderItem.belongsTo(models.ItemSize, { foreignKey: 'sizeId' });
    OrderItem.belongsTo(models.CustomCakeOrder, { foreignKey: 'customCakeId' });
  };

  return OrderItem;
};