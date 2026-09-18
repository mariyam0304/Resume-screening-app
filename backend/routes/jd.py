from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from extensions import db
from models import JD, JDRequirement, ScreeningResult, ScreeningQuestion, InterviewNote
from services.jd_parser import parse_jd

jd_bp = Blueprint('jd', __name__)


@jd_bp.route('/', methods=['POST'])
@login_required
def create_jd():
    data = request.get_json() or {}
    raw = data.get('raw_text', '').strip()
    if not raw:
        return jsonify({'error': 'JD text required'}), 400

    parsed = parse_jd(raw)
    jd = JD(
        user_id=current_user.id,
        title=parsed['title'],
        domain=parsed['domain'],
        raw_text=raw,
        location=parsed['location'],
        work_mode=parsed['work_mode'],
        min_experience=parsed['min_experience'],
        max_experience=parsed['max_experience'],
        education=parsed['education'],
        salary=parsed['salary'],
        notice_period=parsed['notice_period'],
        employment_type=parsed['employment_type'],
    )
    db.session.add(jd)
    db.session.flush()

    for s in parsed['required_skills']:
        db.session.add(JDRequirement(jd_id=jd.id, req_type='required_skill', value=s, is_mandatory=True))
    for s in parsed['preferred_skills']:
        db.session.add(JDRequirement(jd_id=jd.id, req_type='preferred_skill', value=s, is_mandatory=False))
    for r in parsed['responsibilities']:
        db.session.add(JDRequirement(jd_id=jd.id, req_type='responsibility', value=r[:200]))

    db.session.commit()
    return jsonify({'id': jd.id, 'parsed': parsed}), 201


@jd_bp.route('/', methods=['GET'])
@login_required
def list_jds():
    jds = JD.query.filter_by(user_id=current_user.id).order_by(JD.created_at.desc()).all()
    return jsonify([{
        'id': j.id, 'title': j.title, 'domain': j.domain,
        'location': j.location, 'min_experience': j.min_experience,
        'created_at': j.created_at.isoformat()
    } for j in jds])


@jd_bp.route('/<int:jd_id>', methods=['GET'])
@login_required
def get_jd(jd_id):
    jd = JD.query.filter_by(id=jd_id, user_id=current_user.id).first_or_404()
    reqs = JDRequirement.query.filter_by(jd_id=jd.id).all()
    return jsonify({
        'id': jd.id, 'title': jd.title, 'domain': jd.domain, 'raw_text': jd.raw_text,
        'location': jd.location, 'work_mode': jd.work_mode,
        'min_experience': jd.min_experience, 'max_experience': jd.max_experience,
        'education': jd.education, 'salary': jd.salary,
        'notice_period': jd.notice_period, 'employment_type': jd.employment_type,
        'requirements': [{'type': r.req_type, 'value': r.value, 'mandatory': r.is_mandatory} for r in reqs]
    })


@jd_bp.route('/<int:jd_id>', methods=['PUT'])
@login_required
def update_jd(jd_id):
    jd = JD.query.filter_by(id=jd_id, user_id=current_user.id).first_or_404()
    data = request.get_json() or {}
    if 'raw_text' in data:
        jd.raw_text = data['raw_text']
        parsed = parse_jd(data['raw_text'])
        jd.title = parsed['title']
        jd.location = parsed['location']
        jd.min_experience = parsed['min_experience']
        jd.max_experience = parsed['max_experience']
    db.session.commit()
    return jsonify({'message': 'Updated'})


@jd_bp.route('/<int:jd_id>', methods=['DELETE'])
@login_required
def delete_jd(jd_id):
    """Delete a JD and all related data (cascade)."""
    jd = JD.query.filter_by(id=jd_id, user_id=current_user.id).first_or_404()

    try:
        # 1. Delete screening results for this JD
        ScreeningResult.query.filter_by(jd_id=jd.id).delete()

        # 2. Delete screening questions for this JD
        ScreeningQuestion.query.filter_by(jd_id=jd.id).delete()

        # 3. Delete interview notes for this JD
        InterviewNote.query.filter_by(jd_id=jd.id).delete()

        # 4. Delete JD requirements (children)
        JDRequirement.query.filter_by(jd_id=jd.id).delete()

        # 5. Finally delete the JD
        db.session.delete(jd)
        db.session.commit()

        return jsonify({'message': 'Deleted', 'id': jd_id})

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Delete failed', 'details': str(e)}), 500
