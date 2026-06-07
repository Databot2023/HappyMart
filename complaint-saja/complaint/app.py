from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify, abort
from datetime import datetime, timedelta
import sqlite3
import os
import json
import uuid
import secrets
import hashlib
from functools import wraps
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash, check_password_hash


# Load environment variables from .env
load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY', secrets.token_hex(32))
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = True  # Only send over HTTPS in production
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=12)
app.config['JSON_SORT_KEYS'] = False
DB = 'complaints.db'

# Security Headers
@app.after_request
def set_security_headers(response):
    """Set security headers to prevent common attacks"""
    response.headers['X-Content-Type-Options'] = 'nosniff'  # Prevent MIME type sniffing
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'  # Prevent clickjacking
    response.headers['X-XSS-Protection'] = '1; mode=block'  # Enable XSS protection
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'  # HSTS
    response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://fonts.googleapis.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com; img-src 'self' data:; font-src 'self' https://fonts.gstatic.com;"
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    response.headers['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()'
    return response

# ─── RATE LIMITING ────────────────────────────────────────────────────────────
_login_attempts = {}  # {ip: {'count': int, 'blocked_until': datetime}}
RATE_LIMIT_MAX = 5
RATE_LIMIT_WINDOW = timedelta(minutes=15)

def check_rate_limit(ip):
    now = datetime.now()
    entry = _login_attempts.get(ip)
    if entry and entry.get('blocked_until') and now < entry['blocked_until']:
        return False
    return True

def record_failed_login(ip):
    now = datetime.now()
    entry = _login_attempts.get(ip, {'count': 0, 'blocked_until': None})
    entry['count'] = entry.get('count', 0) + 1
    if entry['count'] >= RATE_LIMIT_MAX:
        entry['blocked_until'] = now + RATE_LIMIT_WINDOW
    _login_attempts[ip] = entry

def clear_failed_login(ip):
    _login_attempts.pop(ip, None)

# ─── INPUT VALIDATION & SANITIZATION ──────────────────────────────────────────

def sanitize_input(value, max_length=255):
    """Sanitize user input to prevent XSS and injection attacks"""
    if not value:
        return ''
    # Trim whitespace and limit length
    value = str(value).strip()[:max_length]
    return value

def validate_username(username):
    """Validate username format"""
    if not username or len(username) < 3 or len(username) > 50:
        return False
    # Allow alphanumeric and underscores only
    return username.replace('_', '').isalnum()

def validate_password(password):
    """Validate password requirements"""
    if not password or len(password) < 6 or len(password) > 128:
        return False
    return True

def validate_complaint_note(note):
    """Validate complaint note"""
    if not note or len(note.strip()) < 1 or len(note) > 1000:
        return False
    return True

def sanitize_html(text):
    """Basic HTML sanitization to prevent XSS"""
    import html
    return html.escape(text)

# Hardcoded Credentials from .env
ADMIN_USERNAME = os.getenv('ADMIN_USERNAME', 'admin')
ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD', 'test123')

def parse_datetime_input(value):
    value = (value or '').strip()
    if not value:
        return None

    for fmt in ('%Y-%m-%dT%H:%M', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M'):
        try:
            return datetime.strptime(value, fmt).strftime('%Y-%m-%d %H:%M:%S')
        except ValueError:
            continue
    return None

def get_db():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    return conn

# ─── SESSION MANAGEMENT FUNCTIONS ────────────────────────────────────────────

def generate_session_token():
    """Generate a unique session token using UUID4"""
    return str(uuid.uuid4())

def create_user_session(user_id, username, ip_address=None, device_info=None):
    """Create a new session for a user. Note: Caller must ensure no active session exists."""
    token = generate_session_token()
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    conn = get_db()
    try:
        # Create new session (do NOT terminate existing sessions - caller ensures none exist)
        conn.execute("""
            INSERT INTO user_sessions (user_id, session_token, ip_address, device_info, created_at, last_active, is_active)
            VALUES (?, ?, ?, ?, ?, ?, 1)
        """, (user_id, token, ip_address, device_info, now, now))
        
        conn.commit()
    finally:
        conn.close()
    
    return token

def get_active_session_token():
    """Get the current session token from Flask session"""
    return session.get('session_token')

def has_active_session(user_id):
    """Check if the user already has an active session"""
    conn = get_db()
    try:
        row = conn.execute("""
            SELECT session_token FROM user_sessions 
            WHERE user_id=? AND is_active=1
        """, (user_id,)).fetchone()
        return row is not None
    finally:
        conn.close()

def validate_user_session(user_id):
    """Validate that the current session token is still active in the database"""
    token = get_active_session_token()
    if not token:
        return False
    
    conn = get_db()
    try:
        row = conn.execute("""
            SELECT is_active FROM user_sessions 
            WHERE user_id=? AND session_token=? AND is_active=1
        """, (user_id, token)).fetchone()
        
        is_valid = row is not None and row['is_active'] == 1
        
        # Update last_active timestamp if session is valid
        if is_valid:
            now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            conn.execute("UPDATE user_sessions SET last_active=? WHERE session_token=?", (now, token))
            conn.commit()
        
        return is_valid
    finally:
        conn.close()

def terminate_user_session(user_id):
    """Terminate the current user's session"""
    token = get_active_session_token()
    if token:
        conn = get_db()
        try:
            conn.execute("UPDATE user_sessions SET is_active=0 WHERE user_id=? AND session_token=?", (user_id, token))
            conn.commit()
        finally:
            conn.close()

def terminate_all_user_sessions(user_id):
    """Terminate all active sessions for a user (Logout All)"""
    conn = get_db()
    try:
        conn.execute("UPDATE user_sessions SET is_active=0 WHERE user_id=?", (user_id,))
        conn.commit()
    finally:
        conn.close()

def cleanup_expired_sessions():
    """Remove sessions that have been inactive for more than 7 days"""
    cutoff = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d %H:%M:%S')
    conn = get_db()
    try:
        conn.execute("DELETE FROM user_sessions WHERE last_active < ?", (cutoff,))
        conn.commit()
    finally:
        conn.close()

# ─── DECORATORS ───────────────────────────────────────────────────────────────

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            flash('Please log in to access this page.', 'error')
            return redirect(url_for('login'))
        
        # Validate session token
        if not validate_user_session(session['user_id']):
            session.clear()
            flash("You've been logged out because another device logged in with your credentials.", 'error')
            return redirect(url_for('login'))
        
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('admin_login'))
        
        # Validate session token for admin
        if not validate_user_session(session['user_id']):
            session.clear()
            flash("You've been logged out because another device logged in with your credentials.", 'error')
            return redirect(url_for('admin_login'))
        
        # Strict check: role must be admin AND username must match current .env
        if session.get('role') != 'admin' or session.get('username') != ADMIN_USERNAME:
            session.clear()
            flash('Admin credentials changed or session expired. Please log in again.', 'error')
            return redirect(url_for('admin_login'))
        return f(*args, **kwargs)
    return decorated_function

def generate_csrf_token():
    if '_csrf_token' not in session:
        session['_csrf_token'] = secrets.token_hex(32)
    return session['_csrf_token']

@app.context_processor
def inject_csrf_token():
    return dict(csrf_token=generate_csrf_token())

def init_db():
    conn = get_db()
    c = conn.cursor()

    # Migration check: If the old 'users' table exists with 'email' (from Google OAuth), drop it.
    try:
        c.execute("SELECT username FROM users LIMIT 1")
    except sqlite3.OperationalError:
        try:
            c.execute("SELECT email FROM users LIMIT 1")
            c.execute("DROP TABLE users")
            conn.commit()
        except sqlite3.OperationalError:
            pass 
    
    c.executescript('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            is_approved INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS places (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL
        );
        CREATE TABLE IF NOT EXISTS complaints (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            place_id INTEGER NOT NULL,
            note TEXT NOT NULL,
            created_at TEXT NOT NULL,
            is_read INTEGER DEFAULT 0,
            is_completed INTEGER DEFAULT 0,
            completed_at TEXT DEFAULT NULL,
            assigned_to_user_id INTEGER DEFAULT NULL,
            FOREIGN KEY (place_id) REFERENCES places(id),
            FOREIGN KEY (assigned_to_user_id) REFERENCES users(id) ON DELETE SET NULL
        );
        CREATE TABLE IF NOT EXISTS user_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            session_token TEXT UNIQUE NOT NULL,
            ip_address TEXT,
            device_info TEXT,
            created_at TEXT NOT NULL,
            last_active TEXT NOT NULL,
            is_active INTEGER DEFAULT 1,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS task_notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            complaint_id INTEGER NOT NULL,
            message TEXT NOT NULL,
            created_at TEXT NOT NULL,
            is_read INTEGER DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE
        );
    ''')

    # Migration: Hash all existing plaintext passwords
    users = c.execute("SELECT id, password FROM users").fetchall()
    for user in users:
        if not user['password'].startswith('scrypt:') and not user['password'].startswith('pbkdf2:'):
            hashed = generate_password_hash(user['password'])
            c.execute("UPDATE users SET password=? WHERE id=?", (hashed, user['id']))

    # Seed default sample users
    for u, p in [('user1', 'pass1'), ('user2', 'pass2'), ('user3', 'pass3')]:
        c.execute("SELECT * FROM users WHERE username=?", (u,))
        if not c.fetchone():
            hashed_p = generate_password_hash(p)
            c.execute("INSERT INTO users (username, password, role, is_approved) VALUES (?, ?, ?, ?)",
                      (u, hashed_p, 'user', 1))
    
    # Seed sample places only if table is empty
    c.execute("SELECT COUNT(*) FROM places")
    if c.fetchone()[0] == 0:
        for place in ['Main Hall', 'Block A', 'Block B', 'Cafeteria', 'Library', 'Sports Ground']:
            c.execute("INSERT INTO places (name) VALUES (?)", (place,))

    # Migration: add columns if they don't exist
    try:
        c.execute("ALTER TABLE complaints ADD COLUMN is_completed INTEGER DEFAULT 0")
        c.execute("ALTER TABLE complaints ADD COLUMN completed_at TEXT DEFAULT NULL")
    except: pass

    # Migration: Add assigned_to_user_id column if it doesn't exist
    try:
        c.execute("ALTER TABLE complaints ADD COLUMN assigned_to_user_id INTEGER DEFAULT NULL")
    except: pass

    conn.commit()
    conn.close()

@app.before_request
def auto_cleanup_and_csrf():
    # CSRF Protection
    if request.method == "POST":
        token = session.get('_csrf_token', None)
        if not token or token != request.form.get('_csrf_token'):
            # Allow auth routes to skip CSRF if they fail, since they regenerate session
            if request.endpoint not in ['login', 'admin_login', 'register']:
                abort(403, "CSRF token mismatch")

    cutoff = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d %H:%M:%S')
    conn = get_db()
    try:
        # Clean up old completed complaints
        conn.execute("DELETE FROM complaints WHERE is_completed=1 AND completed_at <= ?", (cutoff,))
        
        # Clean up expired user sessions (inactive for more than 7 days)
        conn.execute("DELETE FROM user_sessions WHERE last_active <= ?", (cutoff,))
        
        # Clean up old notifications
        conn.execute("DELETE FROM task_notifications WHERE created_at <= ?", (cutoff,))
        
        conn.commit()
    finally:
        conn.close()

@app.errorhandler(403)
def forbidden(error):
    """Handle CSRF token errors"""
    flash('Security validation failed. Please try again.', 'error')
    return redirect(url_for('login')), 403

@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors"""
    return render_template('404.html'), 404

@app.errorhandler(500)
def internal_error(error):
    """Handle server errors securely"""
    flash('An unexpected error occurred. Please try again later.', 'error')
    return redirect(url_for('index')), 500

@app.route('/')
def index():
    if 'user_id' in session:
        if session['role'] == 'admin':
            return redirect(url_for('admin_dashboard'))
        return redirect(url_for('user_dashboard'))
    return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    # If user is already logged in, redirect to dashboard
    if 'user_id' in session and session.get('role') == 'user':
        return redirect(url_for('user_dashboard'))
    
    if request.method == 'POST':
        ip_address = request.remote_addr or '0.0.0.0'
        
        # Rate limiting check
        if not check_rate_limit(ip_address):
            flash('Too many failed login attempts. Please try again in 15 minutes.', 'error')
            return redirect(url_for('login'))
        
        username = request.form.get('username', '').strip()[:50]
        password = request.form.get('password', '').strip()[:128]
        
        # Input validation - prevent empty credentials
        if not username or not password:
            flash('Username and password are required.', 'error')
            return redirect(url_for('login'))
        
        # Additional validation - check for basic format
        if len(username) < 3 or len(password) < 3:
            flash('Invalid username or password format.', 'error')
            return redirect(url_for('login'))
        
        # Check Database for Users only
        conn = get_db()
        user = conn.execute("SELECT * FROM users WHERE username=? AND role='user'",
                            (username,)).fetchone()
        
        password_valid = False
        if user:
            stored_pw = user['password']
            # Support both hashed and legacy plaintext passwords
            if stored_pw.startswith('pbkdf2:') or stored_pw.startswith('scrypt:'):
                password_valid = check_password_hash(stored_pw, password)
            else:
                password_valid = (stored_pw == password)
        
        if user and password_valid:
            user_id = user['id']
            user_username = user['username']
            is_approved = user['is_approved']
            conn.close()
            
            if not is_approved:
                flash('Your account is pending admin approval.', 'error')
                return redirect(url_for('login'))
            
            # Kick any existing sessions (ONE DEVICE AT A TIME - fixes the one-device-at-a-time bug)
            terminate_all_user_sessions(user_id)
            
            # Get client info for session tracking
            device_info = request.headers.get('User-Agent', '')[:255]
            
            # Create new session
            session_token = create_user_session(user_id, user_username, ip_address, device_info)
            
            # Set Flask session with SECURE options
            session.clear()
            session.permanent = True
            session['user_id'] = user_id
            session['username'] = user_username
            session['role'] = 'user'
            session['session_token'] = session_token
            session['ip_address'] = ip_address  # Store IP for additional validation
            
            clear_failed_login(ip_address)
            return redirect(url_for('user_dashboard'))
        
        if conn:
            conn.close()
        record_failed_login(ip_address)
        flash('Invalid username or password.', 'error')
            
    # If it's a GET request and user is already logged in, send them home
    if 'user_id' in session:
        return redirect(url_for('index'))
        
    return render_template('login.html')

@app.route('/admin/login', methods=['GET', 'POST'])
def admin_login():
    # If admin is already logged in, redirect to dashboard
    if 'user_id' in session and session.get('role') == 'admin':
        return redirect(url_for('admin_dashboard'))
    
    if request.method == 'POST':
        ip_address = request.remote_addr or '0.0.0.0'
        
        # Rate limiting check
        if not check_rate_limit(ip_address):
            flash('Too many failed login attempts. Please try again in 15 minutes.', 'error')
            return redirect(url_for('admin_login'))
        
        username = request.form.get('username', '').strip()[:50]
        password = request.form.get('password', '').strip()[:128]
        
        # Input validation
        if not username or not password:
            flash('Admin username and password are required.', 'error')
            return redirect(url_for('admin_login'))
        
        # Additional validation
        if len(username) < 3 or len(password) < 3:
            flash('Invalid credentials format.', 'error')
            return redirect(url_for('admin_login'))
        
        # Check Admin Credentials only
        if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
            # Kick any existing admin sessions (fixes one-device-at-a-time bug)
            terminate_all_user_sessions(9999)
            
            # Get client info for session tracking
            device_info = request.headers.get('User-Agent', '')[:255]
            
            # Create new session (user_id 9999 for admin)
            session_token = create_user_session(9999, username, ip_address, device_info)
            
            # Set Flask session with SECURE options
            session.clear()
            session.permanent = True
            session['user_id'] = 9999
            session['username'] = username
            session['role'] = 'admin'
            session['session_token'] = session_token
            session['ip_address'] = ip_address  # Store IP for additional validation
            
            clear_failed_login(ip_address)
            flash(f'Welcome back, Admin {username}!', 'success')
            return redirect(url_for('admin_dashboard'))
        
        record_failed_login(ip_address)
        flash('Invalid admin credentials.', 'error')
            
    # If it's a GET request and user is already logged in as admin, send them home
    if 'user_id' in session and session.get('role') == 'admin':
        return redirect(url_for('admin_dashboard'))
        
    return render_template('admin_login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('username', '').strip()[:50]
        password = request.form.get('password', '').strip()[:128]
        
        # Input validation
        if not username or not password:
            flash('All fields are required.', 'error')
            return redirect(url_for('register'))
        
        # Stronger validation - minimum length
        if len(username) < 3 or len(password) < 6:
            flash('Username must be at least 3 characters and password at least 6 characters.', 'error')
            return redirect(url_for('register'))
        
        # Check for valid username format (alphanumeric and underscore only)
        if not username.replace('_', '').isalnum():
            flash('Username can only contain letters, numbers, and underscores.', 'error')
            return redirect(url_for('register'))
            
        conn = get_db()
        existing = conn.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()
        if existing:
            conn.close()
            flash('Username already exists.', 'error')
            return redirect(url_for('register'))
            
        hashed_password = generate_password_hash(password)
        try:
            conn.execute("INSERT INTO users (username, password, role, is_approved) VALUES (?, ?, 'user', 0)",
                        (username, hashed_password))
            conn.commit()
            flash('Registration successful! Please wait for admin approval.', 'success')
        except sqlite3.Error:
            flash('Registration failed. Please try again.', 'error')
        finally:
            conn.close()
        return redirect(url_for('login'))
    return render_template('register.html')

@app.route('/logout')
def logout():
    # Terminate session in database if user is logged in
    if 'user_id' in session:
        terminate_user_session(session['user_id'])
    session.clear()
    flash('You have been logged out.', 'success')
    return redirect(url_for('login'))

@app.route('/logout-all')
def logout_all():
    """Logout from all devices - terminates all active sessions for the user"""
    if 'user_id' in session:
        terminate_all_user_sessions(session['user_id'])
    session.clear()
    flash('You have been logged out from all devices.', 'success')
    return redirect(url_for('login'))

# ─── ADMIN ROUTES ────────────────────────────────────────────────────────────

@app.route('/admin')
@admin_required
def admin_dashboard():
    conn = get_db()
    places = conn.execute("SELECT * FROM places ORDER BY name").fetchall()
    all_complaints = conn.execute('''
        SELECT c.*, p.name as place_name 
        FROM complaints c JOIN places p ON c.place_id = p.id
        ORDER BY c.created_at DESC
    ''').fetchall()
    active = [c for c in all_complaints if not c['is_completed']]
    
    # Enrich completed complaints with days_left until auto-delete
    done = []
    for c in all_complaints:
        if c['is_completed']:
            row = dict(c)
            if c['completed_at']:
                try:
                    comp_dt = datetime.strptime(c['completed_at'][:19], '%Y-%m-%d %H:%M:%S')
                    # Calculate days remaining until 7-day auto-expiry
                    row['days_left'] = max(0, 7 - (datetime.now() - comp_dt).days)
                except Exception:
                    row['days_left'] = None
            else:
                row['days_left'] = None
            done.append(row)
            
    stats = {
        'total': len(all_complaints), 
        'active': len(active), 
        'places': len(places), 
        'completed': len(done)
    }
    conn.close()
    return render_template(
        'admin_dashboard.html',
        places=places,
        active_complaints=active,
        completed_complaints=done,
        stats=stats,
        now=datetime.now().strftime('%Y-%m-%dT%H:%M')
    )

@app.route('/admin/add_complaint', methods=['POST'])
@admin_required
def add_complaint():
    place_id = request.form.get('place_id', '').strip()
    created_at = parse_datetime_input(request.form.get('created_at'))
    raw_batch = request.form.get('complaints_json', '').strip()
    note = request.form.get('note', '').strip()

    # Input validation
    if not place_id or not place_id.isdigit():
        flash('Invalid place selected.', 'error')
        return redirect(url_for('admin_dashboard'))
    
    if not created_at:
        flash('A valid complaint date is required.', 'error')
        return redirect(url_for('admin_dashboard'))

    complaints = []
    if raw_batch:
        try:
            parsed = json.loads(raw_batch)
        except json.JSONDecodeError:
            flash('Invalid complaint format. Please check the JSON.', 'error')
            return redirect(url_for('admin_dashboard'))

        if isinstance(parsed, list):
            complaints = [
                sanitize_input(str(item).strip(), 1000)
                for item in parsed
                if isinstance(item, str) and str(item).strip() and validate_complaint_note(str(item).strip())
            ]
    elif note:
        if not validate_complaint_note(note):
            flash('Complaint note must be between 1 and 1000 characters.', 'error')
            return redirect(url_for('admin_dashboard'))
        complaints = [sanitize_input(note, 1000)]

    if not place_id or not created_at or not complaints:
        flash('Place, complaint list, and a valid complaint date are required.', 'error')
        return redirect(url_for('admin_dashboard'))

    if len(complaints) > 10:
        flash('You can submit a maximum of 10 complaints at once.', 'error')
        return redirect(url_for('admin_dashboard'))

    conn = get_db()
    try:
        # Verify place exists
        place_check = conn.execute("SELECT id FROM places WHERE id=?", (place_id,)).fetchone()
        if not place_check:
            flash('Selected place does not exist.', 'error')
            return redirect(url_for('admin_dashboard'))
        
        conn.executemany(
            "INSERT INTO complaints (place_id, note, created_at) VALUES (?, ?, ?)",
            [(place_id, complaint, created_at) for complaint in complaints]
        )
        conn.commit()
        flash(f'{len(complaints)} complaint(s) added!', 'success')
    except sqlite3.Error as e:
        conn.rollback()
        flash('Unable to save the complaint batch. Please try again.', 'error')
    finally:
        conn.close()
    return redirect(url_for('admin_dashboard'))

@app.route('/admin/update_complaint/<int:cid>', methods=['POST'])
@admin_required
def update_complaint(cid):
    # Input validation
    if not isinstance(cid, int) or cid < 1:
        flash('Invalid complaint ID.', 'error')
        return redirect(url_for('admin_dashboard'))
    
    place_id = request.form.get('place_id', '').strip()
    note = request.form.get('note', '').strip()
    created_at = parse_datetime_input(request.form.get('created_at'))

    # Validate inputs
    if not place_id or not place_id.isdigit():
        flash('Invalid place selected.', 'error')
        return redirect(url_for('admin_dashboard'))
    
    if not validate_complaint_note(note):
        flash('Complaint note must be between 1 and 1000 characters.', 'error')
        return redirect(url_for('admin_dashboard'))
    
    if not created_at:
        flash('A valid complaint date is required.', 'error')
        return redirect(url_for('admin_dashboard'))

    note = sanitize_input(note, 1000)
    
    conn = get_db()
    try:
        # Verify complaint exists
        existing = conn.execute("SELECT id FROM complaints WHERE id=?", (cid,)).fetchone()
        if not existing:
            flash('Complaint not found.', 'error')
            return redirect(url_for('admin_dashboard'))
        
        # Verify place exists
        place_check = conn.execute("SELECT id FROM places WHERE id=?", (place_id,)).fetchone()
        if not place_check:
            flash('Selected place does not exist.', 'error')
            return redirect(url_for('admin_dashboard'))
        
        conn.execute(
            "UPDATE complaints SET place_id=?, note=?, created_at=? WHERE id=?",
            (place_id, note, created_at, cid)
        )
        conn.commit()
        flash('Complaint updated.', 'success')
    except sqlite3.Error:
        flash('Failed to update complaint.', 'error')
    finally:
        conn.close()
    return redirect(url_for('admin_dashboard'))

@app.route('/admin/add_place', methods=['POST'])
@admin_required
def add_place():
    name = request.form.get('place_name', '').strip()
    
    # Input validation
    if not name or len(name) < 2 or len(name) > 100:
        flash('Place name must be between 2 and 100 characters.', 'error')
        return redirect(url_for('admin_dashboard'))
    
    name = sanitize_input(name, 100)
    
    conn = get_db()
    try:
        conn.execute("INSERT INTO places (name) VALUES (?)", (name,))
        conn.commit()
        flash(f'Place "{name}" added successfully.', 'success')
    except sqlite3.IntegrityError:
        flash('Place with this name already exists.', 'error')
    except sqlite3.Error:
        flash('Failed to add place.', 'error')
    finally:
        conn.close()
    return redirect(url_for('admin_dashboard'))

@app.route('/admin/delete_complaint/<int:cid>', methods=['POST'])
@admin_required
def delete_complaint(cid):
    """Safely delete a complaint with validation"""
    if not isinstance(cid, int) or cid < 1:
        flash('Invalid complaint ID.', 'error')
        return redirect(url_for('admin_dashboard'))
    
    conn = get_db()
    try:
        # Verify complaint exists
        complaint = conn.execute("SELECT id FROM complaints WHERE id=?", (cid,)).fetchone()
        if not complaint:
            flash('Complaint not found.', 'error')
            return redirect(url_for('admin_dashboard'))
        
        conn.execute("DELETE FROM complaints WHERE id=?", (cid,))
        conn.commit()
        flash('Complaint deleted successfully.', 'success')
    except sqlite3.Error as e:
        flash('Failed to delete complaint.', 'error')
    finally:
        conn.close()
    return redirect(url_for('admin_dashboard'))

@app.route('/admin/delete_place/<int:pid>', methods=['POST'])
@admin_required
def delete_place(pid):
    """Safely delete a place and related complaints"""
    if not isinstance(pid, int) or pid < 1:
        flash('Invalid place ID.', 'error')
        return redirect(url_for('admin_dashboard'))
    
    conn = get_db()
    try:
        # Verify place exists
        place = conn.execute("SELECT id FROM places WHERE id=?", (pid,)).fetchone()
        if not place:
            flash('Place not found.', 'error')
            return redirect(url_for('admin_dashboard'))
        
        conn.execute("DELETE FROM complaints WHERE place_id=?", (pid,))
        conn.execute("DELETE FROM places WHERE id=?", (pid,))
        conn.commit()
        flash('Place and related complaints deleted successfully.', 'success')
    except sqlite3.Error:
        flash('Failed to delete place.', 'error')
    finally:
        conn.close()
    return redirect(url_for('admin_dashboard'))

# ─── USER ROUTES ─────────────────────────────────────────────────────────────

@app.route('/user')
@login_required
def user_dashboard():
    if session.get('role') == 'admin': return redirect(url_for('admin_dashboard'))
    conn = get_db()
    
    # Get assigned tasks for this user (with unread notifications)
    user_id = session['user_id']
    
    places = conn.execute("SELECT * FROM places ORDER BY name").fetchall()
    place_data = []
    for p in places:
        count = conn.execute("SELECT COUNT(*) as cnt FROM complaints WHERE place_id=? AND is_completed=0", (p['id'],)).fetchone()['cnt']
        if count > 0: place_data.append({'id': p['id'], 'name': p['name'], 'count': count})
    
    # Get unread notifications count
    unread_notif_count = conn.execute("""
        SELECT COUNT(*) as cnt FROM task_notifications 
        WHERE user_id=? AND is_read=0
    """, (user_id,)).fetchone()['cnt']
    
    # Get assigned tasks/complaints
    assigned_tasks = conn.execute("""
        SELECT c.id, c.note, p.name as place_name, c.created_at 
        FROM complaints c 
        JOIN places p ON c.place_id = p.id 
        WHERE c.assigned_to_user_id=? AND c.is_completed=0 
        ORDER BY c.created_at DESC
    """, (user_id,)).fetchall()
    
    conn.close()
    return render_template('user_dashboard.html', places=place_data, 
                         unread_notifications=unread_notif_count,
                         assigned_tasks=len(assigned_tasks))

@app.route('/user/place/<int:place_id>')
@login_required
def view_place(place_id):
    if session.get('role') == 'admin': return redirect(url_for('admin_dashboard'))
    conn = get_db()
    place = conn.execute("SELECT * FROM places WHERE id=?", (place_id,)).fetchone()
    complaints = conn.execute("SELECT * FROM complaints WHERE place_id=? ORDER BY created_at DESC", (place_id,)).fetchall()
    conn.execute("UPDATE complaints SET is_read=1 WHERE place_id=?", (place_id,))
    conn.commit(); conn.close()
    pending = [c for c in complaints if not c['is_completed']]
    finished = [c for c in complaints if c['is_completed']]
    return render_template('place_complaints.html', place=place, pending_list=pending, finished_list=finished, total=len(complaints), completed=len(finished))

#--------------------------------------------------------------------------
from call import sync_completed_to_gsheet #call function
#--------------------------------------------------------------------------

@app.route('/user/complete_complaint/<int:cid>', methods=['POST'])
@login_required
def complete_complaint(cid):
    if session.get('role') == 'admin': return redirect(url_for('admin_dashboard'))
    conn = get_db()
    complaint = conn.execute("SELECT place_id FROM complaints WHERE id=?", (cid,)).fetchone()
    if complaint:
        conn.execute("UPDATE complaints SET is_completed=1, completed_at=? WHERE id=?", (datetime.now().strftime('%Y-%m-%d %H:%M:%S'), cid))
        conn.commit()
#--------------------------------------------------------------------    
        sync_completed_to_gsheet() #function call-----------------------------------
#---------------------------------------------------------------------
    conn.close()
    return redirect(url_for('view_place', place_id=complaint['place_id'] if complaint else 0))

# ─── TASK NOTIFICATION API ROUTES ────────────────────────────────────────────

@app.route('/api/notifications', methods=['GET'])
@login_required
def get_notifications():
    """Get all notifications for the current user (JSON API)"""
    user_id = session['user_id']
    conn = get_db()
    try:
        notifications = conn.execute("""
            SELECT tn.id, tn.complaint_id, tn.message, tn.created_at, tn.is_read,
                   c.note as complaint_note, p.name as place_name
            FROM task_notifications tn
            LEFT JOIN complaints c ON tn.complaint_id = c.id
            LEFT JOIN places p ON c.place_id = p.id
            WHERE tn.user_id=?
            ORDER BY tn.created_at DESC
        """, (user_id,)).fetchall()
        
        unread_count = conn.execute("""
            SELECT COUNT(*) as cnt FROM task_notifications 
            WHERE user_id=? AND is_read=0
        """, (user_id,)).fetchone()['cnt']
        
        notif_list = [{
            'id': n['id'],
            'complaint_id': n['complaint_id'],
            'message': n['message'],
            'complaint_note': n['complaint_note'],
            'place_name': n['place_name'],
            'created_at': n['created_at'],
            'is_read': n['is_read']
        } for n in notifications]
        
        return jsonify({
            'success': True,
            'notifications': notif_list,
            'unread_count': unread_count
        })
    finally:
        conn.close()

@app.route('/api/notifications/mark-read/<int:notif_id>', methods=['POST'])
@login_required
def mark_notification_read(notif_id):
    """Mark a notification as read"""
    user_id = session['user_id']
    conn = get_db()
    try:
        # Verify ownership
        row = conn.execute("""
            SELECT id FROM task_notifications 
            WHERE id=? AND user_id=?
        """, (notif_id, user_id)).fetchone()
        
        if not row:
            return jsonify({'success': False, 'message': 'Notification not found'}), 404
        
        conn.execute("UPDATE task_notifications SET is_read=1 WHERE id=?", (notif_id,))
        conn.commit()
        return jsonify({'success': True})
    finally:
        conn.close()

@app.route('/api/notifications/mark-all-read', methods=['POST'])
@login_required
def mark_all_read():
    """Mark all notifications as read for current user"""
    user_id = session['user_id']
    conn = get_db()
    try:
        conn.execute("UPDATE task_notifications SET is_read=1 WHERE user_id=?", (user_id,))
        conn.commit()
        return jsonify({'success': True})
    finally:
        conn.close()

@app.route('/api/assigned-tasks', methods=['GET'])
@login_required
def get_assigned_tasks():
    """Get all assigned tasks for current user (JSON API)"""
    user_id = session['user_id']
    conn = get_db()
    try:
        tasks = conn.execute("""
            SELECT c.id, c.note, c.created_at, c.is_completed, p.name as place_name
            FROM complaints c
            JOIN places p ON c.place_id = p.id
            WHERE c.assigned_to_user_id=?
            ORDER BY c.created_at DESC
        """, (user_id,)).fetchall()
        
        task_list = [{
            'id': t['id'],
            'note': t['note'],
            'place_name': t['place_name'],
            'created_at': t['created_at'],
            'is_completed': t['is_completed']
        } for t in tasks]
        
        return jsonify({
            'success': True,
            'tasks': task_list
        })
    finally:
        conn.close()

# ─── ADMIN TASK ASSIGNMENT ROUTES ─────────────────────────────────────────

@app.route('/admin/assign-task/<int:complaint_id>', methods=['POST'])
@admin_required
def assign_task(complaint_id):
    """Admin assigns a task/complaint to a user"""
    user_id = request.form.get('user_id', '').strip()
    
    if not user_id or not user_id.isdigit():
        return jsonify({'success': False, 'message': 'Invalid user ID'}), 400
    
    user_id = int(user_id)
    
    conn = get_db()
    try:
        # Verify complaint exists
        complaint = conn.execute("SELECT id, note, place_id FROM complaints WHERE id=?", 
                                (complaint_id,)).fetchone()
        if not complaint:
            return jsonify({'success': False, 'message': 'Complaint not found'}), 404
        
        # Verify user exists and is not admin
        user = conn.execute("SELECT id, username FROM users WHERE id=? AND role='user'", 
                           (user_id,)).fetchone()
        if not user:
            return jsonify({'success': False, 'message': 'User not found'}), 404
        
        # Get place name
        place = conn.execute("SELECT name FROM places WHERE id=?", 
                            (complaint['place_id'],)).fetchone()
        place_name = place['name'] if place else 'Unknown'
        
        # Assign task
        conn.execute("UPDATE complaints SET assigned_to_user_id=? WHERE id=?", 
                    (user_id, complaint_id))
        
        # Create notification
        message = f"New task assigned: {complaint['note'][:100]}"
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        conn.execute("""
            INSERT INTO task_notifications (user_id, complaint_id, message, created_at)
            VALUES (?, ?, ?, ?)
        """, (user_id, complaint_id, message, now))
        
        conn.commit()
        return jsonify({'success': True, 'message': f'Task assigned to {user["username"]}'})
    except sqlite3.Error as e:
        return jsonify({'success': False, 'message': 'Database error'}), 500
    finally:
        conn.close()

@app.route('/admin/unassign-task/<int:complaint_id>', methods=['POST'])
@admin_required
def unassign_task(complaint_id):
    """Admin unassigns a task from a user"""
    conn = get_db()
    try:
        # Verify complaint exists
        complaint = conn.execute("SELECT id FROM complaints WHERE id=?", 
                                (complaint_id,)).fetchone()
        if not complaint:
            return jsonify({'success': False, 'message': 'Complaint not found'}), 404
        
        # Unassign task
        conn.execute("UPDATE complaints SET assigned_to_user_id=NULL WHERE id=?", 
                    (complaint_id,))
        
        conn.commit()
        return jsonify({'success': True, 'message': 'Task unassigned'})
    except sqlite3.Error:
        return jsonify({'success': False, 'message': 'Database error'}), 500
    finally:
        conn.close()

@app.route('/api/users-for-assignment', methods=['GET'])
@admin_required
def get_users_for_assignment():
    """Get list of users for task assignment (JSON API)"""
    conn = get_db()
    try:
        users = conn.execute("""
            SELECT id, username FROM users 
            WHERE role='user' AND is_approved=1
            ORDER BY username
        """).fetchall()
        
        user_list = [{'id': u['id'], 'username': u['username']} for u in users]
        return jsonify({'success': True, 'users': user_list})
    finally:
        conn.close()

# ─── DB ADMIN ROUTES ─────────────────────────────────────────────────────────

@app.route('/db-admin')
@admin_required
def db_admin():
    conn = get_db()
    users = conn.execute('''
        SELECT *
        FROM users
        ORDER BY
            CASE
                WHEN role = 'user' AND is_approved = 0 THEN 0
                ELSE 1
            END,
            CASE
                WHEN role = 'user' AND is_approved = 0 THEN id
            END DESC,
            id DESC
    ''').fetchall()
    places = conn.execute('''
        SELECT p.*, COUNT(c.id) AS complaint_count
        FROM places p
        LEFT JOIN complaints c ON c.place_id = p.id
        GROUP BY p.id
        ORDER BY p.id
    ''').fetchall()
    complaints = conn.execute("SELECT c.*, p.name as place_name FROM complaints c JOIN places p ON c.place_id = p.id ORDER BY c.created_at DESC").fetchall()
    conn.close()
    return render_template('db_admin.html', users=users, places=places, complaints=complaints)

@app.route('/db-admin/delete/complaint/<int:cid>', methods=['POST'])
@admin_required
def db_admin_delete_complaint(cid):
    """Safely delete a complaint from DB admin"""
    if not isinstance(cid, int) or cid < 1:
        flash('Invalid complaint ID.', 'error')
        return redirect(url_for('db_admin'))
    
    conn = get_db()
    try:
        # Verify complaint exists
        complaint = conn.execute("SELECT id FROM complaints WHERE id=?", (cid,)).fetchone()
        if not complaint:
            flash('Complaint not found.', 'error')
            return redirect(url_for('db_admin'))
        
        conn.execute("DELETE FROM complaints WHERE id=?", (cid,))
        conn.commit()
        flash('Complaint deleted.', 'success')
    except sqlite3.Error:
        flash('Failed to delete complaint.', 'error')
    finally:
        conn.close()
    return redirect(url_for('db_admin'))

@app.route('/db-admin/delete/place/<int:pid>', methods=['POST'])
@admin_required
def db_admin_delete_place(pid):
    """Safely delete a place from DB admin"""
    if not isinstance(pid, int) or pid < 1:
        flash('Invalid place ID.', 'error')
        return redirect(url_for('db_admin'))
    
    conn = get_db()
    try:
        # Verify place exists
        place = conn.execute("SELECT id FROM places WHERE id=?", (pid,)).fetchone()
        if not place:
            flash('Place not found.', 'error')
            return redirect(url_for('db_admin'))
        
        conn.execute("DELETE FROM complaints WHERE place_id=?", (pid,))
        conn.execute("DELETE FROM places WHERE id=?", (pid,))
        conn.commit()
        flash('Place and related complaints deleted.', 'success')
    except sqlite3.Error:
        flash('Failed to delete place.', 'error')
    finally:
        conn.close()
    return redirect(url_for('db_admin'))

@app.route('/db-admin/delete/user/<int:uid>', methods=['POST'])
@admin_required
def db_admin_delete_user(uid):
    """Safely delete a user from DB admin"""
    if not isinstance(uid, int) or uid < 1:
        flash('Invalid user ID.', 'error')
        return redirect(url_for('db_admin'))
    
    conn = get_db()
    try:
        user = conn.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()

        if not user:
            flash('User not found.', 'error')
        elif user['role'] == 'admin':
            flash('Admin users are protected and cannot be deleted here.', 'error')
        else:
            conn.execute("DELETE FROM users WHERE id=?", (uid,))
            conn.commit()
            flash('User deleted.', 'success')
    except sqlite3.Error:
        flash('Failed to delete user.', 'error')
    finally:
        conn.close()
    return redirect(url_for('db_admin'))

@app.route('/db-admin/approve/user/<int:uid>', methods=['POST'])
@admin_required
def db_admin_approve_user(uid):
    """Approve a user from DB admin"""
    if not isinstance(uid, int) or uid < 1:
        flash('Invalid user ID.', 'error')
        return redirect(url_for('db_admin'))
    
    conn = get_db()
    try:
        # Verify user exists
        user = conn.execute("SELECT id FROM users WHERE id=?", (uid,)).fetchone()
        if not user:
            flash('User not found.', 'error')
            return redirect(url_for('db_admin'))
        
        conn.execute("UPDATE users SET is_approved=1 WHERE id=?", (uid,))
        conn.commit()
        flash('User approved.', 'success')
    except sqlite3.Error:
        flash('Failed to approve user.', 'error')
    finally:
        conn.close()
    return redirect(url_for('db_admin'))

@app.route('/db-admin/bulk-delete/<string:table>', methods=['POST'])
@admin_required
def db_admin_bulk_delete(table):
    """Bulk delete records with proper validation"""
    # Validate table name to prevent injection
    valid_tables = {'complaints', 'places', 'users'}
    if table not in valid_tables:
        flash('Invalid bulk delete target.', 'error')
        return redirect(url_for('db_admin'))
    
    raw_ids = request.form.get('ids', '')
    ids = [int(part) for part in raw_ids.split(',') if part.strip().isdigit() and int(part) > 0]

    if not ids:
        flash('No valid records selected for deletion.', 'error')
        return redirect(url_for('db_admin'))

    placeholders = ','.join('?' for _ in ids)
    conn = get_db()

    try:
        if table == 'complaints':
            conn.execute(f"DELETE FROM complaints WHERE id IN ({placeholders})", ids)
            flash(f'Deleted {len(ids)} complaint(s).', 'success')
        elif table == 'places':
            conn.execute(f"DELETE FROM complaints WHERE place_id IN ({placeholders})", ids)
            conn.execute(f"DELETE FROM places WHERE id IN ({placeholders})", ids)
            flash(f'Deleted {len(ids)} place(s) and related complaints.', 'success')
        elif table == 'users':
            protected_ids = {
                row['id']
                for row in conn.execute(
                    f"SELECT id FROM users WHERE id IN ({placeholders}) AND role='admin'",
                    ids
                ).fetchall()
            }
            deletable_ids = [uid for uid in ids if uid not in protected_ids]

            if deletable_ids:
                user_placeholders = ','.join('?' for _ in deletable_ids)
                conn.execute(f"DELETE FROM users WHERE id IN ({user_placeholders})", deletable_ids)

            if protected_ids:
                flash('Admin users were skipped during bulk delete.', 'info')

            flash(f'Deleted {len(deletable_ids)} user(s).', 'success')
        
        conn.commit()
    except sqlite3.Error:
        conn.rollback()
        flash('Error during bulk delete. Please try again.', 'error')
    finally:
        conn.close()
    
    return redirect(url_for('db_admin'))

if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5050)
