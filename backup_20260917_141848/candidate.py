import os
from flask import Blueprint, request, jsonify
from flask_login import login_required
from extensions import db
from models import (
    Candidate, CandidateSkill, CandidateExperience, CandidateStatus,
    RecruiterNote, ScreeningResult, InterviewNote
)

candidate_bp = Blueprint('candidate', __name__)


@candidate_bp.route('/', methods=['GET'])
@login_required
def list_candidates():
    cs = Candidate.query.order_by(Candidate.created_at.desc()).all()
    out = []
    for c in cs:
        st = CandidateStatus.query.filter_by(candidate_id=c.id).first()
        out.append({
            'id': c.id, 'name': c.name, 'email': c.email, 'location': c.location,
            'experience': c.total_experience, 'designation': c.current_designation,
            'status': st.status if st else 'New'
        })
    return jsonify(out)


@candidate_bp.route('/<int:cid>', methods=['GET'])
@login_required
def get_candidate(cid):
    c = Candidate.query.get_or_404(cid)
    skills = [s.skill for s in CandidateSkill.query.filter_by(candidate_id=c.id).all()]
    st = CandidateStatus.query.filter_by(candidate_id=c.id).first()
    return jsonify({
        'id': c.id, 'name': c.name, 'email': c.email, 'phone': c.phone,
        'location': c.location, 'experience': c.total_experience,
        'relevant_experience': c.relevant_experience,
        'current_company': c.current_company, 'current_designation': c.current_designation,
        'education': c.education, 'notice': c.notice_period,
        'expected_salary': c.expected_salary, 'current_salary': c.current_salary,
        'skills': skills, 'status': st.status if st else 'New'
    })


@candidate_bp.route('/<int:cid>/status', methods=['POST'])
@login_required
def set_status(cid):
    data = request.get_json() or {}
    st = CandidateStatus.query.filter_by(candidate_id=cid).first()
    if not st:
        st = CandidateStatus(candidate_id=cid, status=data.get('status', 'New'))
        db.session.add(st)
    else:
        st.status = data.get('status', st.status)
    db.session.commit()
    return jsonify({'message': 'Updated'})


@candidate_bp.route('/<int:cid>/notes', methods=['POST'])
@login_required
def add_note(cid):
    data = request.get_json() or {}
    n = RecruiterNote(
        candidate_id=cid, note=data.get('note', ''),
        follow_up_date=data.get('follow_up_date', '')
    )
    db.session.add(n)
    db.session.commit()
    return jsonify({'id': n.id})


@candidate_bp.route('/<int:cid>/notes', methods=['GET'])
@login_required
def get_notes(cid):
    ns = RecruiterNote.query.filter_by(candidate_id=cid).order_by(RecruiterNote.created_at.desc()).all()
    return jsonify([{
        'id': n.id, 'note': n.note, 'follow_up_date': n.follow_up_date,
        'created_at': n.created_at.isoformat()
    } for n in ns])


@candidate_bp.route('/<int:cid>/results', methods=['GET'])
@login_required
def candidate_results(cid):
    rows = ScreeningResult.query.filter_by(candidate_id=cid).all()
    return jsonify([{
        'jd_id': r.jd_id, 'overall_score': r.overall_score,
        'status': r.status, 'explanation': r.explanation
    } for r in rows])


# ---------- DELETE single candidate ----------

@candidate_bp.route('/<int:cid>', methods=['DELETE'])
@login_required
def delete_candidate(cid):
    c = Candidate.query.get_or_404(cid)

    if c.file_path and os.path.exists(c.file_path):
        try:
            os.remove(c.file_path)
        except Exception:
            pass

    ScreeningResult.query.filter_by(candidate_id=cid).delete()
    CandidateSkill.query.filter_by(candidate_id=cid).delete()
    CandidateExperience.query.filter_by(candidate_id=cid).delete()
    CandidateStatus.query.filter_by(candidate_id=cid).delete()
    RecruiterNote.query.filter_by(candidate_id=cid).delete()
    InterviewNote.query.filter_by(candidate_id=cid).delete()

    db.session.delete(c)
    db.session.commit()
    return jsonify({'message': 'Deleted', 'id': cid})


# ---------- DELETE multiple candidates (bulk) ----------

@candidate_bp.route('/bulk-delete', methods=['POST'])
@login_required
def bulk_delete():
    data = request.get_json() or {}
    ids = data.get('ids', [])
    if not ids:
        return jsonify({'error': 'No candidate ids provided'}), 400

    deleted = 0
    for cid in ids:
        c = Candidate.query.get(cid)
        if not c:
            continue

        if c.file_path and os.path.exists(c.file_path):
            try:
                os.remove(c.file_path)
            except Exception:
                pass

        ScreeningResult.query.filter_by(candidate_id=cid).delete()
        CandidateSkill.query.filter_by(candidate_id=cid).delete()
        CandidateExperience.query.filter_by(candidate_id=cid).delete()
        CandidateStatus.query.filter_by(candidate_id=cid).delete()
        RecruiterNote.query.filter_by(candidate_id=cid).delete()
        InterviewNote.query.filter_by(candidate_id=cid).delete()

        db.session.delete(c)
        deleted += 1

    db.session.commit()
    return jsonify({'message': 'Bulk delete complete', 'deleted': deleted})
