/*
* Backend Application (API)
* Adds: Google/GitHub OAuth, Watchlist, Recommendations, Render/Vercel-ready CORS.
* Keeps all your original endpoints and Admin/SQL Runner intact.
*/

const express = require('express');
const db = require('./db');                  // mysql2/promise pool
const cors = require('cors');
const mysql = require('mysql2');             // for mysql.format logging
const path = require("path");
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const MySQLStore = require('express-mysql-session')(session);

const app = express();
const port = process.env.PORT || 3000;

// ---------- ENV (set these in Render/Vercel dashboard or .env) ----------
const ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5500'; // where index.html is served during dev
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev_secret_change_me';
// Admin emails (comma-separated) — if set, only these users can access admin endpoints
const ADMIN_EMAILS = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',').map(e => e.trim()) : [];

// Google OAuth
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
// GitHub OAuth
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';

// ---------- CORS & JSON ----------
app.use(cors({
  origin: ORIGIN,
  credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---------- Sessions (MySQL backed; works on Render/Vercel) ----------
const sessionStore = new MySQLStore({}, db); // pass promise pool; express-mysql-session accepts promise pools

app.use(session({
  name: 'mrsid',
  secret: SESSION_SECRET,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  proxy: true,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',          // for cross-site dev with http
    secure: false,            // set true when behind https only (Render/Vercel set X-Forwarded-Proto)
    maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
  }
}));

// ---------- Passport ----------
app.use(passport.initialize());
app.use(passport.session());

// minimal user serializer
passport.serializeUser((user, done) => done(null, user.userId));
passport.deserializeUser(async (id, done) => {
  try {
    const [rows] = await db.query('SELECT userId, userName, emailId FROM user WHERE userId = ?', [id]);
    done(null, rows[0] || null);
  } catch (e) { done(e); }
});

// Ensure user row exists (or create) by email; return user row
async function findOrCreateOAuthUser({ displayName, email }) {
  const name = displayName || (email ? email.split('@')[0] : 'User');
  // Password column might be NOT NULL in your schema; store a sentinel
  const sentinelPassword = 'OAUTH';

  const [exists] = await db.query('SELECT userId, userName, emailId FROM user WHERE emailId = ?', [email]);
  if (exists.length > 0) return exists[0];

  const [insert] = await db.query('INSERT INTO user (userName, emailId, password, joinDate) VALUES (?, ?, ?, NOW())', [name, email, sentinelPassword]);
  return { userId: insert.insertId, userName: name, emailId: email };
}

// ---------- Google Strategy ----------
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: '/api/auth/google/callback'
  }, async (_accessToken, _refreshToken, profile, done) => {
    try {
      const email = profile.emails && profile.emails[0] && profile.emails[0].value;
      if (!email) return done(null, false);
      const user = await findOrCreateOAuthUser({ displayName: profile.displayName, email });
      return done(null, user);
    } catch (e) { return done(e); }
  }));

  app.get('/api/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
  app.get('/api/auth/google/callback',
    passport.authenticate('google', { failureRedirect: `${ORIGIN}/?oauth=failure` }),
    (req, res) => res.redirect(`${ORIGIN}/?oauth=success`)
  );
}

// ---------- GitHub Strategy ----------
if (GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET) {
  passport.use(new GitHubStrategy({
    clientID: GITHUB_CLIENT_ID,
    clientSecret: GITHUB_CLIENT_SECRET,
    callbackURL: '/api/auth/github/callback',
    scope: ['user:email']
  }, async (_accessToken, _refreshToken, profile, done) => {
    try {
      let email = null;
      if (profile.emails && profile.emails.length) {
        email = profile.emails[0].value;
      }
      // If email private, synthesize using github id domain (still unique)
      if (!email) email = `${profile.username}@users.noreply.github.com`;
      const user = await findOrCreateOAuthUser({ displayName: profile.displayName || profile.username, email });
      return done(null, user);
    } catch (e) { return done(e); }
  }));

  app.get('/api/auth/github', passport.authenticate('github'));
  app.get('/api/auth/github/callback',
    passport.authenticate('github', { failureRedirect: `${ORIGIN}/?oauth=failure` }),
    (req, res) => res.redirect(`${ORIGIN}/?oauth=success`)
  );
}

