const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Get database path from environment or use default
const dbPath = process.env.DB_PATH || './data/pickleball.db';

// Ensure data directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize database
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize tables
function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      location TEXT NOT NULL,
      max_players INTEGER NOT NULL DEFAULT 12,
      description TEXT DEFAULT '',
      courts INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS participants (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('confirmed', 'tnd')),
      joined_at TEXT NOT NULL,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS mixers (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      players TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS mixer_games (
      id TEXT PRIMARY KEY,
      mixer_id TEXT NOT NULL,
      round_number INTEGER NOT NULL,
      court_number INTEGER NOT NULL,
      t1p1 TEXT DEFAULT '',
      t1p2 TEXT DEFAULT '',
      t2p1 TEXT DEFAULT '',
      t2p2 TEXT DEFAULT '',
      team1_score INTEGER DEFAULT NULL,
      team2_score INTEGER DEFAULT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (mixer_id) REFERENCES mixers(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_participants_event ON participants(event_id);
    CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
  `);
  
  // Migrate: add courts column if not exists
  try {
    db.exec('ALTER TABLE events ADD COLUMN courts INTEGER DEFAULT 1');
  } catch (e) { /* already exists */ }

  // Mixer tables
  try { db.exec(`CREATE TABLE IF NOT EXISTS mixers (id TEXT PRIMARY KEY, event_id TEXT NOT NULL, players TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL)`); } catch(e) {}
  try { db.exec(`CREATE TABLE IF NOT EXISTS mixer_games (id TEXT PRIMARY KEY, mixer_id TEXT NOT NULL, round_number INTEGER NOT NULL, court_number INTEGER NOT NULL, t1p1 TEXT DEFAULT '', t1p2 TEXT DEFAULT '', t2p1 TEXT DEFAULT '', t2p2 TEXT DEFAULT '', team1_score INTEGER DEFAULT NULL, team2_score INTEGER DEFAULT NULL, created_at TEXT NOT NULL)`); } catch(e) {}
}

// Helper to generate ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// Helper to get today's date in YYYY-MM-DD format
function getTodayDate() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

// Helper to check if event is past
function isPast(eventDate) {
  return eventDate < getTodayDate();
}

// Get all events with participant counts
function getAllEvents() {
  const stmt = db.prepare(`
    SELECT 
      e.*,
      COUNT(p.id) as participant_count,
      SUM(CASE WHEN p.status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_count
    FROM events e
    LEFT JOIN participants p ON e.id = p.event_id
    GROUP BY e.id
    ORDER BY e.date ASC
  `);
  
  const events = stmt.all();
  return events.map(e => ({
    ...e,
    isPast: isPast(e.date),
    participant_count: e.participant_count || 0,
    confirmed_count: e.confirmed_count || 0
  }));
}

// Get single event with participants array
function getEvent(id) {
  const eventStmt = db.prepare('SELECT * FROM events WHERE id = ?');
  const event = eventStmt.get(id);
  
  if (!event) return null;
  
  const participantsStmt = db.prepare('SELECT * FROM participants WHERE event_id = ? ORDER BY joined_at ASC');
  const participants = participantsStmt.all(id);
  
  return {
    ...event,
    isPast: isPast(event.date),
    participants
  };
}

// Create event
function createEvent(data) {
  const id = generateId();
  const createdAt = new Date().toISOString();
  
  const stmt = db.prepare(`
    INSERT INTO events (id, title, date, time, location, max_players, description, courts, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(id, data.title, data.date, data.time, data.location, data.maxPlayers || 12, data.description || '', data.courts || 1, createdAt);
  
  return getEvent(id);
}

// Delete event (cascade deletes participants)
function deleteEvent(id) {
  const stmt = db.prepare('DELETE FROM events WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// Update event
function updateEvent(id, { maxPlayers, courts }) {
  db.prepare(`
    UPDATE events 
    SET max_players = COALESCE(?, max_players),
        courts = COALESCE(?, courts)
    WHERE id = ?
  `).run(maxPlayers ?? null, courts ?? null, id);
  return getEvent(id);
}

// Get participants for an event
function getParticipants(eventId) {
  const stmt = db.prepare('SELECT * FROM participants WHERE event_id = ? ORDER BY joined_at ASC');
  return stmt.all(eventId);
}

// Add participant
function addParticipant(eventId, name, status) {
  const id = generateId();
  const joinedAt = new Date().toISOString();
  
  const stmt = db.prepare(`
    INSERT INTO participants (id, event_id, name, status, joined_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  stmt.run(id, eventId, name, status, joinedAt);
  
  const getStmt = db.prepare('SELECT * FROM participants WHERE id = ?');
  return getStmt.get(id);
}

// Remove participant
function removeParticipant(id) {
  const stmt = db.prepare('DELETE FROM participants WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// Get statistics
function getStats() {
  const totalEventsStmt = db.prepare('SELECT COUNT(*) as count FROM events');
  const totalParticipantsStmt = db.prepare('SELECT COUNT(*) as count FROM participants');
  
  const today = getTodayDate();
  const upcomingStmt = db.prepare('SELECT COUNT(*) as count FROM events WHERE date >= ?');
  const pastStmt = db.prepare('SELECT COUNT(*) as count FROM events WHERE date < ?');
  
  return {
    totalEvents: totalEventsStmt.get().count,
    totalParticipants: totalParticipantsStmt.get().count,
    upcomingCount: upcomingStmt.get(today).count,
    pastCount: pastStmt.get(today).count
  };
}

// ==================== MIXER FUNCTIONS ====================
function getMixersByEvent(eventId) {
  const mixers = db.prepare('SELECT * FROM mixers WHERE event_id = ? ORDER BY created_at DESC').all(eventId);
  return mixers.map(m => ({ ...m, players: JSON.parse(m.players || '[]') }));
}

function getMixer(mixerId) {
  const mixer = db.prepare('SELECT * FROM mixers WHERE id = ?').get(mixerId);
  if (!mixer) return null;
  return { ...mixer, players: JSON.parse(mixer.players || '[]') };
}

function createMixer(eventId, players) {
  const id = generateId();
  const createdAt = new Date().toISOString();
  db.prepare('INSERT INTO mixers (id, event_id, players, created_at) VALUES (?, ?, ?, ?)')
    .run(id, eventId, JSON.stringify(players || []), createdAt);
  return getMixer(id);
}

function deleteMixer(mixerId) {
  db.prepare('DELETE FROM mixer_games WHERE mixer_id = ?').run(mixerId);
  db.prepare('DELETE FROM mixers WHERE id = ?').run(mixerId);
}

function getMixerGames(mixerId) {
  return db.prepare('SELECT * FROM mixer_games WHERE mixer_id = ? ORDER BY round_number, court_number').all(mixerId);
}

function createMixerGame(mixerId, { round, court, t1p1, t1p2, t2p1, t2p2 }) {
  const id = generateId();
  const createdAt = new Date().toISOString();
  db.prepare(`INSERT INTO mixer_games (id, mixer_id, round_number, court_number, t1p1, t1p2, t2p1, t2p2, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, mixerId, round, court, t1p1 || '', t1p2 || '', t2p1 || '', t2p2 || '', createdAt);
  return id;
}

function updateMixerGame(gameId, { t1p1, t1p2, t2p1, t2p2, team1_score, team2_score }) {
  const fields = [];
  const vals = [];
  if (t1p1 !== undefined) { fields.push('t1p1 = ?'); vals.push(t1p1); }
  if (t1p2 !== undefined) { fields.push('t1p2 = ?'); vals.push(t1p2); }
  if (t2p1 !== undefined) { fields.push('t2p1 = ?'); vals.push(t2p1); }
  if (t2p2 !== undefined) { fields.push('t2p2 = ?'); vals.push(t2p2); }
  if (team1_score !== undefined) { fields.push('team1_score = ?'); vals.push(team1_score); }
  if (team2_score !== undefined) { fields.push('team2_score = ?'); vals.push(team2_score); }
  if (fields.length === 0) return;
  vals.push(gameId);
  db.prepare(`UPDATE mixer_games SET ${fields.join(', ')} WHERE id = ?`).run(...vals);
}

// Initialize on load
initDB();

module.exports = {
  db,
  getAllEvents,
  getEvent,
  createEvent,
  deleteEvent,
  updateEvent,
  getParticipants,
  addParticipant,
  removeParticipant,
  getStats,
  getMixersByEvent,
  getMixer,
  createMixer,
  deleteMixer,
  getMixerGames,
  createMixerGame,
  updateMixerGame
};
