import re
from datetime import datetime
from .jd_parser import find_skills

# ---------- Regexes ----------
EMAIL_RE = re.compile(r'[\w\.-]+@[\w\.-]+\.\w+', re.I)
PHONE_RE = re.compile(r'(\+?\d[\d\s\-\(\)]{8,}\d)')
URL_RE = re.compile(r'(https?://|www\.)\S+', re.I)
LINKEDIN_RE = re.compile(r'linkedin\.com/\S+', re.I)
GITHUB_RE = re.compile(r'github\.com/\S+', re.I)

# Detect if a line looks like junk (email/phone/URL) — used to skip during name detection
JUNK_LINE_RE = re.compile(r'(@|https?://|www\.|linkedin|github|\+?\d{8,})', re.I)

# Words that often appear in resume headers but aren't names
NAME_BLACKLIST = {
    'resume', 'curriculum', 'vitae', 'cv', 'profile', 'objective', 'summary',
    'contact', 'address', 'email', 'phone', 'mobile', 'e-mail', 'career',
    'about', 'personal', 'details', 'declaration', 'references'
}

# ---------- Locations (India focused + remote) ----------
COMMON_LOCATIONS = [
    'hyderabad','secunderabad','bangalore','bengaluru','mumbai','navi mumbai','thane',
    'pune','pimpri','chinchwad','chennai','coimbatore','madurai','delhi','new delhi',
    'noida','greater noida','gurgaon','gurugram','ghaziabad','faridabad','kolkata',
    'howrah','ahmedabad','gandhinagar','surat','vadodara','rajkot','jaipur','jodhpur',
    'udaipur','lucknow','kanpur','varanasi','noida','agra','meerut','kochi','cochin',
    'trivandrum','thiruvananthapuram','kozhikode','calicut','thrissur','mysore','mysuru',
    'mangalore','mangaluru','hubli','belgaum','belagavi','vijayawada','visakhapatnam',
    'vizag','guntur','tirupati','warangal','nagpur','nashik','aurangabad','indore',
    'bhopal','jabalpur','gwalior','raipur','bhubaneswar','cuttack','patna','ranchi',
    'guwahati','shillong','imphal','chandigarh','mohali','panchkula','amritsar',
    'ludhiana','jalandhar','dehradun','haridwar','roorkee','srinagar','jammu',
    'goa','panaji','margao','pondicherry','puducherry','remote','work from home','wfh'
]

# ---------- Education keywords (comprehensive) ----------
EDU_PATTERNS = [
    r'\bB\.?Tech\b', r'\bB\.?E\.?\b', r'\bB\.?Sc\b', r'\bB\.?Com\b', r'\bB\.?C\.?A\b',
    r'\bB\.?B\.?A\b', r'\bB\.?B\.?M\b', r'\bB\.?A\.?\b', r'\bB\.?Ed\b', r'\bB\.?Pharm\b',
    r'\bM\.?Tech\b', r'\bM\.?E\.?\b', r'\bM\.?Sc\b', r'\bM\.?Com\b', r'\bM\.?C\.?A\b',
    r'\bM\.?B\.?A\b', r'\bM\.?A\.?\b', r'\bM\.?Ed\b', r'\bM\.?Pharm\b',
    r'\bPh\.?D\b', r'\bDoctorate\b', r'\bPost\s*Graduation\b', r'\bPost\s*Graduate\b',
    r'\bGraduation\b', r'\bGraduate\b', r'\bUndergraduate\b',
    r'\bBachelor(?:\'s)?\b', r'\bMaster(?:\'s)?\b', r'\bDiploma\b', r'\bPGDM\b',
    r'\bBE\b', r'\bBTech\b', r'\bMTech\b', r'\bMCA\b', r'\bMBA\b', r'\bBCA\b', r'\bBBA\b',
    r'\b12th\b', r'\b10th\b', r'\bHSC\b', r'\bSSC\b', r'\bIntermediate\b', r'\bHigh\s*School\b',
    r'\bComputer\s+Science\b', r'\bInformation\s+Technology\b', r'\bElectronics\b',
    r'\bMechanical\b', r'\bCivil\b', r'\bElectrical\b', r'\bCommerce\b', r'\bScience\b',
]
EDU_RE = re.compile('|'.join(EDU_PATTERNS), re.I)

