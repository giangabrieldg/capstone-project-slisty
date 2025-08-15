module.exports = (sequelize, DataTypes) => {
  const Order = sequelize.define('Order', {
    orderId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userID: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'userID'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    },
    total_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0
      }
    },
    status: {
      type: DataTypes.ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled'),
      defaultValue: 'pending',
    },
    payment_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    payment_verified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    items: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    delivery_method: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: [['pickup', 'delivery']]
      }
    },
    pickup_date: {
        type: DataTypes.DATEONLY, // Store date only (YYYY-MM-DD)
        allowNull: true
    },
    payment_method: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: [['cash', 'gcash']]
      }
    },
    customer_name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    customer_email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isEmail: true
      }
    },
    customer_phone: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    delivery_address: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        deliveryAddressRequired(value) {
          if (this.delivery_method === 'delivery' && !value) {
            throw new Error('Delivery address is required for delivery orders');
          }
        }
      }
    }
  }, {
    tableName: 'Orders',
    timestamps: true,
    indexes: [
      {
        fields: ['userID']
      },
      {
        fields: ['status']
      },
      {
        fields: ['payment_verified']
      }
    ]
  });

  Order.associate = (models) => {
    Order.belongsTo(models.User, { foreignKey: 'userID', as: 'user' });
    Order.hasMany(models.OrderItem, { foreignKey: 'orderId', as: 'orderItems' });
  };

  return Order;
};