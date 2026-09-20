const express = require('express');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const wrap = require('../middleware/wrap');
const Product = require('../models/Product');

const router = express.Router();

function slugify(s) {
  return (
    String(s)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'produit'
  );
}

async function uniqueSlug(name) {
  const base = slugify(name);
  let slug = base;
  let i = 2;
  while (await Product.exists({ slug })) slug = `${base}-${i++}`;
  return slug;
}

const keyQuery = (key) =>
  Product.findOne(mongoose.isValidObjectId(key) ? { $or: [{ slug: key }, { _id: key }] } : { slug: key });

// Nettoie et valide les données envoyées par l'espace admin
function clean(b) {
  const str = (v, max) => String(v ?? '').trim().slice(0, max);
  const numOrNull = (v, max) => (v === '' || v == null ? null : Math.min(max, Math.max(0, Number(v) || 0)));
  return {
    name: str(b.name, 120),
    category: str(b.category, 60) || 'Accessoires',
    price: Math.max(0, Number(b.price) || 0),
    oldPrice: numOrNull(b.oldPrice, 1e9),
    shortDescription: str(b.shortDescription, 220),
    description: str(b.description, 5000),
    autonomyHours: numOrNull(b.autonomyHours, 72),
    warranty: str(b.warranty, 60),
    stock: Math.max(0, parseInt(b.stock, 10) || 0),
    badge: ['Nouveau', 'Promo'].includes(b.badge) ? b.badge : '',
    featured: !!b.featured,
    specs: (Array.isArray(b.specs) ? b.specs : [])
      .slice(0, 20)
      .map((s) => ({ label: str(s && s.label, 60), value: str(s && s.value, 120) }))
      .filter((s) => s.label && s.value),
    images: (Array.isArray(b.images) ? b.images : [])
      .filter((i) => typeof i === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(i) && i.length < 2000000)
      .slice(0, 6),
  };
}

// Liste publique (sans les images ni la description longue : plus léger)
router.get('/', wrap(async (req, res) => {
  const match = {};
  if (req.query.category) match.category = String(req.query.category);
  const docs = await Product.aggregate([
    { $match: match },
    { $sort: { featured: -1, createdAt: -1 } },
    { $addFields: { imageCount: { $size: { $ifNull: ['$images', []] } } } },
    { $project: { images: 0, description: 0, __v: 0 } },
  ]);
  res.json(docs);
}));

// Détail d'un produit (par slug ou par id)
router.get('/:key', wrap(async (req, res) => {
  const p = await keyQuery(req.params.key).lean();
  if (!p) return res.status(404).json({ message: 'Produit introuvable.' });
  p.imageCount = (p.images || []).length;
  delete p.images;
  delete p.__v;
  res.json(p);
}));

// Une image du produit, servie comme un vrai fichier (mise en cache par le navigateur)
router.get('/:key/image/:i', wrap(async (req, res) => {
  const p = await keyQuery(req.params.key).select('images').lean();
  const data = p && p.images && p.images[parseInt(req.params.i, 10) || 0];
  const m = data && /^data:(image\/[a-z]+);base64,(.+)$/.exec(data);
  if (!m) return res.status(404).end();
  res.set('Content-Type', m[1]);
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  res.send(Buffer.from(m[2], 'base64'));
}));

// Produit complet avec images (pour la modification dans l'espace admin)
router.get('/:id/full', auth, wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Produit introuvable.' });
  const p = await Product.findById(req.params.id).lean();
  if (!p) return res.status(404).json({ message: 'Produit introuvable.' });
  res.json(p);
}));

router.post('/', auth, wrap(async (req, res) => {
  const data = clean(req.body || {});
  if (data.name.length < 2) return res.status(400).json({ message: 'Le nom du produit est obligatoire.' });
  const product = await Product.create({ ...data, slug: await uniqueSlug(data.name) });
  res.status(201).json({ _id: product._id, slug: product.slug });
}));

// Le slug (adresse du produit) reste stable à la modification
router.put('/:id', auth, wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Produit introuvable.' });
  const data = clean(req.body || {});
  if (data.name.length < 2) return res.status(400).json({ message: 'Le nom du produit est obligatoire.' });
  const p = await Product.findByIdAndUpdate(req.params.id, data, { new: true });
  if (!p) return res.status(404).json({ message: 'Produit introuvable.' });
  res.json({ _id: p._id, slug: p.slug });
}));

router.delete('/:id', auth, wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Produit introuvable.' });
  await Product.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
}));

module.exports = router;
