require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');

const { getSettings } = require('./models/Setting');
const Product = require('./models/Product');
const wrap = require('./middleware/wrap');

for (const v of ['MONGODB_URI', 'JWT_SECRET', 'ADMIN_PASSWORD']) {
  if (!process.env[v]) {
    console.error(`Variable d'environnement manquante : ${v}`);
    process.exit(1);
  }
}

const app = express();
app.set('trust proxy', 1); // Render se place derrière un proxy

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

const allowed = (process.env.FRONT_URLS || '')
  .split(',')
  .map((s) => s.trim().replace(/\/$/, ''))
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin || allowed.length === 0 || allowed.includes(origin)) return cb(null, true);
      cb(new Error('Origine non autorisée'));
    },
  })
);

app.use(express.json({ limit: '12mb' })); // les images des produits sont envoyées en base64

app.get('/', (req, res) => res.json({ service: "HEURALIS's Energy API", status: 'ok' }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/visits', require('./routes/visits'));

// Sitemap pour Google Search Console (voir le README pour le brancher sur le site)
app.get('/sitemap.xml', wrap(async (req, res) => {
  const site = (process.env.SITE_URL || '').replace(/\/$/, '');
  const products = await Product.find().select('slug updatedAt').lean();
  const urls = [
    { loc: `${site}/`, lastmod: null },
    { loc: `${site}/confidentialite.html`, lastmod: null },
    ...products.map((p) => ({
      loc: `${site}/produit.html?p=${encodeURIComponent(p.slug)}`,
      lastmod: p.updatedAt.toISOString().slice(0, 10),
    })),
  ];
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls
      .map((u) => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`)
      .join('\n') +
    '\n</urlset>';
  res.type('application/xml').send(xml);
}));

app.use((req, res) => res.status(404).json({ message: 'Route introuvable.' }));

app.use((err, req, res, next) => {
  if (err.message === 'Origine non autorisée') return res.status(403).json({ message: err.message });
  if (err.type === 'entity.too.large') return res.status(413).json({ message: 'Données trop volumineuses (images).' });
  console.error(err);
  res.status(500).json({ message: 'Erreur du serveur.' });
});

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(async () => {
    await getSettings(); // crée les réglages par défaut (nom : HEURALIS's Energy)
    app.listen(PORT, () => console.log(`API prête sur le port ${PORT}`));
  })
  .catch((e) => {
    console.error('Connexion MongoDB impossible :', e.message);
    process.exit(1);
  });
