import json
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from extensions import db
from models import JD, JDRequirement, Candidate, ScreeningResult
from services.scorer import score_candidate
from services.fraud_checker import check_inconsistencies
from config import Config

screening_bp = Blueprint('screening', __name__)


def _load_jd_data(jd):
    reqs = JDRequirement.query.filter_by(jd_id=jd.id).all()
    required = [r.value for r in reqs if r.req_type == 'required_skill']
    preferred = [r.value for r in reqs if r.req_type == 'preferred_skill']
    responsibilities = [r.value for r in reqs if r.req_type == 'responsibility']
    return {
        'title': jd.title, 'domain': jd.domain,
        'location': jd.location, 'work_mode': jd.work_mode,
        'min_experience': jd.min_experience, 'max_experience': jd.max_experience,
        'education': jd.education, 'salary': jd.salary,
        'notice_period': jd.notice_period,
        'required_skills': required, 'preferred_skills': preferred,
        'responsibilities': responsibilities,
    }


@screening_bp.route('/run', methods=['POST'])
@login_required
def run_screening():
    data = request.get_json() or {}
    jd_id = data.get('jd_id')
    candidate_ids = data.get('candidate_ids') or []
    weights = data.get('weights') or Config.DEFAULT_WEIGHTS

    jd = JD.query.filter_by(id=jd_id, user_id=current_user.id).first_or_404()
    jd_data = _load_jd_data(jd)

    if not candidate_ids:
        candidates = Candidate.query.all()
    else:
        candidates = Candidate.query.filter(Candidate.id.in_(candidate_ids)).all()

    results = []
    for c in candidates:
        ScreeningResult.query.filter_by(jd_id=jd.id, candidate_id=c.id).delete()

        score = score_candidate(jd_data, {
            'total_experience': c.total_experience,
            'education': c.education,
            'location': c.location,
            'notice_period': c.notice_period,
        }, c.raw_text or '', weights)

        sr = ScreeningResult(
            jd_id=jd.id, candidate_id=c.id,
            overall_score=score['overall_score'],
            skills_score=score['skills_score'],
            experience_score=score['experience_score'],
            education_score=score['education_score'],
            location_score=score['location_score'],
            notice_score=score['notice_score'],
            domain_score=score['domain_score'],
            responsibility_score=score['responsibility_score'],
            preferred_skills_score=score['preferred_skills_score'],
            status=score['status'],
            explanation=score['explanation'],
        )
        db.session.add(sr)
        db.session.flush()

        inconsistencies = check_inconsistencies(c.raw_text or '')
        results.append({
            'candidate_id': c.id,
            'candidate_name': c.name,
            'overall_score': sr.overall_score,
            'status': sr.status,
            'inconsistencies': inconsistencies,
        })

    db.session.commit()
    return jsonify({'results': results, 'jd_id': jd.id})


@screening_bp.route('/results/<int:jd_id>', methods=['GET'])
@login_required
def results_for_jd(jd_id):
    jd = JD.query.filter_by(id=jd_id, user_id=current_user.id).first_or_404()
    rows = ScreeningResult.query.filter_by(jd_id=jd.id).order_by(ScreeningResult.overall_score.desc()).all()
    out = []
    for r in rows:
        c = Candidate.query.get(r.candidate_id)
        out.append({
            'result_id': r.id,
            'candidate_id': c.id,
            'name': c.name,
            'email': c.email,
            'location': c.location,
            'experience': c.total_experience,
            'notice': c.notice_period,
            'overall_score': r.overall_score,
            'skills_score': r.skills_score,
            'experience_score': r.experience_score,
            'education_score': r.education_score,
            'location_score': r.location_score,
            'notice_score': r.notice_score,
            'responsibility_score': r.responsibility_score,
            'preferred_skills_score': r.preferred_skills_score,
            'status': r.status,
            'explanation': json.loads(r.explanation or '{}'),
        })
    return jsonify(out)


@screening_bp.route('/filter/<int:jd_id>', methods=['POST'])
@login_required
def filter_results(jd_id):
    data = request.get_json() or {}
    q = ScreeningResult.query.filter_by(jd_id=jd_id)

    min_score = data.get('min_score')
    max_score = data.get('max_score')
    status = data.get('status')
    min_exp = data.get('min_experience')
    skill = data.get('skill')

    if min_score is not None:
        q = q.filter(ScreeningResult.overall_score >= float(min_score))
    if max_score is not None:
        q = q.filter(ScreeningResult.overall_score <= float(max_score))
    if status:
        q = q.filter(ScreeningResult.status == status)

    rows = q.order_by(ScreeningResult.overall_score.desc()).all()
    out = []
    for r in rows:
        c = Candidate.query.get(r.candidate_id)
        if min_exp is not None and (c.total_experience or 0) < float(min_exp):
            continue
        if skill and skill.lower() not in (c.raw_text or '').lower():
            continue
        out.append({
            'candidate_id': c.id, 'name': c.name, 'overall_score': r.overall_score,
            'status': r.status, 'experience': c.total_experience,
            'location': c.location, 'notice': c.notice_period,
            'explanation': json.loads(r.explanation or '{}'),
        })
    return jsonify(out)


# ---------- Weight configuration ----------

@screening_bp.route('/weights', methods=['GET'])
@login_required
def get_weights():
    return jsonify(Config.DEFAULT_WEIGHTS)


@screening_bp.route('/weights', methods=['POST'])
@login_required
def set_weights():
    from flask import current_app
    data = request.get_json() or {}
    weights = data.get('weights', {})
    # normalize so they sum to 1.0
    total = sum(float(v) for v in weights.values() if isinstance(v, (int, float))) or 1.0
    normalized = {k: round(float(v) / total, 4) for k, v in weights.items()}
    # update in-memory config for this session
    current_app.config['DEFAULT_WEIGHTS'] = normalized
    return jsonify({'weights': normalized})
