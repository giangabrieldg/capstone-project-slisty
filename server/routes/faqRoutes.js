const express = require('express');
const router = express.Router();
const Faq = require('../models/faq-model');

// Get all FAQs
router.get('/', async (req, res) => {
  try {
    const faqs = await Faq.findAll();
    res.json(faqs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch FAQs' });
  }
});

// Create a new FAQ
router.post('/', async (req, res) => {
  try {
    const { question, answer } = req.body;
    const faq = await Faq.create({ question, answer });
    res.status(201).json(faq);
  } catch (error) {
    res.status(400).json({ error: 'Failed to create FAQ' });
  }
});

// Update an FAQ
router.put('/:question', async (req, res) => {
  try {
    const { question, answer } = req.body;
    const existingFaq = await Faq.findOne({ where: { question: req.params.question } });
    if (!existingFaq) {
      return res.status(404).json({ error: 'FAQ not found' });
    }
    await existingFaq.update({ question, answer });
    res.json(existingFaq);
  } catch (error) {
    res.status(400).json({ error: 'Failed to update FAQ' });
  }
});

// Delete an FAQ
router.delete('/:question', async (req, res) => {
  try {
    const faq = await Faq.findOne({ where: { question: req.params.question } });
    if (!faq) {
      return res.status(404).json({ error: 'FAQ not found' });
    }
    await faq.destroy();
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: 'Failed to delete FAQ' });
  }
});

module.exports = router;