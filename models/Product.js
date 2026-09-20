const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true },
    category: { type: String, default: 'Accessoires', trim: true },
    price: { type: Number, required: true, min: 0 },
    oldPrice: { type: Number, default: null, min: 0 },
    shortDescription: { type: String, default: '', maxlength: 220 },
    description: { type: String, default: '', maxlength: 5000 },
    specs: [{ _id: false, label: String, value: String }],
    images: [String], // images en base64 (data URI), comme sur la boutique précédente
    autonomyHours: { type: Number, default: null, min: 0, max: 72 },
    warranty: { type: String, default: '' },
    stock: { type: Number, default: 0, min: 0 },
    badge: { type: String, enum: ['', 'Nouveau', 'Promo'], default: '' },
    featured: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Product', productSchema);
