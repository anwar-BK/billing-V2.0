/**
 * Service: Manajemen Inventaris / Gudang (Warehouse)
 */
const db = require('../config/database');
const { logger } = require('../config/logger');

// ─── CATEGORIES ───────────────────────────────────────────────────────────
function getAllCategories() {
  return db.prepare('SELECT * FROM inventory_categories ORDER BY name ASC').all();
}

function createCategory(data) {
  const { name, description } = data;
  return db.prepare('INSERT INTO inventory_categories (name, description) VALUES (?, ?)').run(name, description);
}

function updateCategory(id, data) {
  const { name, description } = data;
  return db.prepare('UPDATE inventory_categories SET name = ?, description = ? WHERE id = ?').run(name, description, id);
}

function deleteCategory(id) {
  return db.prepare('DELETE FROM inventory_categories WHERE id = ?').run(id);
}

// ─── ITEMS ───────────────────────────────────────────────────────────────
function getAllItems(search = '') {
  let query = `
    SELECT i.*, c.name as category_name, 
           (SELECT SUM(quantity) FROM inventory_stock s WHERE s.item_id = i.id AND s.status = 'available') as stock_available,
           (SELECT SUM(quantity) FROM inventory_stock s WHERE s.item_id = i.id AND s.status = 'assigned') as stock_assigned
    FROM inventory_items i
    LEFT JOIN inventory_categories c ON i.category_id = c.id
  `;
  const params = [];
  if (search) {
    query += ' WHERE i.name LIKE ? OR i.brand LIKE ? OR i.model LIKE ?';
    const s = `%${search}%`;
    params.push(s, s, s);
  }
  query += ' ORDER BY i.name ASC';
  return db.prepare(query).all(...params);
}

function getItemById(id) {
  return db.prepare(`
    SELECT i.*, c.name as category_name
    FROM inventory_items i
    LEFT JOIN inventory_categories c ON i.category_id = c.id
    WHERE i.id = ?
  `).get(id);
}

function createItem(data) {
  const { category_id, name, brand, model, unit, min_stock, description } = data;
  return db.prepare(`
    INSERT INTO inventory_items (category_id, name, brand, model, unit, min_stock, description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(category_id, name, brand, model, unit, min_stock, description);
}

function updateItem(id, data) {
  const { category_id, name, brand, model, unit, min_stock, description } = data;
  return db.prepare(`
    UPDATE inventory_items 
    SET category_id = ?, name = ?, brand = ?, model = ?, unit = ?, min_stock = ?, description = ?
    WHERE id = ?
  `).run(category_id, name, brand, model, unit, min_stock, description, id);
}

function deleteItem(id) {
  return db.prepare('DELETE FROM inventory_items WHERE id = ?').run(id);
}

// ─── STOCK ───────────────────────────────────────────────────────────────
function getStockByItem(itemId) {
  return db.prepare(`
    SELECT s.*, cust.name as customer_name
    FROM inventory_stock s
    LEFT JOIN customers cust ON s.assigned_to_customer_id = cust.id
    WHERE s.item_id = ?
    ORDER BY s.created_at DESC
  `).all(itemId);
}

function addStock(data, actor = 'Admin') {
  const { item_id, serial_number, quantity, condition, location, note } = data;
  
  const run = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO inventory_stock (item_id, serial_number, quantity, condition, location, note)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(item_id, serial_number || null, quantity, condition || 'new', location || 'Gudang Utama', note || '');

    db.prepare(`
      INSERT INTO inventory_logs (item_id, stock_id, type, quantity, actor, note)
      VALUES (?, ?, 'in', ?, ?, ?)
    `).run(item_id, result.lastInsertRowid, quantity, actor, note || 'Stock Masuk');

    return result;
  });

  return run();
}

function getAvailableItems() {
  return getAllItems().filter(item => Number(item.stock_available || 0) > 0);
}

function consumeStock(data, actor = 'Admin') {
  const itemId = Number(data.item_id);
  const quantity = Number(data.quantity);
  const serialNumber = String(data.serial_number || '').trim();
  const note = String(data.note || 'Stock Keluar');
  if (!itemId || !Number.isInteger(quantity) || quantity < 1) {
    throw new Error('Barang dan jumlah stok keluar wajib diisi dengan benar');
  }

  const run = db.transaction(() => {
    let stocks = db.prepare(`
      SELECT * FROM inventory_stock
      WHERE item_id = ? AND status = 'available' AND quantity > 0
        ${serialNumber ? 'AND serial_number = ?' : ''}
      ORDER BY created_at ASC
    `).all(...(serialNumber ? [itemId, serialNumber] : [itemId]));
    const available = stocks.reduce((sum, stock) => sum + Number(stock.quantity || 0), 0);
    if (available < quantity) throw new Error(`Stok tersedia tidak cukup (tersisa ${available})`);

    let remaining = quantity;
    for (const stock of stocks) {
      if (remaining < 1) break;
      const used = Math.min(remaining, Number(stock.quantity));
      db.prepare(`
        UPDATE inventory_stock
        SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(used, stock.id);
      db.prepare(`
        INSERT INTO inventory_logs (item_id, stock_id, type, quantity, actor, note)
        VALUES (?, ?, 'out', ?, ?, ?)
      `).run(itemId, stock.id, -used, actor, note);
      remaining -= used;
    }
  });

  return run();
}

