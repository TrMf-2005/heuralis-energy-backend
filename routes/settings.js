const express = require('express');
const auth = require('../middleware/auth');
const wrap = require('../middleware/wrap');
const { getSettings } = require('../models/Setting');

const router = express.Router();

const publicView = (s) => ({
  storeName: s.storeName,
  tagline: s.tagline,
  whatsapp: s.whatsapp,
  city: s.city,
});

router.get('/', wrap(async (req, res) => {
  res.json(publicView(await getSettings()));
}));

// Le nom de la boutique (et les autres réglages) se modifie depuis l'espace Administration
router.put('/', auth, wrap(async (req, res) => {
  const b = req.body || {};
  const s = await getSettings();
  const name = String(b.storeName ?? '').trim();
  if (name.length < 2) return res.status(400).json({ message: 'Le nom de la boutique est trop court.' });
  s.storeName = name.slice(0, 60);
  s.tagline = String(b.tagline ?? '').trim().slice(0, 120);
  s.whatsapp = String(b.whatsapp ?? '').replace(/\D/g, '').slice(0, 15);
  s.city = String(b.city ?? '').trim().slice(0, 80);
  await s.save();
  res.json(publicView(s));
}));

module.exports = router;
