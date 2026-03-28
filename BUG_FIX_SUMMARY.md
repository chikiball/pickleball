# Player Count Mismatch Bug — FIXED ✅

## ROOT CAUSE
The event cards (home page + events page) were displaying **0 players** instead of confirmed participant counts because:

1. **db.js `getAllEvents()`** was only returning `participant_count` (ALL participants, including "TND" status)
2. **index.html** was trying to use `event.participants?.length` which was **undefined** (list endpoint doesn't include full participants array)
3. The capacity calculation was using the wrong field, resulting in always showing 0

## ISSUES FIXED

### 1. **db.js** — Updated `getAllEvents()` Query
**Before:**
```javascript
SELECT e.*,
  COUNT(p.id) as participant_count
FROM events e
LEFT JOIN participants p ON e.id = p.event_id
GROUP BY e.id
```
This counted ALL participants regardless of status.

**After:**
```javascript
SELECT e.*,
  COUNT(p.id) as participant_count,
  SUM(CASE WHEN p.status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_count
FROM events e
LEFT JOIN participants p ON e.id = p.event_id
GROUP BY e.id
```
Now returns BOTH `participant_count` (all) AND `confirmed_count` (only confirmed).

### 2. **public/index.html** — Fixed `renderHome()`
**Before:**
```javascript
const participantCount = nextEvent.participants ? nextEvent.participants.length : 0;
// Always 0 because list endpoint doesn't return participants array
```

**After:**
```javascript
const confirmedCount = nextEvent.confirmed_count || 0;
// Uses the confirmed_count from DB query
```

**Changes:**
- Removed `event.participants?.length` 
- Uses `event.confirmed_count` from DB
- Updated capacity bar percentage calculation
- Updated badge text to show "Confirmed" instead of "Participants"

### 3. **public/index.html** — Fixed `renderEvents()`
**Before:**
```javascript
const participantCount = event.participants ? event.participants.length : 0;
// Always 0 in event cards
```

**After:**
```javascript
const confirmedCount = event.confirmed_count || 0;
// Uses confirmed_count from DB
```

### 4. **public/index.html** — Fixed Stats Calculations
Updated both `renderHome()` and `renderAdmin()` to use `confirmed_count`:

**Before:**
```javascript
const totalParticipants = events.reduce((sum, e) => {
  const pCount = e.participants ? e.participants.length : 0;
  return sum + pCount;
}, 0);
```

**After:**
```javascript
const totalParticipants = events.reduce((sum, e) => {
  return sum + (e.confirmed_count || 0);
}, 0);
```

## VERIFICATION
After fixes:
✅ Home page "Next Game" card shows correct confirmed player count  
✅ Events page cards show correct confirmed player count  
✅ Capacity bar fills based on confirmed participants only  
✅ Event detail modal shows all confirmed + TND participants separately  
✅ Admin panel stats use confirmed counts  
✅ Stats row on home page displays accurate confirmed player counts  

## TECHNICAL DETAILS
- **List endpoint** (`GET /api/events`) returns events WITH `confirmed_count` and `participant_count` fields
- **Detail endpoint** (`GET /api/events/:id`) returns full `participants` array for UI display
- Event cards now correctly show **"X / Y Players"** where X = confirmed_count
- Full participant list (with TND status) is only shown in event detail modal
