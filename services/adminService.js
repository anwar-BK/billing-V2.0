const crypto = require('crypto');
const db = require('../config/database');

function hashAdminPassword(password) {
  return crypto.createHash('sha256').update(String(password || '')).digest('hex');
}

function getAllAdminUsers() {
  return db.prepare('SELECT id, username, name, is_active, created_at, updated_at FROM admin_users ORDER BY name ASC').all();
}

function authenticateAdmin(username, password) {
  const user = db.prepare('SELECT * FROM admin_users WHERE username = ? AND is_active = 1').get(String(username || '').trim());
  if (!user || user.password_hash !== hashAdminPassword(password)) return null;
  return user;
}

function createAdminUser(data) {
  const username = String(data.username || '').trim();
  const name = String(data.name || '').trim();
  const password = String(data.password || '');
  if (!username || !name || password.length < 6) throw new Error('Nama, username, dan password minimal 6 karakter wajib diisi');
  return db.prepare('INSERT INTO admin_users (username, password_hash, name) VALUES (?, ?, ?)').run(username, hashAdminPassword(password), name);
}

function updateAdminUser(id, data) {
  const username = String(data.username || '').trim();
  const name = String(data.name || '').trim();
  const password = String(data.password || '');
  const isActive = Number(data.is_active) === 1 ? 1 : 0;
  if (!username || !name) throw new Error('Nama dan username wajib diisi');
  if (password && password.length < 6) throw new Error('Password minimal 6 karakter');
  if (password) return db.prepare('UPDATE admin_users SET username=?, name=?, password_hash=?, is_active=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(username, name, hashAdminPassword(password), isActive, id);
  return db.prepare('UPDATE admin_users SET username=?, name=?, is_active=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(username, name, isActive, id);
}

function deleteAdminUser(id) {
  return db.prepare('DELETE FROM admin_users WHERE id = ?').run(id);
}

/**
 * TECHNICIANS
 */
function getAllTechnicians() {
  return db.prepare('SELECT * FROM technicians ORDER BY created_at DESC').all();
}

function createTechnician(data) {
  const stmt = db.prepare('INSERT INTO technicians (username, password, name, phone, area) VALUES (?, ?, ?, ?, ?)');
  return stmt.run(data.username, data.password, data.name, data.phone || '', data.area || '');
}

function parseBoolInt(val, defaultVal = 0) {
  if (val === undefined || val === null || val === '') return defaultVal;
  if (val === true || val === 1 || val === '1' || val === 'true' || val === 'on' || val === 'yes') return 1;
  if (val === false || val === 0 || val === '0' || val === 'false' || val === 'off' || val === 'no') return 0;
  return Boolean(val) ? 1 : 0;
}

function updateTechnician(id, data) {
  const stmt = db.prepare('UPDATE technicians SET username = ?, password = ?, name = ?, phone = ?, area = ?, is_active = ? WHERE id = ?');
  return stmt.run(data.username, data.password, data.name, data.phone || '', data.area || '', parseBoolInt(data.is_active, 1), id);
}

function deleteTechnician(id) {
  return db.prepare('DELETE FROM technicians WHERE id = ?').run(id);
}

/**
 * CASHIERS
 */
function getAllCashiers() {
  return db.prepare('SELECT * FROM cashiers ORDER BY created_at DESC').all();
}

function createCashier(data) {
  const stmt = db.prepare('INSERT INTO cashiers (username, password, name, phone) VALUES (?, ?, ?, ?)');
  return stmt.run(data.username, data.password, data.name, data.phone || '');
}

function updateCashier(id, data) {
  const stmt = db.prepare('UPDATE cashiers SET username = ?, password = ?, name = ?, phone = ?, is_active = ? WHERE id = ?');
  return stmt.run(data.username, data.password, data.name, data.phone || '', parseBoolInt(data.is_active, 1), id);
}

function deleteCashier(id) {
  return db.prepare('DELETE FROM cashiers WHERE id = ?').run(id);
}

function authenticateCashier(username, password) {
  return db.prepare('SELECT * FROM cashiers WHERE username = ? AND password = ? AND is_active = 1').get(username, password);
}

function getAllCollectors() {
  return db.prepare('SELECT * FROM collectors ORDER BY created_at DESC').all();
}

function createCollector(data) {
  return db
    .prepare(
      'INSERT INTO collectors (username, password, name, phone, is_active, auto_approve) VALUES (?, ?, ?, ?, 1, ?)'
    )
    .run(
      String(data.username || '').trim(),
      String(data.password || ''),
      String(data.name || '').trim(),
      String(data.phone || '').trim(),
      parseBoolInt(data.auto_approve, 0)
    );
}

function updateCollector(id, data) {
  const stmt = db.prepare('UPDATE collectors SET username = ?, password = ?, name = ?, phone = ?, is_active = ?, auto_approve = ? WHERE id = ?');
  return stmt.run(
    String(data.username || '').trim(),
    String(data.password || ''),
    String(data.name || '').trim(),
    String(data.phone || '').trim(),
    parseBoolInt(data.is_active, 1),
    parseBoolInt(data.auto_approve, 0),
    id
  );
}

function deleteCollector(id) {
  return db.prepare('DELETE FROM collectors WHERE id = ?').run(id);
}

function authenticateCollector(username, password) {
  return db.prepare('SELECT * FROM collectors WHERE username = ? AND password = ? AND is_active = 1').get(username, password);
}

module.exports = {
  getAllTechnicians,
  createTechnician,
  updateTechnician,
  deleteTechnician,
  getAllCashiers,
  createCashier,
  updateCashier,
  deleteCashier,
  authenticateCashier,
  getAllCollectors,
  createCollector,
  updateCollector,
  deleteCollector,
  authenticateCollector,
  getAllAdminUsers,
  authenticateAdmin,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser
};
