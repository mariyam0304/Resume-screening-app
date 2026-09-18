import re
import json
import os

SKILLS_FILE = os.path.join(os.path.dirname(__file__), '..', 'data', 'skills_taxonomy.json')
with open(SKILLS_FILE, 'r', encoding='utf-8-sig') as f:
    TAXONOMY = json.load(f)

ALL_SKILLS = sorted(set(TAXONOMY['it'] + TAXONOMY['non_it']), key=len, reverse=True)

MANDATORY_HINTS = ['must have', 'must-haves', 'required', 'mandatory', 'essential', 'minimum']
PREFERRED_HINTS = ['preferred', 'good to have', 'nice to have', 'plus', 'bonus', 'added advantage']
RESP_HINTS = ['responsibilities', 'you will', 'role includes', 'duties', 'what you will do']
EDU_HINTS = ['bachelor', 'master', 'b.tech', 'b.e', 'bsc', 'b.com', 'mba', 'mca', 'degree', 'graduation', 'phd']
CERT_HINTS = ['certified', 'certification', 'aws certified', 'pmp', 'scrum master', 'ccna']


def _clean(text):
    return re.sub(r'\s+', ' ', text or '').strip()


def extract_years(text):
    m = re.findall(r'(\d+(?:\.\d+)?)\s*\+?\s*(?:to\s*\d+\s*)?(?:years?|yrs?)', text.lower())
    vals = [float(x) for x in m]
    if not vals:
        return 0.0, 0.0
    return min(vals), max(vals)


def find_skills(text):
    low = ' ' + text.lower() + ' '
    found = []
    for skill in ALL_SKILLS:
        pattern = r'(?<![a-z0-9])' + re.escape(skill) + r'(?![a-z0-9])'
        if re.search(pattern, low):
            found.append(skill)
    return sorted(set(found))


def parse_jd(text):
    low = text.lower()
    lines = [l.strip() for l in text.split('\n') if l.strip()]

    title = lines[0] if lines else 'Untitled Role'
    if len(title) > 120:
        title = title[:120]

    domain = 'IT' if any(s in low for s in ['developer', 'engineer', 'software', 'java', 'python', 'react']) else 'Non-IT'

    min_exp, max_exp = extract_years(text)

    required, preferred = [], []
    for line in lines:
        l = line.lower()
        line_skills = find_skills(line)
        for s in line_skills:
            if any(h in l for h in PREFERRED_HINTS):
                preferred.append(s)
            else:
                required.append(s)

    required = sorted(set(required))
    preferred = sorted(set(preferred) - set(required))

    edu = ''
    for line in lines:
        if any(h in line.lower() for h in EDU_HINTS):
            edu = line
            break

    certs = [line for line in lines if any(h in line.lower() for h in CERT_HINTS)]

    loc = ''
    loc_match = re.search(r'(?:location|based in|based at|job location)[:\-]?\s*([A-Za-z ,]+)', text, re.I)
    if loc_match:
        loc = _clean(loc_match.group(1))
    elif ',' in title:
        loc = title.split(',')[-1].strip()

    work_mode = 'On-site'
    if 'remote' in low:
        work_mode = 'Remote'
    elif 'hybrid' in low:
        work_mode = 'Hybrid'

    sal_match = re.search(r'(?:₹|rs\.?|inr|\$|salary|ctc)[^\n]{0,60}', text, re.I)
    salary = _clean(sal_match.group(0)) if sal_match else ''

    np_match = re.search(r'(immediate|notice period[^\n]{0,60}|\d+\s*days?\s*notice)', text, re.I)
    notice = _clean(np_match.group(0)) if np_match else ''

    emp = 'Full-time'
    if 'contract' in low:
        emp = 'Contract'
    elif 'intern' in low:
        emp = 'Internship'
    elif 'part-time' in low:
        emp = 'Part-time'

    responsibilities = []
    capture = False
    for line in lines:
        l = line.lower()
        if any(h in l for h in RESP_HINTS):
            capture = True
            continue
        if capture:
            if line.endswith(':') and len(line) < 40:
                capture = False
                continue
            if len(line) > 15:
                responsibilities.append(line.strip('-•* '))
        if len(responsibilities) >= 12:
            break

    keywords = sorted(set(required + preferred))

    return {
        'title': title,
        'domain': domain,
        'min_experience': min_exp,
        'max_experience': max_exp,
        'required_skills': required,
        'preferred_skills': preferred,
        'education': edu,
        'certifications': certs,
        'location': loc,
        'work_mode': work_mode,
        'salary': salary,
        'notice_period': notice,
        'employment_type': emp,
        'responsibilities': responsibilities,
        'keywords': keywords,
        'mandatory': required,
        'preferred': preferred,
    }