# ---------- Designation keywords ----------
DESIGNATION_KEYWORDS = [
    'developer','engineer','architect','programmer','analyst','scientist','consultant',
    'manager','lead','head','director','vp','president','officer','executive',
    'specialist','associate','assistant','coordinator','administrator','tester',
    'designer','intern','trainee','fresher','accountant','auditor','recruiter',
    'sales','marketing','teacher','professor','nurse','doctor','technician',
    'supervisor','operator','clerk','cashier','receptionist','secretary',
    'writer','editor','producer','photographer','chef','waiter','driver'
]
DESIGNATION_RE = re.compile(r'\b(' + '|'.join(DESIGNATION_KEYWORDS) + r')\b', re.I)

# ---------- Experience patterns ----------
YEAR_RANGE_RE = re.compile(
    r'(19\d{2}|20\d{2})\s*(?:-|–|—|to|till|until)\s*(19\d{2}|20\d{2}|present|current|now|till\s*date)',
    re.I
)

EXP_PATTERNS = [
    re.compile(r'(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)\s*(?:of\s*)?(?:experience|exp)?', re.I),
    re.compile(r'experience\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?)', re.I),
    re.compile(r'(\d+)\s*years?\s*(?:and)?\s*(\d+)\s*months?', re.I),
    re.compile(r'(\d+)\s*months?\s*(?:of\s*)?experience', re.I),
]

# ---------- Notice period ----------
NOTICE_RE = re.compile(
    r'((?:immediate|serving\s*notice|notice\s*period)[^\n,;]{0,60}|\d+\s*(?:days?|weeks?|months?)\s*notice)',
    re.I
)

# ---------- Salary ----------
SALARY_RE = re.compile(
    r'(?:₹|rs\.?|inr|usd|\$)\s?[\d,.]+\s*(?:k|lpa|lakhs?|lacs?|per\s*annum|pa|per\s*month|pm|/month)?',
    re.I
)


# ================== Helper functions ==================

def _clean(s):
    return re.sub(r'\s+', ' ', (s or '')).strip()


def _is_junk_line(line):
    """A line is 'junk' for name detection if it contains contact info or is a header."""
    if not line or len(line) < 3 or len(line) > 60:
        return True
    if JUNK_LINE_RE.search(line):
        return True
    words = line.lower().split()
    if any(w in NAME_BLACKLIST for w in words):
        return True
    # Too many digits → likely not a name
    if sum(c.isdigit() for c in line) > 2:
        return True
    return False


def _looks_like_name(line):
    """
    Check if a line looks like a person's name.
    Accepts: "Rahul Sharma", "RAHUL SHARMA", "Rahul K. Sharma", "Priya"
    Rejects: "Software Developer", "Email: x@y.com"
    """
    if _is_junk_line(line):
        return False

    # Remove extra spaces, split words
    words = line.strip().split()
    if len(words) < 1 or len(words) > 5:
        return False

    # Each word should look like a name (letters, optional dot for initials)
    for w in words:
        w_clean = w.replace('.', '').replace(',', '').replace('-', '')
        if not w_clean:
            continue
        if not re.match(r'^[A-Za-z]+$', w_clean):
            return False
        if len(w_clean) > 20:
            return False

    # First word must start with uppercase (allow ALL CAPS)
    if not (words[0][0].isupper() or words[0].isupper()):
        return False

    # Avoid designations/education keywords
    line_low = line.lower()
    if DESIGNATION_RE.search(line_low) and len(words) <= 3:
        return False
    if EDU_RE.search(line):
        return False

    return True


def _extract_name(lines, text):
    """
    Try to find candidate name using multiple strategies.
    """
    # Strategy 1: Look in the first 10 non-junk lines for a name
    candidates = []
    for line in lines[:12]:
        if _looks_like_name(line):
            candidates.append(line)

    if candidates:
        # Prefer the first one, but skip generic headers
        for c in candidates:
            if c.lower() not in NAME_BLACKLIST:
                return _clean(c)

    # Strategy 2: Look for a line right before email/phone
    email_match = EMAIL_RE.search(text)
    if email_match:
        email_pos = email_match.start()
        before = text[:email_pos].strip().split('\n')
        # Check last 3 lines before email
        for line in reversed(before[-3:]):
            line = line.strip()
            if _looks_like_name(line):
                return _clean(line)

    # Strategy 3: Check file-like patterns — all caps line at the top
    for line in lines[:6]:
        if line.isupper() and 3 < len(line) < 40 and len(line.split()) <= 4:
            if not _is_junk_line(line):
                return _clean(line.title())

    # Fallback: first non-junk line
    for line in lines[:6]:
        if not _is_junk_line(line) and len(line) < 60:
            return _clean(line)

    return ''


