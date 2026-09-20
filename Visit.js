const mongoose = require('mongoose');

// Tracker niveau 1 : totalement anonyme.
// Aucune adresse IP, aucun cookie, aucun user-agent brut n'est conservé.
const visitSchema = new mongoose.Schema({
  page: { type: String, default: '/' },
  referrer: { type: String, default: '' }, // domaine d'origine uniquement
  device: { type: String, default: '' }, // mobile / tablette / ordinateur
  browser: { type: String, default: '' },
  lang: { type: String, default: '' },
  timezone: { type: String, default: '' }, // sert à déduire une ville approximative
  country: { type: String, default: '' }, // pays approximatif si fourni par l'hébergeur
  visitor: { type: String, default: '' }, // empreinte anonyme valable un seul jour
  createdAt: { type: Date, default: Date.now },
});

const days = Math.max(1, parseInt(process.env.VISIT_RETENTION_DAYS, 10) || 90);
// Suppression automatique des anciennes visites
visitSchema.index({ createdAt: 1 }, { expireAfterSeconds: days * 86400 });

module.exports = mongoose.model('Visit', visitSchema);