// Helpers
const requireAuth = (req, res, next) => {
  if (req.user) return next();
  res.status(401).json({ error: 'Not authenticated' });
};

// requireAdmin: user must be authenticated and their email must be in ADMIN_EMAILS (if configured)
const requireAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (ADMIN_EMAILS.length > 0 && !ADMIN_EMAILS.includes(req.user.emailId)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  return next();
};

// ---------- Auth session helpers ----------
app.get('/api/auth/user', (req, res) => {
  res.json(req.user || null);
});
app.post('/api/auth/logout', (req, res) => {
  req.logout(() => {
    req.session.destroy(() => res.json({ message: 'Logged out' }));
  });
});

// ---------- Whitelist ----------
const ALLOWED_TABLES = [
  'user', 'movie', 'director', 'actor', 'genre', 'ratings',
  'movie_genre', 'movie_actor', 'production_house', 'movie_production',
  'Movie_Ratings_UNF', 'Movie_Ratings_1NF'
];

// ---------- Utilities ----------
const isTableAllowed = (tableName) => {
  if (!ALLOWED_TABLES.includes(tableName)) throw new Error(`Access to table '${tableName}' is not allowed.`);
  return true;
};

const getCurrentDbName = async () => {
  const [rows] = await db.query('SELECT DATABASE() AS db');
  return rows[0].db;
};

const getTableInfo = async (tableName) => {
  isTableAllowed(tableName);
  const dbName = await getCurrentDbName();

  const [pkRows] = await db.query(`
    SELECT k.COLUMN_NAME
    FROM information_schema.table_constraints t
    LEFT JOIN information_schema.key_column_usage k
    USING(constraint_name, table_schema, table_name)
    WHERE t.constraint_type='PRIMARY KEY'
      AND t.table_schema = ?
      AND t.table_name = ?;
  `, [dbName, tableName]);

  const [colRows] = await db.query(`
    SELECT COLUMN_NAME, DATA_TYPE, COLUMN_KEY, IS_NULLABLE, EXTRA
    FROM information_schema.columns
    WHERE table_schema = ? AND table_name = ?
  `, [dbName, tableName]);

  const compositePk = pkRows.map(r => r.COLUMN_NAME);
  return { primaryKey: compositePk.length === 1 ? compositePk[0] : null, compositeKey: compositePk, columns: colRows };
};

// ---------- Ensure Watchlist table exists ----------
async function ensureWatchlist() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS watchlist (
      userId INT NOT NULL,
      movieId INT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (userId, movieId),
      FOREIGN KEY (userId) REFERENCES user(userId),
      FOREIGN KEY (movieId) REFERENCES movie(movieId)
    )
  `);
}
ensureWatchlist().catch(console.error);

// ---------- MOVIES (Dashboard + Search) ----------
app.get('/api/movies', async (req, res) => {
  try {
    const { search } = req.query;
    const base = `
      SELECT DISTINCT
        m.movieId, m.titleName, m.releaseYear, m.imageUrl,
        AVG(r.rating) AS averageRating,
        COUNT(r.rating) AS ratingCount
      FROM movie m
      LEFT JOIN ratings r ON m.movieId = r.movieId
      LEFT JOIN director d ON m.directorId = d.directorId
      LEFT JOIN movie_actor ma ON m.movieId = ma.movieId
      LEFT JOIN actor a ON ma.actorId = a.actorId
      LEFT JOIN movie_genre mg ON m.movieId = mg.movieId
      LEFT JOIN genre g ON mg.genreId = g.genreId
    `;
    let q, p = [];
    if (search) {
      const s = `%${search}%`;
      q = `
        ${base}
        WHERE m.titleName LIKE ? OR d.directorName LIKE ? OR a.actorName LIKE ? OR g.genreName LIKE ?
        GROUP BY m.movieId, m.titleName, m.releaseYear, m.imageUrl
        ORDER BY averageRating DESC
      `;
      p = [s, s, s, s];
    } else {
      q = `
        ${base}
        GROUP BY m.movieId, m.titleName, m.releaseYear, m.imageUrl
        ORDER BY averageRating DESC
      `;
    }
    const [rows] = await db.query(q, p);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching movies:', err);
    res.status(500).json({ error: 'Failed to fetch movies' });
  }
});

// ---------- Movie Details & Ratings ----------
app.get('/api/movie_details/:id', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT m.titleName, r.rating, u.userName
      FROM ratings r
      JOIN movie m ON r.movieId = m.movieId
      JOIN user u ON r.userId = u.userId
      WHERE r.movieId = ?
    `, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Movie not found or not rated' });
    res.json(rows);
  } catch (err) {
    console.error('Error fetching movie details:', err);
    res.status(500).json({ error: 'Failed to fetch movie details' });
  }
});

