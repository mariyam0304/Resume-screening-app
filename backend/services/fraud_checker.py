import re
from datetime import datetime


def check_inconsistencies(text):
    warnings = []

    years = re.findall(r'(20\d{2})\s*[-–to]+\s*(20\d{2}|present|current)', text, re.I)
    parsed = []
    for s, e in years:
        try:
            sy = int(s)
            ey = datetime.utcnow().year if e.lower() in ('present', 'current') else int(e)
            parsed.append((sy, ey))
        except Exception:
            continue

    parsed.sort()
    for i in range(1, len(parsed)):
        if parsed[i][0] < parsed[i-1][1]:
            warnings.append("Possible overlapping employment periods detected - recruiter review recommended.")
            break

    exp_matches = [float(x) for x in re.findall(r'(\d+(?:\.\d+)?)\s*(?:years?|yrs?)', text, re.I)]
    if exp_matches and max(exp_matches) > 40:
        warnings.append("Unusually high experience value - recruiter review recommended.")

    return warnings
