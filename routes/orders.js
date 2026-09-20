const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const auth = require('../middleware/auth');
const wrap = require('../middleware/wrap');
const Order = require('../models/Order');
const Product = require('../models/Product');

const router = express.Router();

const orderLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Trop de commandes depuis cet appareil. Réessaie plus tard.' },
});

const str = (v, max) => String(v ?? '').trim().slice(0, max);

async function newReference() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let t = 0; t < 10; t++) {
    let ref = 'HE-';
    const bytes = crypto.randomBytes(6);
    for (let i = 0; i < 6; i++) ref += alphabet[bytes[i] % alphabet.length];
    if (!(await Order.exists({ reference: ref }))) return ref;
  }
  throw new Error('Impossible de générer une référence.');
}

// Commande passée par un client depuis la page produit
router.post('/', orderLimiter, wrap(async (req, res) => {
  const b = req.body || {};
  const nom = str(b.nom, 60);
  const prenom = str(b.prenom, 60);
  const telephone = str(b.telephone, 25);
  const adresse = str(b.adresse, 250);
  const note = str(b.note, 300);

  if (!nom || !prenom || !telephone || !adresse) {
    return res.status(400).json({ message: 'Nom, prénom, téléphone et adresse de livraison sont obligatoires.' });
  }
  if (!/^[+0-9 ().-]{8,25}$/.test(telephone)) {
    return res.status(400).json({ message: 'Numéro de téléphone invalide.' });
  }

  const quantity = Math.min(20, Math.max(1, parseInt(b.quantity, 10) || 1));
  const product = mongoose.isValidObjectId(b.productId)
    ? await Product.findById(b.productId).select('name price stock')
    : null;
  if (!product) return res.status(404).json({ message: 'Produit introuvable.' });
  if (product.stock <= 0) return res.status(409).json({ message: 'Ce produit est actuellement épuisé.' });

  const order = await Order.create({
    reference: await newReference(),
    productId: product._id,
    productName: product.name,
    unitPrice: product.price,
    quantity,
    total: product.price * quantity,
    nom,
    prenom,
    telephone,
    adresse,
    note,
  });

  res.status(201).json({
    reference: order.reference,
    productName: order.productName,
    quantity: order.quantity,
    total: order.total,
  });
}));

// Liste des commandes (admin) : ?statut=en_cours | effectuee | annulee
router.get('/', auth, wrap(async (req, res) => {
  const f = {};
  if (['en_cours', 'effectuee', 'annulee'].includes(req.query.statut)) f.statut = req.query.statut;
  const orders = await Order.find(f).sort({ createdAt: -1 }).limit(500).lean();
  res.json(orders);
}));

router.patch('/:id/statut', auth, wrap(async (req, res) => {
  const { statut } = req.body || {};
  if (!['en_cours', 'effectuee', 'annulee'].includes(statut)) {
    return res.status(400).json({ message: 'Statut invalide.' });
  }
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Commande introuvable.' });
  const o = await Order.findByIdAndUpdate(req.params.id, { statut }, { new: true });
  if (!o) return res.status(404).json({ message: 'Commande introuvable.' });
  res.json({ ok: true, statut: o.statut });
}));

router.delete('/:id', auth, wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Commande introuvable.' });
  await Order.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
}));

module.exports = router;
