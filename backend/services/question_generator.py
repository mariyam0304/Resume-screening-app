def generate_questions(jd_data, candidate_data=None):
    questions = []

    min_exp = jd_data.get('min_experience') or 0
    if min_exp:
        questions.append({
            'question': f"How many years of relevant experience do you have (requirement: {min_exp}+ years)?",
            'category': 'Experience'
        })

    for skill in (jd_data.get('required_skills') or [])[:6]:
        questions.append({
            'question': f"Please describe your hands-on experience with {skill}.",
            'category': 'Technical Skill'
        })

    if jd_data.get('location'):
        questions.append({
            'question': f"Are you comfortable working from {jd_data['location']}?",
            'category': 'Location'
        })

    if jd_data.get('salary'):
        questions.append({'question': f"What is your expected CTC? (JD range: {jd_data['salary']})", 'category': 'Compensation'})
    questions.append({'question': "What is your current CTC?", 'category': 'Compensation'})

    if jd_data.get('notice_period'):
        questions.append({'question': f"What is your current notice period? (JD: {jd_data['notice_period']})", 'category': 'Availability'})
    else:
        questions.append({'question': "What is your notice period and earliest joining date?", 'category': 'Availability'})

    if jd_data.get('work_mode'):
        questions.append({'question': f"Are you open to {jd_data['work_mode']} working?", 'category': 'Work Mode'})

    for r in (jd_data.get('responsibilities') or [])[:3]:
        questions.append({'question': f"Can you describe your experience with: {r[:120]}?", 'category': 'Responsibilities'})

    return questions
