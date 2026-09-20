const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    productName: { type: String, required: true },
    unitPrice: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    total: { type: Number, required: true },
    nom: { type: String, required: true, trim: true, maxlength: 60 },
    prenom: { type: String, required: true, trim: true, maxlength: 60 },
    telephone: { type: String, required: true, trim: true, maxlength: 25 },
    adresse: { type: String, required: true, trim: true, maxlength: 250 },
    note: { type: String, default: '', maxlength: 300 },
    statut: { type: String, enum: ['en_cours', 'effectuee', 'annulee'], default: 'en_cours' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
