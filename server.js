const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const {
  getAllEvents,
  getEvent,
  createEvent,
  deleteEvent,
  updateEvent,
  getParticipants,
  addParticipant,
  removeParticipant,
  getStats
} = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'pickle-secret-2024';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'pickle2024';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

// Helper to get today's date in YYYY-MM-DD format
function getTodayDate() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

// Helper to check if event is past
function isPast(eventDate) {
  return eventDate < getTodayDate();
}

// Admin middleware
function requireAdmin(req, res, next) {
  if (!req.session || !req.session.isAdmin) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
}

// ============ API Routes ============

// GET /api/events - List all events with participant counts
app.get('/api/events', (req, res) => {
  try {
    const events = getAllEvents();
    const eventsWithFlags = events.map(event => ({
      ...event,
      isPast: isPast(event.date)
    }));
    res.json({ success: true, data: eventsWithFlags });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch events' });
  }
});

// POST /api/events - Create event
app.post('/api/events', (req, res) => {
  try {
    const { title, date, time, location, maxPlayers, description, courts } = req.body;
    
    // Validate required fields
    if (!title || !date || !time || !location) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    
    const event = createEvent({
      title,
      date,
      time,
      location,
      maxPlayers: maxPlayers || 12,
      description: description || '',
      courts: courts
    });
    
    res.status(201).json({ success: true, data: event });
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ success: false, error: 'Failed to create event' });
  }
});

// GET /api/events/:id - Single event with participants
app.get('/api/events/:id', (req, res) => {
  try {
    const event = getEvent(req.params.id);
    
    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }
    
    res.json({ success: true, data: event });
  } catch (error) {
    console.error('Error fetching event:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch event' });
  }
});

// DELETE /api/events/:id - Delete event (admin only)
app.delete('/api/events/:id', requireAdmin, (req, res) => {
  try {
    const success = deleteEvent(req.params.id);
    
    if (!success) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }
    
    res.json({ success: true, data: { message: 'Event deleted' } });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ success: false, error: 'Failed to delete event' });
  }
});

// PATCH /api/events/:id - update max players and/or courts (public)
app.patch('/api/events/:id', (req, res) => {
  try {
    const { maxPlayers, courts } = req.body;
    const event = updateEvent(req.params.id, { maxPlayers, courts });
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });
    res.json({ success: true, data: event });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/events/:id/join - Add participant
app.post('/api/events/:id/join', (req, res) => {
  try {
    const { name, status } = req.body;
    
    if (!name || !status) {
      return res.status(400).json({ success: false, error: 'Missing name or status' });
    }
    
    const event = getEvent(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }
    
    // Check if event is full
    if (event.participants.length >= event.max_players) {
      return res.status(400).json({ success: false, error: 'Event is full' });
    }
    
    // Check for duplicate name (case-insensitive)
    const duplicateName = event.participants.some(p => 
      p.name.toLowerCase() === name.toLowerCase()
    );
    if (duplicateName) {
      return res.status(400).json({ success: false, error: 'Name already registered for this event' });
    }
    
    const participant = addParticipant(req.params.id, name, status);
    res.status(201).json({ success: true, data: participant });
  } catch (error) {
    console.error('Error adding participant:', error);
    res.status(500).json({ success: false, error: 'Failed to add participant' });
  }
});

// DELETE /api/participants/:id - Remove participant
app.delete('/api/participants/:id', (req, res) => {
  try {
    const success = removeParticipant(req.params.id);
    
    if (!success) {
      return res.status(404).json({ success: false, error: 'Participant not found' });
    }
    
    res.json({ success: true, data: { message: 'Participant removed' } });
  } catch (error) {
    console.error('Error removing participant:', error);
    res.status(500).json({ success: false, error: 'Failed to remove participant' });
  }
});

// POST /api/admin/login - Admin login
app.post('/api/admin/login', (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ success: false, error: 'Password required' });
    }
    
    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({ success: false, error: 'Invalid password' });
    }
    
    req.session.isAdmin = true;
    res.json({ success: true, data: { message: 'Admin login successful' } });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// POST /api/admin/logout - Admin logout
app.post('/api/admin/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, error: 'Logout failed' });
    }
    res.json({ success: true, data: { message: 'Logged out' } });
  });
});

// GET /api/admin/check - Check admin status
app.get('/api/admin/check', (req, res) => {
  res.json({ success: true, data: { isAdmin: req.session && req.session.isAdmin ? true : false } });
});

// GET /api/stats - Get statistics
app.get('/api/stats', (req, res) => {
  try {
    const stats = getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

// Catch-all for client-side routing
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🥒 Pickleball Booking App running on http://localhost:${PORT}`);
});
