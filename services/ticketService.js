const db = require('../config/database');

function getAllTickets(status = null) {
  let query = `
        SELECT t.*, COALESCE(NULLIF(t.manual_customer_name, ''), c.name) as customer_name,
          COALESCE(NULLIF(t.manual_customer_phone, ''), c.phone) as customer_phone,
          c.address as customer_address, tech.name as technician_name
    FROM tickets t
        LEFT JOIN customers c ON t.customer_id = c.id
    LEFT JOIN technicians tech ON t.technician_id = tech.id
  `;
  
  if (status && status !== 'all') {
    query += ` WHERE t.status = ? ORDER BY t.created_at DESC`;
    return db.prepare(query).all(status);
  }
  
  query += ` ORDER BY CASE WHEN t.status = 'open' THEN 1 WHEN t.status = 'in_progress' THEN 2 ELSE 3 END, t.created_at DESC`;
  return db.prepare(query).all();
}

function getTicketsByCustomerId(customerId) {
  return db.prepare(`
    SELECT t.*, tech.name as technician_name
    FROM tickets t
    LEFT JOIN technicians tech ON t.technician_id = tech.id
    WHERE t.customer_id = ?
    ORDER BY t.created_at DESC
  `).all(customerId);
}

function getTicketById(id) {
  return db.prepare(`
        SELECT t.*, COALESCE(NULLIF(t.manual_customer_name, ''), c.name) as customer_name,
          COALESCE(NULLIF(t.manual_customer_phone, ''), c.phone) as customer_phone,
          c.address as customer_address, tech.name as technician_name
    FROM tickets t
        LEFT JOIN customers c ON t.customer_id = c.id
    LEFT JOIN technicians tech ON t.technician_id = tech.id
    WHERE t.id = ?
  `).get(id);
}

function createTicket(customerId, subject, message, extraData = {}) {
  const { customerPhotos, customerPhotoMetadata, technicianId, status, manualCustomerName, manualCustomerPhone } = extraData;
  const assignedTechnicianId = technicianId ? Number(technicianId) : null;
  const ticketStatus = status || (assignedTechnicianId ? 'in_progress' : 'open');
  
  if (customerPhotos || customerPhotoMetadata) {
    return db.prepare(`
      INSERT INTO tickets (customer_id, manual_customer_name, manual_customer_phone, subject, message, status, technician_id, customer_photos, customer_photo_metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(customerId || null, manualCustomerName || '', manualCustomerPhone || '', subject, message, ticketStatus, assignedTechnicianId, customerPhotos || '', customerPhotoMetadata || '');
  } else {
    return db.prepare(`
      INSERT INTO tickets (customer_id, manual_customer_name, manual_customer_phone, subject, message, status, technician_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(customerId || null, manualCustomerName || '', manualCustomerPhone || '', subject, message, ticketStatus, assignedTechnicianId);
  }
}

function updateTicketStatus(id, status, technicianId = null) {
  if (technicianId) {
    return db.prepare(`
      UPDATE tickets 
      SET status = ?, technician_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, technicianId, id);
  } else {
    return db.prepare(`
      UPDATE tickets 
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, id);
  }
}

function deleteTicket(id) {
  return db.prepare('DELETE FROM tickets WHERE id = ?').run(id);
}

function getTicketStats() {
  const open = db.prepare("SELECT COUNT(*) as c FROM tickets WHERE status='open'").get().c;
  const inProgress = db.prepare("SELECT COUNT(*) as c FROM tickets WHERE status='in_progress'").get().c;
  const resolved = db.prepare("SELECT COUNT(*) as c FROM tickets WHERE status='resolved'").get().c;
  return { open, inProgress, resolved, total: open + inProgress + resolved };
}

function getAdminNotificationCount() {
  return db.prepare("SELECT COUNT(*) as count FROM tickets WHERE status = 'open'").get().count;
}

function getTechnicianNotificationCount(technicianId) {
  const pool = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE status = 'open'").get().count;
  const assigned = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE technician_id = ? AND status = 'in_progress'").get(technicianId).count;
  return { pool, assigned, total: pool + assigned };
}

module.exports = {
  getAllTickets,
  getTicketsByCustomerId,
  getTicketById,
  createTicket,
  updateTicketStatus,
  deleteTicket,
  getTicketStats,
  getAdminNotificationCount,
  getTechnicianNotificationCount
};
