# SmartHire AI – Intelligent Resume Screening & Candidate Matching System

A modular web application for HR/recruiters to:
- Paste any Job Description (IT or Non-IT)
- Upload multiple resumes (PDF/DOCX/DOC/TXT)
- Automatically extract & match skills
- Score candidates with a transparent, explainable model
- Compare, filter, and manage candidates
- Generate screening questions and export results

---

## Tech Stack

- **Frontend**: HTML, CSS, Vanilla JS (SPA-style)
- **Backend**: Python Flask + Flask-Login + Flask-SQLAlchemy
- **Database**: MySQL (via PyMySQL)
- **NLP**: Rule-based keyword & synonym engine (modular — AI can be plugged in later)
- **Parsing**: PyPDF2, python-docx
- **Export**: openpyxl (Excel), reportlab (PDF)

---

## ⚙️ Installation (Windows)

### 1. Install Python & MySQL
- Python 3.10+: https://www.python.org/downloads/
- MySQL 8+: https://dev.mysql.com/downloads/installer/

### 2. Create the database
```sql
CREATE DATABASE smarthire_db CHARACTER SET utf8mb4;
```

### 3. Set up the backend
```powershell
cd smarthire-ai\backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
notepad .env   # update DATABASE_URL if needed
```

### 4. Initialize DB + default admin
```powershell
python init_db.py
```

### 5. Run the server
```powershell
python app.py
```
Open http://localhost:5000

**Default login**: `admin` / `admin123`

---

## Testing with Samples
1. Login.
2. **Create JD** → paste contents of `samples/sample_jd.txt` → click *Analyze & Save JD*.
3. **Upload Resumes** → upload `samples/sample_resume.txt`.
4. **Screening** → pick the JD → *Run Screening*.
5. Inspect **Explain** for any candidate. Try **Compare**, **Candidates**, **Screening Questions**, and **Export**.

---

## Scoring Model (Configurable)
```
Overall = 
  0.30 × Skills +
  0.20 × Experience +
  0.15 × Responsibilities +
  0.10 × Domain +
  0.10 × Preferred Skills +
  0.05 × Education +
  0.05 × Location +
  0.05 × Notice Period
```
Change these weights in `backend/config.py` (`DEFAULT_WEIGHTS`) or pass custom `weights` to `/api/screening/run`.

---

##  Security
- Werkzeug password hashing
- Session-based auth via Flask-Login
- File type & size validation (10MB)
- `secure_filename` sanitization
- All candidate routes require authentication

---

##  Extending with Real AI
`backend/ai/` contains:
- `base.AIEngine` — abstract interface
- `keyword_engine.KeywordEngine` — default baseline
- `semantic_engine.SemanticEngine` — placeholder for embedding models

Replace the scoring inside `services/scorer.py` with `SemanticEngine.similarity()` calls without touching routes or the frontend.

---

## Project Layout
See the top of this document for the complete folder structure.

---

## API Reference (short)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | /api/auth/register | Register user |
| POST | /api/auth/login | Login |
| POST | /api/jd/ | Create JD |
| GET | /api/jd/ | List JDs |
| POST | /api/resume/upload | Upload resumes |
| POST | /api/screening/run | Screen candidates |
| GET | /api/screening/results/<jd_id> | Get screening results |
| POST | /api/screening/filter/<jd_id> | Filter results |
| GET | /api/candidate/ | List candidates |
| GET | /api/candidate/<id> | Candidate profile |
| POST | /api/questions/generate | Generate questions |
| GET | /api/export/csv/<jd_id> | CSV export |
| GET | /api/export/excel/<jd_id> | Excel export |
| GET | /api/export/pdf/<jd_id> | PDF export |

---

##  Troubleshooting
- **MySQL connection error** → verify `DATABASE_URL` in `.env`.
- **PDF extraction empty** → some PDFs are scanned images; OCR not implemented yet.
- **CORS/login issue** → ensure you access via `http://localhost:5000` (Flask serves the frontend too).

Enjoy SmartHire AI! 