function returnStock(data, actor = 'Admin') {
  const itemId = Number(data.item_id);
  const quantity = Number(data.quantity);
  const serialNumber = String(data.serial_number || '').trim();
  const condition = data.condition || 'used';
  const note = data.note || 'Stock Kembali';
  if (!itemId || !Number.isInteger(quantity) || quantity < 1) {
    throw new Error('Barang dan jumlah stok kembali wajib diisi dengan benar');
  }

  if (!serialNumber) return addStock({ ...data, item_id: itemId, quantity, condition, note }, actor);

  const existing = db.prepare('SELECT * FROM inventory_stock WHERE item_id = ? AND serial_number = ?').get(itemId, serialNumber);
  if (!existing) return addStock({ ...data, item_id: itemId, quantity, condition, note }, actor);

  const run = db.transaction(() => {
    db.prepare(`
      UPDATE inventory_stock
      SET quantity = quantity + ?, condition = ?, status = 'available',
          assigned_to_customer_id = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(quantity, condition, existing.id);
    db.prepare(`
      INSERT INTO inventory_logs (item_id, stock_id, type, quantity, actor, note)
      VALUES (?, ?, 'in', ?, ?, ?)
    `).run(itemId, existing.id, quantity, actor, note);
  });
  return run();
}

function recordMovements(movements, actor = 'Admin') {
  const run = db.transaction(() => {
    for (const movement of movements || []) {
      if (movement.type === 'out') consumeStock(movement, actor);
      if (movement.type === 'in') returnStock(movement, actor);
    }
  });
  return run();
}

function assignStockToCustomer(stockId, customerId, actor = 'Admin', note = '') {
  const stock = db.prepare('SELECT * FROM inventory_stock WHERE id = ?').get(stockId);
  if (!stock) throw new Error('Stock tidak ditemukan');
  if (stock.status === 'assigned') throw new Error('Stock sudah terpasang di pelanggan lain');

  const run = db.transaction(() => {
    db.prepare(`
      UPDATE inventory_stock 
      SET status = 'assigned', assigned_to_customer_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(customerId, stockId);

    db.prepare(`
      INSERT INTO inventory_logs (item_id, stock_id, type, quantity, actor, note)
      VALUES (?, ?, 'out', ?, ?, ?)
    `).run(stock.item_id, stockId, stock.quantity, actor, note || `Terpasang ke pelanggan ID: ${customerId}`);
  });

  return run();
}

function adjustStock(stockId, newQuantity, note, actor = 'Admin') {
  const stock = db.prepare('SELECT * FROM inventory_stock WHERE id = ?').get(stockId);
  if (!stock) throw new Error('Stock tidak ditemukan');

  const run = db.transaction(() => {
    const diff = newQuantity - stock.quantity;
    db.prepare('UPDATE inventory_stock SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newQuantity, stockId);

    db.prepare(`
      INSERT INTO inventory_logs (item_id, stock_id, type, quantity, actor, note)
      VALUES (?, ?, 'adjust', ?, ?, ?)
    `).run(stock.item_id, stockId, diff, actor, note || 'Penyesuaian Stock');
  });

  return run();
}

function getInventoryLogs(limit = 100) {
  return db.prepare(`
    SELECT l.*, i.name as item_name, s.serial_number
    FROM inventory_logs l
    LEFT JOIN inventory_items i ON l.item_id = i.id
    LEFT JOIN inventory_stock s ON l.stock_id = s.id
    ORDER BY l.created_at DESC
    LIMIT ?
  `).all(limit);
}

function getLowStockItems() {
  return db.prepare(`
    SELECT i.*, c.name as category_name, SUM(s.quantity) as current_stock
    FROM inventory_items i
    LEFT JOIN inventory_categories c ON i.category_id = c.id
    LEFT JOIN inventory_stock s ON s.item_id = i.id AND s.status = 'available'
    GROUP BY i.id
    HAVING current_stock <= i.min_stock OR current_stock IS NULL
  `).all();
}

module.exports = {
  getAllCategories, createCategory, updateCategory, deleteCategory,
  getAllItems, getItemById, createItem, updateItem, deleteItem,
  getAvailableItems, getStockByItem, addStock, consumeStock, returnStock, recordMovements,
  assignStockToCustomer, adjustStock,
  getInventoryLogs, getLowStockItems
};
