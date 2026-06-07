// lib/models.js — Mongoose schemas
const mongoose = require('mongoose');

// PortfolioData: stores the single config document (upserted on every save)
const portfolioDataSchema = new mongoose.Schema({
  _id: { type: String, default: 'portfolio_config' },
  data: { type: mongoose.Schema.Types.Mixed, required: true },
  updatedAt: { type: Date, default: Date.now }
}, { _id: false });

// Message: stores contact form submissions
const messageSchema = new mongoose.Schema({
  messageId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  subject: { type: String, default: 'No Subject' },
  message: { type: String, required: true },
  date: { type: Date, default: Date.now }
});

// Only register models once (needed in serverless hot-reload)
const PortfolioData = mongoose.models.PortfolioData
  || mongoose.model('PortfolioData', portfolioDataSchema, 'portfolio_data');

const Message = mongoose.models.Message
  || mongoose.model('Message', messageSchema, 'messages');

module.exports = { PortfolioData, Message };
