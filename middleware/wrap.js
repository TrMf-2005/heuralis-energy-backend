// Évite de répéter try/catch dans chaque route asynchrone
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
