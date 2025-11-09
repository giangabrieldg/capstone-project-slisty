const express = require("express");
const router = express.Router();
const { CakeOption, sequelize } = require("../models"); // Import sequelize from models

// Get all cake options for admin
router.get("/admin/cake-options", async (req, res) => {
  try {
    const options = await CakeOption.findAll({
      order: [
        ["category", "ASC"],
        ["displayOrder", "ASC"],
        ["optionName", "ASC"],
      ],
    });

    // Group by category for frontend
    const groupedOptions = options.reduce((acc, option) => {
      if (!acc[option.category]) {
        acc[option.category] = [];
      }
      acc[option.category].push({
        category: option.category,
        option_value: option.optionValue,
        option_name: option.optionName,
        is_disabled: option.isDisabled,
        display_order: option.displayOrder,
      });
      return acc;
    }, {});

    res.json({ success: true, data: groupedOptions });
  } catch (error) {
    console.error("Error fetching cake options:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Update cake options
router.post("/admin/cake-options", async (req, res) => {
  // Get sequelize instance from the model
  const transaction = await sequelize.transaction();

  try {
    const { updates } = req.body;

    if (updates && updates.length > 0) {
      for (const update of updates) {
        const { category, option_value, option_name, is_disabled } = update;

        // Upsert operation
        await CakeOption.upsert(
          {
            category: category,
            optionValue: option_value,
            optionName: option_name,
            isDisabled: is_disabled,
          },
          {
            transaction,
            conflictFields: ["category", "optionValue"],
          }
        );
      }
    } else {
      // Reset all options to enabled if no updates provided
      await CakeOption.update(
        { isDisabled: false },
        { where: {}, transaction }
      );
    }

    await transaction.commit();
    res.json({ success: true, message: "Cake options updated successfully" });
  } catch (error) {
    await transaction.rollback();
    console.error("Error updating cake options:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Get disabled options for customers
router.get("/cake/available-options", async (req, res) => {
  try {
    const disabledOptions = await CakeOption.findAll({
      where: {
        isDisabled: true,
      },
      attributes: ["category", "optionValue"],
    });

    res.json({
      success: true,
      data: disabledOptions.map((opt) => ({
        category: opt.category,
        option_value: opt.optionValue,
      })),
    });
  } catch (error) {
    console.error("Error fetching available options:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

module.exports = router;
