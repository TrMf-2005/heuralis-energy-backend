const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'main', unique: true },
    storeName: { type: String, default: "HEURALIS's Energy", trim: true, maxlength: 60 },
    tagline: { type: String, default: 'Votre énergie, sans coupure', trim: true, maxlength: 120 },
    whatsapp: { type: String, default: '', maxlength: 20 },
    city: { type: String, default: '', trim: true, maxlength: 80 },
  },
  { timestamps: true }
);

const Setting = mongoose.model('Setting', settingSchema);

async function getSettings() {
  let s = await Setting.findOne({ key: 'main' });
  if (!s) s = await Setting.create({ key: 'main' });
  return s;
}

module.exports = Setting;
module.exports.getSettings = getSettings;
