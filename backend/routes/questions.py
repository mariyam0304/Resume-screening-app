from flask import Blueprint, request, jsonify
from flask_login import login_required
from extensions import db
from models import JD, JDRequirement, ScreeningQuestion, Candidate, InterviewNote
from services.question_generator import generate_questions

questions_bp = Blueprint('questions', __name__)


def _jd_data(jd):
    reqs = JDRequirement.query.filter_by(jd_id=jd.id).all()
    return {
        'min_experience': jd.min_experience,
        'location': jd.location, 'salary': jd.salary,
        'notice_period': jd.notice_period, 'work_mode': jd.work_mode,
        'required_skills': [r.value for r in reqs if r.req_type == 'required_skill'],
        'responsibilities': [r.value for r in reqs if r.req_type == 'responsibility'],
    }


@questions_bp.route('/generate', methods=['POST'])
@login_required
def generate():
    data = request.get_json() or {}
    jd = JD.query.get_or_404(data.get('jd_id'))
    qs = generate_questions(_jd_data(jd))
    for q in qs:
        db.session.add(ScreeningQuestion(jd_id=jd.id, question=q['question'], category=q['category']))
    db.session.commit()
    return jsonify(qs)


@questions_bp.route('/interview', methods=['POST'])
@login_required
def save_interview():
    data = request.get_json() or {}
    n = InterviewNote(
        candidate_id=data.get('candidate_id'),
        jd_id=data.get('jd_id'),
        question=data.get('question', ''),
        answer=data.get('answer', '')
    )
    db.session.add(n)
    db.session.commit()
    return jsonify({'id': n.id})


@questions_bp.route('/interview/summary', methods=['POST'])
@login_required
def interview_summary():
    data = request.get_json() or {}
    cid = data.get('candidate_id')
    jid = data.get('jd_id')
    notes = InterviewNote.query.filter_by(candidate_id=cid, jd_id=jid).all()
    c = Candidate.query.get(cid)
    summary = {
        'candidate': c.name if c else '',
        'answers_count': len(notes),
        'strengths': [],
        'skill_gaps': [],
        'availability': (c.notice_period if c else ''),
        'salary_expectation': (c.expected_salary if c else ''),
        'location': (c.location if c else ''),
        'concerns': [],
    }
    for n in notes:
        if 'notice' in (n.question or '').lower() and n.answer:
            summary['availability'] = n.answer
        if 'ctc' in (n.question or '').lower() and n.answer:
            summary['salary_expectation'] = n.answer
    return jsonify(summary)