def _extract_location(text):
    """Find location from known city list."""
    low = ' ' + text.lower() + ' '
    for loc in COMMON_LOCATIONS:
        # Word boundary check
        if re.search(r'(?<![a-z])' + re.escape(loc) + r'(?![a-z])', low):
            return loc.title()
    return ''


def _extract_education(text):
    """Find the most relevant education line."""
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    # Preferred: a line that mentions a degree AND contains the word 'university/college/institute'
    for line in lines:
        if EDU_RE.search(line) and re.search(r'(university|college|institute|school|iit|nit|iiit)', line, re.I):
            return _clean(line)[:200]
    # Next: any line that mentions a degree
    for line in lines:
        if EDU_RE.search(line):
            return _clean(line)[:200]
    return ''


def _extract_designation(lines, text):
    """Find candidate's current designation."""
    # Priority 1: labelled
    for line in lines:
        m = re.search(r'(?:designation|current\s*role|position|job\s*title)\s*[:\-]\s*(.+)', line, re.I)
        if m:
            return _clean(m.group(1))[:120]

    # Priority 2: line containing a designation keyword + 'at' or 'in' or '-'
    for line in lines[:30]:
        if DESIGNATION_RE.search(line) and re.search(r'\b(at|@|in|-)\b', line, re.I):
            if len(line) < 120 and not _is_junk_line(line):
                return _clean(line)[:120]

    # Priority 3: any line with designation keyword
    for line in lines[:30]:
        if DESIGNATION_RE.search(line) and len(line) < 100:
            return _clean(line)[:120]

    return ''


def _extract_total_experience(text):
    """Extract experience from year ranges + explicit mentions."""
    now_year = datetime.utcnow().year
    seen_ranges = []
    total_years = 0.0

    for m in YEAR_RANGE_RE.finditer(text):
        start = int(m.group(1))
        end_raw = m.group(2).strip().lower()
        end = now_year if end_raw in ('present', 'current', 'now') or 'till' in end_raw else int(end_raw)
        if start < 1970 or end > now_year + 1 or end < start:
            continue
        overlap = False
        for s, e in seen_ranges:
            if not (end < s or start > e):
                overlap = True
                break
        if overlap:
            continue
        seen_ranges.append((start, end))
        total_years += (end - start)

    from_text = 0.0
    for pat in EXP_PATTERNS:
        for m in pat.finditer(text):
            try:
                groups = m.groups()
                if len(groups) == 2 and groups[0] and groups[1]:
                    val = float(groups[0]) + float(groups[1]) / 12.0
                else:
                    val = float(groups[0])
                    if 'month' in m.group(0).lower():
                        val = val / 12.0
                if val > from_text:
                    from_text = val
            except (ValueError, TypeError):
                continue

    best = max(total_years, from_text)
    return round(min(best, 50.0), 1)


def _extract_notice(text):
    m = NOTICE_RE.search(text)
    return _clean(m.group(0)) if m else ''


def _extract_salary(text):
    m = SALARY_RE.search(text)
    return _clean(m.group(0)) if m else ''


# ================== Main parse function ==================

def parse_resume(text):
    text = text or ''
    lines = [l.strip() for l in text.split('\n') if l.strip()]

    name = _extract_name(lines, text)
    emails = EMAIL_RE.findall(text)
    phones = PHONE_RE.findall(text)
    phone = _clean(phones[0]) if phones else ''
    location = _extract_location(text)
    education = _extract_education(text)
    designation = _extract_designation(lines, text)
    experience = _extract_total_experience(text)
    notice = _extract_notice(text)
    salary = _extract_salary(text)
    skills = find_skills(text)

    # Company name: look for "at X" or "Company: X"
    company = ''
    for line in lines[:40]:
        m = re.search(r'(?:company|employer|organization|firm)\s*[:\-]\s*(.+)', line, re.I)
        if m:
            company = _clean(m.group(1))[:150]
            break
    if not company:
        for line in lines:
            m = re.search(r'\bat\s+([A-Z][A-Za-z0-9&.,\-\s]{2,40})', line)
            if m and not _is_junk_line(m.group(1)):
                company = _clean(m.group(1))
                break

    return {
        'name': name,
        'email': emails[0] if emails else '',
        'phone': phone,
        'location': location,
        'total_experience': experience,
        'relevant_experience': experience,
        'current_company': company,
        'current_designation': designation,
        'education': education,
        'notice_period': notice,
        'expected_salary': salary,
        'current_salary': '',
        'work_mode_compat': 'Flexible',
        'skills': skills,
        'experiences': [],
    }
