# 🥒 Pickleball Booking App

A modern, full-stack web application for creating and managing pickleball court bookings. Built with Node.js, Express, SQLite, and a responsive frontend.

## Features

- 📅 **Event Management**: Create, view, and manage pickleball events
- 👥 **Player Registration**: Join events with confirmed or tentative status
- 📊 **Statistics Dashboard**: Track total events, participants, and upcoming games
- 🔐 **Admin Panel**: Secure admin controls for event and participant management
- 📱 **Responsive Design**: Works seamlessly on desktop, tablet, and mobile
- 🎨 **Modern UI**: Sleek dark theme with accent colors and smooth animations
- 🚀 **Production Ready**: Docker support and Fly.io deployment configuration
- ⚡ **Fast & Lightweight**: SQLite database with better-sqlite3 for performance

## Tech Stack

- **Backend**: Node.js 18+, Express.js, better-sqlite3
- **Frontend**: HTML5, CSS3, Vanilla JavaScript (no frameworks)
- **Database**: SQLite with synchronous operations
- **Deployment**: Docker, Fly.io
- **CI/CD**: GitHub Actions

## Local Development

### Prerequisites

- Node.js 18 or higher
- npm or yarn

### Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd pickleball-app

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:3000`

Development mode uses `nodemon` for automatic restart on file changes.

## Environment Variables

Create a `.env` file in the root directory:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `development` | Environment mode |
| `DB_PATH` | `./data/pickleball.db` | SQLite database file path |
| `ADMIN_PASSWORD` | `pickle2024` | Admin panel password |
| `SESSION_SECRET` | `pickle-secret-2024` | Session encryption secret |

Example `.env`:
```
PORT=3000
NODE_ENV=development
ADMIN_PASSWORD=your_secure_password
SESSION_SECRET=your_random_secret_key
```

## API Endpoints

### Public Routes

- `GET /api/events` - List all events with participant counts
- `GET /api/events/:id` - Get event details with participants
- `POST /api/events/:id/join` - Join an event
- `GET /api/stats` - Get statistics

### Admin Routes (requires authentication)

- `POST /api/events` - Create new event
- `DELETE /api/events/:id` - Delete event
- `DELETE /api/participants/:id` - Remove participant
- `POST /api/admin/login` - Admin login
- `POST /api/admin/logout` - Admin logout
- `GET /api/admin/check` - Check admin status

## Deployment

### Using Fly.io

1. **Install Flyctl**
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Login to Fly.io**
   ```bash
   fly auth login
   ```

3. **First-time deployment**
   ```bash
   fly launch
   ```
   Choose "pickleball-booking" as the app name and "sin" (Singapore) as the region.

4. **Set environment secrets**
   ```bash
   fly secrets set ADMIN_PASSWORD="your_secure_password"
   fly secrets set SESSION_SECRET="your_random_secret_key"
   ```

5. **Create persistent volume**
   ```bash
   fly volumes create pickleball_data --size 1 --region sin
   ```

6. **Deploy**
   ```bash
   fly deploy
   ```

### GitHub Actions Deployment

1. Fork/push this repo to GitHub
2. Add `FLY_API_TOKEN` secret to your repository
   - Go to Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `FLY_API_TOKEN`
   - Value: Your Fly.io API token (get from `fly auth token`)

3. Push to main branch to trigger automatic deployment

### Docker

Build and run locally:
```bash
docker build -t pickleball-app .
docker run -p 3000:3000 -e ADMIN_PASSWORD=pickle2024 pickleball-app
```

## Project Structure

```
pickleball-app/
├── server.js              # Express app and API routes
├── db.js                  # Database setup and functions
├── package.json           # Dependencies
├── Dockerfile             # Container configuration
├── fly.toml              # Fly.io configuration
├── .github/
│   └── workflows/
│       └── deploy.yml    # GitHub Actions CI/CD
├── public/
│   └── index.html        # Frontend application
├── data/                 # SQLite database (created on startup)
└── README.md             # This file
```

## Database Schema

### events table
- `id` - Unique event identifier
- `title` - Event name
- `date` - Event date (YYYY-MM-DD)
- `time` - Event time (HH:MM)
- `location` - Venue/location
- `max_players` - Maximum capacity
- `description` - Optional event details
- `created_at` - Creation timestamp

### participants table
- `id` - Unique participant identifier
- `event_id` - Related event ID (foreign key)
- `name` - Player name
- `status` - 'confirmed' or 'tnd' (tentative)
- `joined_at` - Registration timestamp

## Usage

### Creating an Event

1. Click "Create Event" on the home page
2. Fill in event details (title, date, time, location, capacity)
3. Add optional description
4. Click "Create Event"

### Joining an Event

1. Browse events on the "Events" page
2. Click "Join Event" on any available event
3. Enter your name and select status (Confirmed or Tentative)
4. Click "Join Event"

### Admin Panel

1. Click "Admin" in navigation
2. Enter admin password
3. Manage events: Create, delete, and view all events
4. Manage participants: Remove participants from events

## Security Notes

- Admin password is required for sensitive operations
- Sessions expire after 7 days of inactivity
- HTTPS is enforced in production
- Database is backed up via persistent volumes on Fly.io
- Change default admin password in production!

## Performance

- Synchronous SQLite queries via better-sqlite3 for simplicity
- Indexes on commonly queried fields (event_id, date)
- Foreign key constraints for data integrity
- Automatic cascade deletion for related records

## Troubleshooting

### Database errors
- Ensure `/data` directory is writable
- Check `DB_PATH` environment variable
- Run `npm run dev` to reinitialize database

### Port already in use
```bash
# Change port via environment variable
PORT=3001 npm run dev
```

### Admin password not working
- Check `.env` file for correct `ADMIN_PASSWORD`
- Default is `pickle2024` if not set

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Support

For issues, questions, or suggestions, please open a GitHub issue.

---

Built with 🥒 by your friendly pickleball community
