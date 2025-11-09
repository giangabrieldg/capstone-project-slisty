module.exports = (sequelize, DataTypes) => {
  const CakeOption = sequelize.define(
    "CakeOption",
    {
      optionId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      category: {
        type: DataTypes.STRING(50),
        allowNull: false,
        validate: {
          notEmpty: true,
          isIn: [
            [
              "sizes",
              "flavors",
              "icingStyles",
              "icingColors",
              "fillings",
              "borders_bottom",
              "borders_top",
              "decorations",
              "flowerTypes",
            ],
          ],
        },
      },
      optionValue: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      optionName: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      isDisabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      displayOrder: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
    },
    {
      tableName: "cake_disabled_options",
      indexes: [
        {
          unique: true,
          fields: ["category", "optionValue"],
        },
      ],
      hooks: {
        beforeCreate: (cakeOption) => {
          if (!cakeOption.displayOrder) {
            cakeOption.displayOrder = 0;
          }
        },
      },
    }
  );

  return CakeOption;
};
