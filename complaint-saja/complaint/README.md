# ComplaintDesk — Setup Guide

## 1. Install Dependencies
```bash
pip install flask python-dotenv
```

## 2. Configuration
Create a `.env` file with your preferred credentials:
```env
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "test123"
SECRET_KEY = "your-secret-key"
```

## 3. Run
```bash
python app.py
```
Open: **http://localhost:5050**

## Default Credentials (if not using .env)
| Role  | Username | Password |
|-------|----------|----------|
| Admin | `admin`  | `admin123` |

## Features
- **Easy Login**: Simple username/password authentication.
- **Admin**: Full control over complaints and places.
- **Users**: View task counts and manage local work.
- **DB**: Local SQLite storage.



## Security Issues:
- Passwords stored in plain text
- Admin credentials hardcoded/defaulted
- No CSRF protection