import json
from config import Config
from .skill_matcher import classify_skills, extra_skills


def _pct(n, d):
    return 0.0 if d <= 0 else round(100.0 * n / d, 2)


def score_candidate(jd_data, candidate_data, resume_text, weights=None):
    weights = weights or Config.DEFAULT_WEIGHTS
    required = jd_data.get('required_skills') or []
    preferred = jd_data.get('preferred_skills') or []

    skill_cls = classify_skills(required, resume_text)
    pref_cls = classify_skills(preferred, resume_text)

    if required:
        exact = len(skill_cls['exact'])
        related = len(skill_cls['related']) * 0.5
        skills_score = _pct(exact + related, len(required))
    else:
        skills_score = 100.0

    if preferred:
        pref_exact = len(pref_cls['exact'])
        pref_related = len(pref_cls['related']) * 0.5
        preferred_score = _pct(pref_exact + pref_related, len(preferred))
    else:
        preferred_score = 100.0

    exp = candidate_data.get('total_experience') or 0
    min_exp = jd_data.get('min_experience') or 0
    max_exp = jd_data.get('max_experience') or 0
    if min_exp <= 0:
        experience_score = 100.0
    elif exp < min_exp:
        experience_score = _pct(exp, min_exp)
    elif max_exp and exp > max_exp * 1.5:
        experience_score = 80.0
    else:
        experience_score = 100.0

    edu_jd = (jd_data.get('education') or '').lower()
    edu_res = (candidate_data.get('education') or '').lower()
    if not edu_jd:
        education_score = 100.0
    else:
        education_score = 100.0 if any(tok in edu_res for tok in edu_jd.split()[:4] if len(tok) > 2) else 60.0

    jd_loc = (jd_data.get('location') or '').lower()
    res_loc = (candidate_data.get('location') or '').lower()
    work_mode = (jd_data.get('work_mode') or '').lower()
    if not jd_loc or work_mode == 'remote':
        location_score = 100.0
    elif jd_loc and res_loc and (jd_loc in res_loc or res_loc in jd_loc):
        location_score = 100.0
    elif res_loc:
        location_score = 60.0
    else:
        location_score = 50.0

    np_jd = (jd_data.get('notice_period') or '').lower()
    np_res = (candidate_data.get('notice_period') or '').lower()
    if not np_jd:
        notice_score = 100.0
    elif 'immediate' in np_jd:
        notice_score = 100.0 if 'immediate' in np_res else 70.0
    elif np_res:
        notice_score = 85.0
    else:
        notice_score = 70.0

    domain_score = 100.0

    resp_jd = jd_data.get('responsibilities') or []
    if resp_jd:
        rt = resume_text.lower()
        hits = sum(1 for r in resp_jd if any(w in rt for w in r.lower().split() if len(w) > 4))
        responsibility_score = _pct(hits, len(resp_jd))
    else:
        responsibility_score = 100.0

    overall = round(
        weights['skills'] * skills_score +
        weights['experience'] * experience_score +
        weights['responsibilities'] * responsibility_score +
        weights['domain'] * domain_score +
        weights['preferred_skills'] * preferred_score +
        weights['education'] * education_score +
        weights['location'] * location_score +
        weights['notice'] * notice_score, 2
    )

    mandatory_missing = skill_cls['missing']
    if overall >= 80 and not mandatory_missing:
        status = 'Strong Match'
    elif overall >= 65 and len(mandatory_missing) <= 1:
        status = 'Potential Match'
    elif overall >= 45:
        status = 'Needs Review'
    else:
        status = 'Low Match'

    strengths = []
    if skill_cls['exact']:
        strengths.append(f"Matched required skills: {', '.join(skill_cls['exact'])}")
    if exp >= min_exp and min_exp:
        strengths.append(f"{exp} years experience (required {min_exp}+)")
    if education_score == 100:
        strengths.append("Education requirement satisfied")
    if location_score == 100:
        strengths.append("Location compatible")

    gaps = []
    if mandatory_missing:
        gaps.append(f"Missing mandatory skills: {', '.join(mandatory_missing)}")
    if exp < min_exp and min_exp:
        gaps.append(f"Experience {exp}y below required {min_exp}y")
    if notice_score < 100:
        gaps.append(f"Notice period may not match: JD='{np_jd or 'N/A'}', Candidate='{np_res or 'N/A'}'")
    if pref_cls['missing']:
        gaps.append(f"Preferred skills not found: {', '.join(pref_cls['missing'])}")

    explanation = {
        'matched_skills': skill_cls['exact'],
        'related_skills': skill_cls['related'],
        'missing_skills': skill_cls['missing'],
        'extra_skills': extra_skills(resume_text, required + preferred),
        'matched_preferred': pref_cls['exact'],
        'missing_preferred': pref_cls['missing'],
        'strengths': strengths,
        'gaps': gaps,
        'experience': {'required_min': min_exp, 'required_max': max_exp, 'candidate': exp},
    }

    return {
        'overall_score': overall,
        'skills_score': skills_score,
        'experience_score': experience_score,
        'education_score': education_score,
        'location_score': location_score,
        'notice_score': notice_score,
        'domain_score': domain_score,
        'responsibility_score': responsibility_score,
        'preferred_skills_score': preferred_score,
        'status': status,
        'explanation': json.dumps(explanation),
    }
