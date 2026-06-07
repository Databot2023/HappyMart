import sqlite3
import gspread
from oauth2client.service_account import ServiceAccountCredentials
from datetime import datetime

# ─────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────
DATABASE_PATH = 'complaints.db'
SPREADSHEET_ID = '12IxwbfYs0Bv5dlfMngG0KKJCw9P7P7qhDLA-LIJQS5c'
WORKSHEET_NAME = 'Sheet1'
CREDENTIALS_FILE = 'camedatabase.json'

# ─────────────────────────────────────────────────────────
# FETCH FROM DATABASE (WITH JOIN)
# ─────────────────────────────────────────────────────────
def fetch_completed_complaints():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT 
            c.id,
            c.created_at,
            p.name AS place,
            c.note,
            c.completed_at
        FROM complaints c
        JOIN places p ON c.place_id = p.id
        WHERE c.is_completed = 1
        ORDER BY c.created_at ASC
    ''')
    
    rows = cursor.fetchall()
    conn.close()
    
    data = []
    for row in rows:
        data.append({
            'id': row['id'],
            'created_at': row['created_at'] or '',
            'place': row['place'] or '',
            'note': row['note'] or '',
            'completed_at': row['completed_at'] or ''
        })
    
    return data

# ─────────────────────────────────────────────────────────
# CONNECT TO GOOGLE SHEET
# ─────────────────────────────────────────────────────────
def connect_to_gsheet():
    scope = [
        'https://spreadsheets.google.com/feeds',
        'https://www.googleapis.com/auth/drive'
    ]
    
    creds = ServiceAccountCredentials.from_json_keyfile_name(CREDENTIALS_FILE, scope)
    client = gspread.authorize(creds)
    sheet = client.open_by_key(SPREADSHEET_ID).worksheet(WORKSHEET_NAME)
    return sheet

# ─────────────────────────────────────────────────────────
# GET EXISTING SHEET DATA (for duplicate check)
# ─────────────────────────────────────────────────────────
def get_existing_sheet_data():
    sheet = connect_to_gsheet()
    all_values = sheet.get_all_values()
    
    if len(all_values) <= 1:  # Only header or empty
        return []
    
    # Skip header row, return data rows
    existing = []
    for row in all_values[1:]:  # Skip header
        if len(row) >= 4:
            existing.append({
                'created_at': row[0].strip(),
                'place': row[1].strip(),
                'note': row[2].strip(),
                'completed_at': row[3].strip()
            })
    
    return existing

# ─────────────────────────────────────────────────────────
# CHECK IF COMPLAINT ALREADY EXISTS
# ─────────────────────────────────────────────────────────
def is_duplicate(complaint, existing_data):
    for existing in existing_data:
        if (existing['created_at'] == complaint['created_at'] and
            existing['place'] == complaint['place'] and
            existing['note'] == complaint['note'] and
            existing['completed_at'] == complaint['completed_at']):
            return True
    return False

# ─────────────────────────────────────────────────────────
# APPEND TO GOOGLE SHEET (with duplicate check)
# ─────────────────────────────────────────────────────────
def append_to_gsheet(data):
    if not data:
        print("⚠️ No completed complaints found.")
        return 0
    
    sheet = connect_to_gsheet()
    
    all_values = sheet.get_all_values()
    
    # Add header if sheet is empty
    if not all_values:
        header = ['CREATED DATE', 'PLACE', 'NOTE', 'COMPLAINT DATE']
        sheet.append_row(header)
        print("✅ Header row added: CREATED DATE | PLACE | NOTE | COMPLAINT DATE")
    
    # Get existing data for duplicate check
    existing_data = get_existing_sheet_data()
    
    new_count = 0
    skip_count = 0
    
    for complaint in data:
        if is_duplicate(complaint, existing_data):
            skip_count += 1
            print(f"⏭️ Skipped duplicate: {complaint['place']} — {complaint['note'][:30]}...")
        else:
            sheet.append_row([
                complaint['created_at'],
                complaint['place'],
                complaint['note'],
                complaint['completed_at']
            ])
            new_count += 1
    
    print(f"✅ {new_count} new row(s) added.")
    if skip_count > 0:
        print(f"⏭️ {skip_count} duplicate(s) skipped.")
    
    return new_count

# ─────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────
def sync_completed_to_gsheet():
    print(f"\n[{datetime.now()}] Starting sync...")
    
    data = fetch_completed_complaints()
    print(f"📦 Fetched {len(data)} completed complaint(s) from database.")
    
    count = append_to_gsheet(data)
    
    print(f"[{datetime.now()}] Sync complete! {count} new row(s) added.\n")
    return count

# ─────────────────────────────────────────────────────────
# RUN
# ─────────────────────────────────────────────────────────
if __name__ == '__main__':
    sync_completed_to_gsheet()