app.get('/api/movie/:id', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        m.movieId, m.titleName, m.releaseYear, m.imageUrl,
        COALESCE(m.trailerUrl, '') AS trailerUrl,
        d.directorName, d.directorId,
        GROUP_CONCAT(DISTINCT a.actorName SEPARATOR ', ') AS actors,
        GROUP_CONCAT(DISTINCT ph.prodName SEPARATOR ', ') AS productionHouses
      FROM movie m
      LEFT JOIN director d ON m.directorId = d.directorId
      LEFT JOIN movie_actor ma ON m.movieId = ma.movieId
      LEFT JOIN actor a ON ma.actorId = a.actorId
      LEFT JOIN movie_production mp ON m.movieId = mp.movieId
      LEFT JOIN production_house ph ON mp.prodId = ph.prodId
      WHERE m.movieId = ?
      GROUP BY m.movieId, m.titleName, m.releaseYear, m.imageUrl, m.trailerUrl, d.directorName, d.directorId
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Movie not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error fetching single movie details:', err);
    res.status(500).json({ error: 'Failed to fetch movie details' });
  }
});

// ---------- Users ----------
app.get('/api/users', async (_req, res) => {
  try {
    const [rows] = await db.query('SELECT userId, userName, emailId FROM user');
    res.json(rows);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ---------- Ratings (upsert) ----------
app.post('/api/rate_movie', requireAuth, async (req, res) => {
  try {
    const { movieId, rating } = req.body;
    const userId = req.user.userId;
    if (!userId || !movieId || !rating) return res.status(400).json({ error: 'userId, movieId, rating required' });

    const [result] = await db.query(`
      INSERT INTO ratings (userId, movieId, rating, \`timeStamp\`)
      VALUES (?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE rating = VALUES(rating), \`timeStamp\` = NOW()
    `, [userId, movieId, rating]);

    res.status(201).json({ message: 'Rating saved successfully', affectedRows: result.affectedRows });
  } catch (err) {
    console.error('Error saving rating:', err);
    res.status(500).json({ error: 'Failed to save rating' });
  }
});


// ---------- Auth: Register/Login (plain for demo) ----------
app.post('/api/register', async (req, res) => {
  try {
    const { userName, emailId, password } = req.body;
    if (!userName || !emailId || !password) return res.status(400).json({ error: 'All fields are required.' });

    const [r] = await db.query('INSERT INTO user (userName, emailId, password, joinDate) VALUES (?, ?, ?, NOW())', [userName, emailId, password]);
    // set session
    req.login({ userId: r.insertId, userName, emailId }, err => {
      if (err) return res.status(201).json({ userId: r.insertId, userName });
      return res.status(201).json({ userId: r.insertId, userName });
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Email already exists.' });
    console.error('Error registering user:', err);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { emailId, password } = req.body;
    if (!emailId || !password) return res.status(400).json({ error: 'Email and password are required.' });

    const [rows] = await db.query('SELECT userId, userName, emailId FROM user WHERE emailId = ? AND password = ?', [emailId, password]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid email or password.' });

    const user = rows[0];
    req.login(user, err => {
      if (err) return res.json(user);
      return res.json(user);
    });
  } catch (err) {
    console.error('Error logging in:', err);
    res.status(500).json({ error: 'Failed to log in' });
  }
});

// ---------- Add Movie (transaction) ----------
async function getOrInsert(connection, table, col, value, idCol) {
  const [rows] = await connection.query(`SELECT ${idCol} FROM ${table} WHERE ${col} = ?`, [value]);
  if (rows.length) return rows[0][idCol];
  const [ins] = await connection.query(`INSERT INTO ${table} (${col}) VALUES (?)`, [value]);
  return ins.insertId;
}

app.get('/api/form_data', async (_req, res) => {
  try {
    const [directors] = await db.query('SELECT directorName FROM director');
    const [actors] = await db.query('SELECT actorName FROM actor');
    const [genres] = await db.query('SELECT genreName FROM genre');
    const [prodHouses] = await db.query('SELECT prodName FROM production_house');
    res.json({
      directors: directors.map(d => d.directorName),
      actors: actors.map(a => a.actorName),
      genres: genres.map(g => g.genreName),
      prodHouses: prodHouses.map(p => p.prodName),
    });
  } catch (err) {
    console.error('Error fetching form data:', err);
    res.status(500).json({ error: 'Failed to get form data' });
  }
});

app.post('/api/add_movie', requireAuth, async (req, res) => {
  let conn;
  try {
    const { titleName, releaseYear, directorName, actorNames, genreNames, prodHouseName, imageUrl, trailerUrl } = req.body;
    const parsedYear = parseInt(releaseYear, 10);
    conn = await db.getConnection();
    await conn.beginTransaction();

    const directorId = await getOrInsert(conn, 'director', 'directorName', directorName, 'directorId');
    const prodId     = await getOrInsert(conn, 'production_house', 'prodName', prodHouseName, 'prodId');

    // Check if trailerUrl column exists, if not, don't include it
    let insertQuery = 'INSERT INTO movie (titleName, releaseYear, directorId, imageUrl';
    let insertValues = [titleName, parsedYear, directorId, imageUrl || null];
    
    if (trailerUrl) {
      try {
        // Try to insert with trailerUrl
        const [m] = await conn.query(
          'INSERT INTO movie (titleName, releaseYear, directorId, imageUrl, trailerUrl) VALUES (?, ?, ?, ?, ?)',
          [titleName, parsedYear, directorId, imageUrl || null, trailerUrl || null]
        );
        var movieId = m.insertId;
      } catch (e) {
        // If trailerUrl column doesn't exist, insert without it
        const [m] = await conn.query(
          'INSERT INTO movie (titleName, releaseYear, directorId, imageUrl) VALUES (?, ?, ?, ?)',
          [titleName, parsedYear, directorId, imageUrl || null]
        );
        var movieId = m.insertId;
      }
    } else {
      const [m] = await conn.query(
        'INSERT INTO movie (titleName, releaseYear, directorId, imageUrl) VALUES (?, ?, ?, ?)',
        [titleName, parsedYear, directorId, imageUrl || null]
      );
      var movieId = m.insertId;
    }

    for (const name of actorNames) {
      const actorId = await getOrInsert(conn, 'actor', 'actorName', name, 'actorId');
      await conn.query('INSERT INTO movie_actor (movieId, actorId) VALUES (?, ?)', [movieId, actorId]);
    }
    for (const name of genreNames) {
      const genreId = await getOrInsert(conn, 'genre', 'genreName', name, 'genreId');
      await conn.query('INSERT INTO movie_genre (movieId, genreId) VALUES (?, ?)', [movieId, genreId]);
    }
    await conn.query('INSERT INTO movie_production (movieId, prodId) VALUES (?, ?)', [movieId, prodId]);

    await conn.commit();
    res.status(201).json({ message: 'Movie added successfully!', movieId });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error('Error adding movie:', err);
    res.status(500).json({ error: 'Failed to add movie. Transaction rolled back.' });
  } finally {
    if (conn) conn.release();
  }
});

// ---------- Admin: tables / CRUD / SQL Runner ----------
// Admin: list allowed tables (restricted)
app.get('/api/tables', requireAdmin, async (_req, res) => res.json(ALLOWED_TABLES));

app.get('/api/table/:tableName', requireAdmin, async (req, res) => {
  const { tableName } = req.params;
  const { search } = req.query;
  try {
    const tableInfo = await getTableInfo(tableName);
    let query = 'SELECT * FROM ??';
    let params = [tableName];

    if (search) {
      const searchable = tableInfo.columns.filter(c => (c.DATA_TYPE || '').includes('char') || (c.DATA_TYPE || '').includes('text'));
      const cond = searchable.map(c => '?? LIKE ?');
      if (cond.length) {
        query += ' WHERE ' + cond.join(' OR ');
        const s = `%${search}%`;
        params = [tableName, ...searchable.map(c => [c.COLUMN_NAME, s]).flat()];
      }
    }
    query += ' LIMIT 100';
    const [rows] = await db.query(query, params);
    res.json({ ...tableInfo, rows });
  } catch (err) {
    console.error(`Error fetching data for ${tableName}:`, err);
    res.status(500).json({ error: err.message || `Failed to fetch data for ${tableName}` });
  }
});

app.post('/api/table/:tableName', requireAdmin, async (req, res) => {
  const { tableName } = req.params;
  const newRecord = req.body;
  try {
    isTableAllowed(tableName);
    const tableInfo = await getTableInfo(tableName);
    const autoInc = tableInfo.columns.find(c => (c.EXTRA || '').includes('auto_increment'))?.COLUMN_NAME;

    const cols = [];
    const vals = [];
    for (const [k, v] of Object.entries(newRecord)) {
      if (k && v !== null && v !== '' && k !== autoInc) { cols.push(k); vals.push(v); }
    }
    if (!cols.length) return res.status(400).json({ error: 'No valid data provided to insert.' });

    const q = 'INSERT INTO ?? (??) VALUES (?)';
    const [r] = await db.query(q, [tableName, cols, vals]);
    res.status(201).json({ message: 'Record added successfully', insertId: r.insertId });
  } catch (err) {
    console.error(`Error adding record to ${tableName}:`, err);
    res.status(500).json({ error: err.message || `Failed to add record to ${tableName}` });
  }
});

app.put('/api/table/:tableName', requireAdmin, async (req, res) => {
  const { tableName } = req.params;
  const { primaryKeyValues, updates } = req.body;
  try {
    isTableAllowed(tableName);
    const tableInfo = await getTableInfo(tableName);

    if (!Object.keys(updates || {}).length) return res.status(400).json({ error: 'No updates provided.' });

    const setClause = Object.keys(updates).map(k => '?? = ?').join(', ');
    const setVals = Object.entries(updates).flat();
    const whereClause = tableInfo.compositeKey.map(k => '?? = ?').join(' AND ');
    const whereVals = tableInfo.compositeKey.map(k => [k, primaryKeyValues[k]]).flat();

    const q = `UPDATE ?? SET ${setClause} WHERE ${whereClause}`;
    const params = [tableName, ...setVals, ...whereVals];
    console.log('Executing:', mysql.format(q, params));

    const [r] = await db.query(q, params);
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Record not found or no changes made.' });
    res.json({ message: 'Record updated successfully' });
  } catch (err) {
    console.error(`Error updating record in ${tableName}:`, err);
    res.status(500).json({ error: err.message || `Failed to update record in ${tableName}` });
  }
});

app.delete('/api/table/:tableName', requireAdmin, async (req, res) => {
  const { tableName } = req.params;
  const primaryKeyValues = req.body;
  try {
    isTableAllowed(tableName);
    const tableInfo = await getTableInfo(tableName);

    const whereClause = tableInfo.compositeKey.map(k => '?? = ?').join(' AND ');
    const whereVals = tableInfo.compositeKey.map(k => [k, primaryKeyValues[k]]).flat();

    const q = `DELETE FROM ?? WHERE ${whereClause}`;
    const params = [tableName, ...whereVals];
    console.log('Executing:', mysql.format(q, params));

    const [r] = await db.query(q, params);
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Record not found.' });
    res.json({ message: 'Record deleted successfully' });
  } catch (err) {
    console.error(`Error deleting record from ${tableName}:`, err);
    res.status(500).json({ error: err.message || `Failed to delete record from ${tableName}` });
  }
});

// ---------- SQL Runner (DANGEROUS; dev only) ----------
// Raw SQL runner (DANGEROUS) — restrict to admin users
app.post('/api/run_query', requireAdmin, async (req, res) => {
  const { query } = req.body;
  console.warn('--- RUNNING RAW SQL QUERY ---');
  console.warn('Query:', query);
  try {
    const [results] = await db.query(query);
    res.json(results);
  } catch (err) {
    console.error('Raw SQL query error:', err);
    res.status(400).json({ error: err.message });
  }
});

// ---------- WATCHLIST ----------
app.get('/api/watchlist/:userId', requireAuth, async (req, res) => {
  const { userId } = req.params;
  if (String(req.user.userId) !== String(userId)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const [rows] = await db.query(`
      SELECT m.movieId, m.titleName, m.releaseYear, m.imageUrl
      FROM watchlist w
      JOIN movie m ON m.movieId = w.movieId
      WHERE w.userId = ?
      ORDER BY w.createdAt DESC
    `, [userId]);
    res.json(rows);
  } catch (e) {
    console.error('watchlist get error', e);
    res.status(500).json({ error: 'Failed to fetch watchlist' });
  }
});

app.post('/api/watchlist/add', requireAuth, async (req, res) => {
  try {
    const { movieId } = req.body;
    const userId = req.user.userId;
    await db.query('INSERT IGNORE INTO watchlist (userId, movieId) VALUES (?, ?)', [userId, movieId]);
    res.json({ message: 'Added to watchlist' });
  } catch (e) {
    console.error('watchlist add error', e);
    res.status(500).json({ error: 'Failed to add to watchlist' });
  }
});

app.post('/api/watchlist/remove', requireAuth, async (req, res) => {
  try {
    const { movieId } = req.body;
    const userId = req.user.userId;
    await db.query('DELETE FROM watchlist WHERE userId = ? AND movieId = ?', [userId, movieId]);
    res.json({ message: 'Removed from watchlist' });
  } catch (e) {
    console.error('watchlist remove error', e);
    res.status(500).json({ error: 'Failed to remove from watchlist' });
  }
});

// ---------- RECOMMENDATIONS ----------
app.get('/api/recommendations/:userId', requireAuth, async (req, res) => {
  const { userId } = req.params;
  if (String(req.user.userId) !== String(userId)) return res.status(403).json({ error: 'Forbidden' });
  try {
    // 1) Preferred genres from user’s high ratings (>=4)
    const [prefs] = await db.query(`
      SELECT g.genreId, g.genreName, COUNT(*) as cnt
      FROM ratings r
      JOIN movie_genre mg ON r.movieId = mg.movieId
      JOIN genre g ON g.genreId = mg.genreId
      WHERE r.userId = ? AND r.rating >= 4
      GROUP BY g.genreId, g.genreName
      ORDER BY cnt DESC
    `, [userId]);

    let rows;
    if (prefs.length) {
      // 2) Recommend movies in top 3 genres, exclude already rated
      const topGenreIds = prefs.slice(0, 3).map(g => g.genreId);
      const placeholders = topGenreIds.map(() => '?').join(',');
      const [recs] = await db.query(`
        SELECT m.movieId, m.titleName, m.releaseYear, m.imageUrl,
               AVG(r.rating) AS averageRating, COUNT(r.rating) AS ratingCount
        FROM movie m
        JOIN movie_genre mg ON m.movieId = mg.movieId
        LEFT JOIN ratings r ON r.movieId = m.movieId
        WHERE mg.genreId IN (${placeholders})
          AND m.movieId NOT IN (SELECT movieId FROM ratings WHERE userId = ?)
        GROUP BY m.movieId, m.titleName, m.releaseYear, m.imageUrl
        HAVING ratingCount >= 1
        ORDER BY averageRating DESC, ratingCount DESC
        LIMIT 20
      `, [...topGenreIds, userId]);
      rows = recs;
    } else {
      // 3) Cold start: top-rated overall
      const [recs] = await db.query(`
        SELECT m.movieId, m.titleName, m.releaseYear, m.imageUrl,
               AVG(r.rating) AS averageRating, COUNT(r.rating) AS ratingCount
        FROM movie m
        JOIN ratings r ON r.movieId = m.movieId
        GROUP BY m.movieId, m.titleName, m.releaseYear, m.imageUrl
        HAVING ratingCount >= 1
        ORDER BY averageRating DESC, ratingCount DESC
        LIMIT 20
      `);
      rows = recs;
    }

    res.json(rows);
  } catch (e) {
    console.error('recommendations error', e);
    res.status(500).json({ error: 'Failed to compute recommendations' });
  }
});

// ---------- AI RECOMMENDATIONS (Content-based + Collaborative) ----------
app.get('/api/ai-recommendations/:userId', requireAuth, async (req, res) => {
  const { userId } = req.params;
  if (String(req.user.userId) !== String(userId)) return res.status(403).json({ error: 'Forbidden' });
  try {
    // Get user's rated movies with ratings
    const [userRatings] = await db.query(`
      SELECT movieId, rating FROM ratings WHERE userId = ?
    `, [userId]);

    if (userRatings.length === 0) {
      // Cold start: return top-rated movies
      const [topMovies] = await db.query(`
        SELECT m.movieId, m.titleName, m.releaseYear, m.imageUrl,
               AVG(r.rating) AS averageRating, COUNT(r.rating) AS ratingCount
        FROM movie m
        LEFT JOIN ratings r ON m.movieId = r.movieId
        GROUP BY m.movieId, m.titleName, m.releaseYear, m.imageUrl
        HAVING ratingCount >= 3
        ORDER BY averageRating DESC, ratingCount DESC
        LIMIT 20
      `);
      return res.json(topMovies);
    }

    // Get genres and directors from user's high-rated movies (>=4)
    const highRatedIds = userRatings.filter(r => r.rating >= 4).map(r => r.movieId);
    if (highRatedIds.length === 0) {
      const ratedIds = userRatings.map(r => r.movieId);
      const placeholders = ratedIds.map(() => '?').join(',');
      const [topMovies] = await db.query(`
        SELECT m.movieId, m.titleName, m.releaseYear, m.imageUrl,
               AVG(r.rating) AS averageRating, COUNT(r.rating) AS ratingCount
        FROM movie m
        LEFT JOIN ratings r ON m.movieId = r.movieId
        WHERE m.movieId NOT IN (${placeholders})
        GROUP BY m.movieId, m.titleName, m.releaseYear, m.imageUrl
        HAVING ratingCount >= 2
        ORDER BY averageRating DESC, ratingCount DESC
        LIMIT 20
      `, ratedIds);
      return res.json(topMovies);
    }

    const placeholders = highRatedIds.map(() => '?').join(',');
    
    // Find similar movies by genre and director
    const [similar] = await db.query(`
      SELECT DISTINCT m.movieId, m.titleName, m.releaseYear, m.imageUrl,
             AVG(r.rating) AS averageRating, COUNT(r.rating) AS ratingCount,
             COUNT(DISTINCT CASE WHEN mg1.genreId = mg2.genreId THEN 1 END) AS genreMatch,
             COUNT(DISTINCT CASE WHEN m.directorId = m2.directorId THEN 1 END) AS directorMatch
      FROM movie m
      LEFT JOIN ratings r ON m.movieId = r.movieId
      LEFT JOIN movie_genre mg1 ON m.movieId = mg1.movieId
      LEFT JOIN movie_genre mg2 ON mg2.movieId IN (${placeholders})
      LEFT JOIN movie m2 ON m2.movieId IN (${placeholders})
      WHERE m.movieId NOT IN (${placeholders})
      GROUP BY m.movieId, m.titleName, m.releaseYear, m.imageUrl
      HAVING genreMatch > 0 OR directorMatch > 0
      ORDER BY (genreMatch * 2 + directorMatch) DESC, averageRating DESC, ratingCount DESC
      LIMIT 20
    `, [...highRatedIds, ...highRatedIds, ...highRatedIds]);

    res.json(similar.length > 0 ? similar : []);
  } catch (e) {
    console.error('AI recommendations error', e);
    res.status(500).json({ error: 'Failed to compute AI recommendations' });
  }
});

// ---------- SIMILAR MOVIES ----------
app.get('/api/similar-movies/:movieId', async (req, res) => {
  try {
    const { movieId } = req.params;
    const [movie] = await db.query('SELECT directorId FROM movie WHERE movieId = ?', [movieId]);
    if (!movie.length) return res.status(404).json({ error: 'Movie not found' });

    // Get movies with same genres
    const [similarByGenre] = await db.query(`
      SELECT DISTINCT m.movieId, m.titleName, m.releaseYear, m.imageUrl,
             AVG(r.rating) AS averageRating, COUNT(r.rating) AS ratingCount
      FROM movie m
      JOIN movie_genre mg1 ON m.movieId = mg1.movieId
      JOIN movie_genre mg2 ON mg1.genreId = mg2.genreId
      LEFT JOIN ratings r ON m.movieId = r.movieId
      WHERE mg2.movieId = ? AND m.movieId != ?
      GROUP BY m.movieId, m.titleName, m.releaseYear, m.imageUrl
      ORDER BY averageRating DESC, ratingCount DESC
      LIMIT 10
    `, [movieId, movieId]);

    res.json(similarByGenre);
  } catch (e) {
    console.error('Similar movies error', e);
    res.status(500).json({ error: 'Failed to fetch similar movies' });
  }
});

// ---------- SIMILAR BY DIRECTOR ----------
app.get('/api/similar-by-director/:movieId', async (req, res) => {
  try {
    const { movieId } = req.params;
    const [movie] = await db.query('SELECT directorId FROM movie WHERE movieId = ?', [movieId]);
    if (!movie.length || !movie[0].directorId) return res.json([]);

    const [similar] = await db.query(`
      SELECT m.movieId, m.titleName, m.releaseYear, m.imageUrl,
             AVG(r.rating) AS averageRating, COUNT(r.rating) AS ratingCount
      FROM movie m
      LEFT JOIN ratings r ON m.movieId = r.movieId
      WHERE m.directorId = ? AND m.movieId != ?
      GROUP BY m.movieId, m.titleName, m.releaseYear, m.imageUrl
      ORDER BY averageRating DESC, ratingCount DESC
      LIMIT 10
    `, [movie[0].directorId, movieId]);

    res.json(similar);
  } catch (e) {
    console.error('Similar by director error', e);
    res.status(500).json({ error: 'Failed to fetch similar movies' });
  }
});

// ---------- SIMILAR BY PRODUCTION HOUSE ----------
app.get('/api/similar-by-production/:movieId', async (req, res) => {
  try {
    const { movieId } = req.params;
    const [prodHouses] = await db.query(`
      SELECT prodId FROM movie_production WHERE movieId = ?
    `, [movieId]);
    if (!prodHouses.length) return res.json([]);

    const prodIds = prodHouses.map(p => p.prodId);
    const placeholders = prodIds.map(() => '?').join(',');

    const [similar] = await db.query(`
      SELECT DISTINCT m.movieId, m.titleName, m.releaseYear, m.imageUrl,
             AVG(r.rating) AS averageRating, COUNT(r.rating) AS ratingCount
      FROM movie m
      JOIN movie_production mp ON m.movieId = mp.movieId
      LEFT JOIN ratings r ON m.movieId = r.movieId
      WHERE mp.prodId IN (${placeholders}) AND m.movieId != ?
      GROUP BY m.movieId, m.titleName, m.releaseYear, m.imageUrl
      ORDER BY averageRating DESC, ratingCount DESC
      LIMIT 10
    `, [...prodIds, movieId]);

    res.json(similar);
  } catch (e) {
    console.error('Similar by production error', e);
    res.status(500).json({ error: 'Failed to fetch similar movies' });
  }
});

// ---------- USER RATINGS (for Profile page) ----------
app.get('/api/user-ratings/:userId', requireAuth, async (req, res) => {
  const { userId } = req.params;
  if (String(req.user.userId) !== String(userId)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const [ratings] = await db.query(`
      SELECT r.movieId, r.rating, r.timeStamp,
             m.titleName, m.releaseYear, m.imageUrl
      FROM ratings r
      JOIN movie m ON r.movieId = m.movieId
      WHERE r.userId = ?
      ORDER BY r.timeStamp DESC
    `, [userId]);
    res.json(ratings);
  } catch (e) {
    console.error('User ratings error', e);
    res.status(500).json({ error: 'Failed to fetch user ratings' });
  }
});

// ---------- START ----------
app.listen(port, () => {
  console.log(`Backend server running at http://localhost:${port}`);
  console.log('OAuth routes enabled:',
    !!GOOGLE_CLIENT_ID || !!GITHUB_CLIENT_ID ? 'YES' : 'NO (set env vars)'
  );
});
