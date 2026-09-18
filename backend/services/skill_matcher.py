from .jd_parser import find_skills

RELATED = {
    'spring boot': ['spring', 'spring framework', 'spring mvc'],
    'spring': ['spring boot', 'spring framework'],
    'react': ['reactjs', 'react.js'],
    'node.js': ['node', 'nodejs'],
    'rest api': ['rest', 'restful', 'web api'],
    'aws': ['amazon web services', 'ec2', 's3'],
    'sql': ['mysql', 'postgresql', 'oracle'],
    'machine learning': ['ml', 'deep learning'],
    'b2b': ['business to business'],
    'crm': ['salesforce', 'hubspot', 'zoho'],
}


def classify_skills(jd_skills, resume_text):
    resume_text_low = (resume_text or '').lower()
    exact, related, missing = [], [], []
    for skill in jd_skills:
        s_low = skill.lower()
        if s_low in resume_text_low:
            exact.append(skill)
            continue
        syns = RELATED.get(s_low, [])
        matched_syn = None
        for syn in syns:
            if syn in resume_text_low:
                matched_syn = syn
                break
        if not matched_syn:
            for k, v in RELATED.items():
                if s_low in v and k in resume_text_low:
                    matched_syn = k
                    break
        if matched_syn:
            related.append({'required': skill, 'matched_via': matched_syn})
        else:
            missing.append(skill)
    return {'exact': exact, 'related': related, 'missing': missing}


def extra_skills(resume_text, jd_skills):
    resume_skills = set(find_skills(resume_text))
    jd_set = set(s.lower() for s in jd_skills)
    return sorted(resume_skills - jd_set)
