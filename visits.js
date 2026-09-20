const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const auth = require('../middleware/auth');
const wrap = require('../middleware/wrap');
const Visit = require('../models/Visit');

const router = express.Router();

const visitLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });

// Sel journalier gardé UNIQUEMENT en mémoire : il change chaque jour et n'est jamais enregistré.
// Il permet de compter les visiteurs d'une même journée sans cookie et sans conserver l'IP.
let salt = '';
let saltDay = '';
function dailySalt() {
  const day = new Date().toISOString().slice(0, 10);
  if (day !== saltDay) {
    saltDay = day;
    salt = crypto.randomBytes(16).toString('hex');
  }
  return salt;
}

function parseUA(ua = '') {
  const bot = /bot|crawl|spider|slurp|facebookexternalhit|preview|monitor|lighthouse|headless/i.test(ua);
  let device = 'ordinateur';
  if (/ipad|tablet|android(?!.*mobi)/i.test(ua)) device = 'tablette';
  else if (/mobi|iphone|android/i.test(ua)) device = 'mobile';
  let browser = 'autre';
  if (/edg\//i.test(ua)) browser = 'Edge';
  else if (/opr\/|opera/i.test(ua)) browser = 'Opera';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
  else if (/safari/i.test(ua)) browser = 'Safari';
  return { bot, device, browser };
}

// Enregistrement d'une visite (appelé par js/tracker.js sur les pages publiques)
router.post('/', visitLimiter, wrap(async (req, res) => {
  const ua = req.headers['user-agent'] || '';
  const { bot, device, browser } = parseUA(ua);
  if (bot) return res.status(204).end();

  const b = req.body || {};
  let referrer = '';
  try {
    referrer = b.referrer ? new URL(String(b.referrer)).hostname.slice(0, 100) : '';
  } catch {
    referrer = '';
  }
  const tz = String(b.tz || '').slice(0, 60);
  const country = String(req.headers['cf-ipcountry'] || '').toUpperCase();

  await Visit.create({
    page: String(b.page || '/').split('#')[0].slice(0, 200),
    referrer,
    device,
    browser,
    lang: String(b.lang || '').slice(0, 10),
    timezone: /^[A-Za-z_\/+-]+$/.test(tz) ? tz : '',
    country: /^[A-Z]{2}$/.test(country) && country !== 'XX' ? country : '',
    visitor: crypto
      .createHash('sha256')
      .update(dailySalt() + req.ip + ua)
      .digest('hex')
      .slice(0, 16),
  });
  res.status(204).end();
}));

// Statistiques + liste des dernières visites (admin)
router.get('/', auth, wrap(async (req, res) => {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const since7 = new Date(Date.now() - 7 * 864e5);

  const [total, viewsToday, visitorsToday, perDay, topPages, byDevice, visits] = await Promise.all([
    Visit.countDocuments(),
    Visit.countDocuments({ createdAt: { $gte: startOfDay } }),
    Visit.distinct('visitor', { createdAt: { $gte: startOfDay } }),
    Visit.aggregate([
      { $match: { createdAt: { $gte: since7 } } },
      { $group: { _id: { d: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, v: '$visitor' }, n: { $sum: 1 } } },
      { $group: { _id: '$_id.d', visiteurs: { $sum: 1 }, pages: { $sum: '$n' } } },
      { $sort: { _id: 1 } },
    ]),
    Visit.aggregate([{ $group: { _id: '$page', n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 8 }]),
    Visit.aggregate([{ $group: { _id: '$device', n: { $sum: 1 } } }, { $sort: { n: -1 } }]),
    Visit.find().sort({ createdAt: -1 }).limit(300).select('-visitor -__v').lean(),
  ]);

  res.json({
    stats: { total, viewsToday, visitorsToday: visitorsToday.length, perDay, topPages, byDevice },
    visits,
  });
}));

module.exports = router;
