import os
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from extensions import db
from models import (
    Candidate, CandidateSkill, CandidateExperience, CandidateStatus,
    RecruiterNote, ScreeningResult, InterviewNote
)

candidate_bp = Blueprint('candidate', __name__)


# ============================================================
# Helper: build owner filter (own + legacy NULL)
# ============================================================
def _owner_filter():
    return (Candidate.owner_user_id == current_user.id) | (Candidate.owner_user_id.is_(None))


# ============================================================
# LIST ALL CANDIDATES (filtered by owner)
# ============================================================
@candidate_bp.route('/', methods=['GET'])
@login_required
def list_candidates():
    cs = Candidate.query.filter(_owner_filter()).order_by(Candidate.created_at.desc()).all()
    out = []
    for c in cs:
        st = CandidateStatus.query.filter_by(candidate_id=c.id).first()
        out.append({
            'id': c.id,
            'name': c.name,
            'email': c.email,
            'location': c.location,
            'experience': c.total_experience,
            'designation': c.current_designation,
            'status': st.status if st else 'New'
        })
    return jsonify(out)


# ============================================================
# GET SINGLE CANDIDATE
# ============================================================
@candidate_bp.route('/<int:cid>', methods=['GET'])
@login_required
def get_candidate(cid):
    c = Candidate.query.filter(
        (Candidate.id == cid) & _owner_filter()
    ).first_or_404()
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


# ============================================================
# SET CANDIDATE STATUS
# ============================================================
@candidate_bp.route('/<int:cid>/status', methods=['POST'])
@login_required
def set_status(cid):
    c = Candidate.query.filter(
        (Candidate.id == cid) & _owner_filter()
    ).first_or_404()
    data = request.get_json() or {}
    st = CandidateStatus.query.filter_by(candidate_id=c.id).first()
    if not st:
        st = CandidateStatus(candidate_id=c.id, status=data.get('status', 'New'))
        db.session.add(st)
    else:
        st.status = data.get('status', st.status)
    db.session.commit()
    return jsonify({'message': 'Updated'})


# ============================================================
# ADD RECRUITER NOTE
# ============================================================
@candidate_bp.route('/<int:cid>/notes', methods=['POST'])
@login_required
def add_note(cid):
    Candidate.query.filter(
        (Candidate.id == cid) & _owner_filter()
    ).first_or_404()
    data = request.get_json() or {}
    n = RecruiterNote(
        candidate_id=cid,
        note=data.get('note', ''),
        follow_up_date=data.get('follow_up_date', '')
    )
    db.session.add(n)
    db.session.commit()
    return jsonify({'id': n.id})


# ============================================================
# GET RECRUITER NOTES
# ============================================================
@candidate_bp.route('/<int:cid>/notes', methods=['GET'])
@login_required
def get_notes(cid):
    Candidate.query.filter(
        (Candidate.id == cid) & _owner_filter()
    ).first_or_404()
    ns = RecruiterNote.query.filter_by(candidate_id=cid).order_by(RecruiterNote.created_at.desc()).all()
    return jsonify([{
        'id': n.id, 'note': n.note, 'follow_up_date': n.follow_up_date,
        'created_at': n.created_at.isoformat()
    } for n in ns])


# ============================================================
# GET CANDIDATE'S SCREENING RESULTS
# ============================================================
@candidate_bp.route('/<int:cid>/results', methods=['GET'])
@login_required
def candidate_results(cid):
    Candidate.query.filter(
        (Candidate.id == cid) & _owner_filter()
    ).first_or_404()
    rows = ScreeningResult.query.filter_by(candidate_id=cid).all()
    return jsonify([{
        'jd_id': r.jd_id,
        'overall_score': r.overall_score,
        'skills_score': r.skills_score,
        'experience_score': r.experience_score,
        'education_score': r.education_score,
        'location_score': r.location_score,
        'notice_score': r.notice_score,
        'domain_score': r.domain_score,
        'responsibility_score': r.responsibility_score,
        'preferred_skills_score': r.preferred_skills_score,
        'status': r.status,
        'explanation': r.explanation
    } for r in rows])


# ============================================================
# SHORTLIST TOGGLE
# ============================================================
@candidate_bp.route('/<int:cid>/shortlist', methods=['POST'])
@login_required
def toggle_shortlist(cid):
    c = Candidate.query.filter(
        (Candidate.id == cid) & _owner_filter()
    ).first_or_404()
    c.is_shortlisted = not bool(c.is_shortlisted)
    db.session.commit()
    return jsonify({'is_shortlisted': c.is_shortlisted})


# ============================================================
# DELETE CANDIDATE (owner only)
# ============================================================
@candidate_bp.route('/<int:cid>', methods=['DELETE'])
@login_required
def delete_candidate(cid):
    c = Candidate.query.filter(
        (Candidate.id == cid) & _owner_filter()
    ).first_or_404()

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


# ============================================================
# BULK DELETE (owner only)
# ============================================================
@candidate_bp.route('/bulk-delete', methods=['POST'])
@login_required
def bulk_delete():
    data = request.get_json() or {}
    ids = data.get('ids', [])
    if not ids:
        return jsonify({'error': 'No candidate ids provided'}), 400

    deleted = 0
    for cid in ids:
        c = Candidate.query.filter(
            (Candidate.id == cid) & _owner_filter()
        ).first()
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

# ============================================================
# EDIT CANDIDATE (owner only)
# ============================================================
@candidate_bp.route('/<int:cid>', methods=['PUT'])
@login_required
def update_candidate(cid):
    c = Candidate.query.filter(
        (Candidate.id == cid) & _owner_filter()
    ).first_or_404()

    data = request.get_json() or {}

    # Text fields
    if 'name' in data:
        c.name = (data.get('name') or '').strip()[:150]
    if 'email' in data:
        c.email = (data.get('email') or '').strip()[:150]
    if 'phone' in data:
        c.phone = (data.get('phone') or '').strip()[:50]
    if 'location' in data:
        c.location = (data.get('location') or '').strip()[:150]
    if 'education' in data:
        c.education = (data.get('education') or '').strip()[:300]
    if 'current_company' in data:
        c.current_company = (data.get('current_company') or '').strip()[:200]
    if 'current_designation' in data:
        c.current_designation = (data.get('current_designation') or '').strip()[:200]
    if 'notice_period' in data:
        c.notice_period = (data.get('notice_period') or '').strip()[:80]
    if 'expected_salary' in data:
        c.expected_salary = (data.get('expected_salary') or '').strip()[:120]
    if 'current_salary' in data:
        c.current_salary = (data.get('current_salary') or '').strip()[:120]

    # Numeric
    if 'total_experience' in data:
        try:
            c.total_experience = float(data.get('total_experience') or 0)
        except (TypeError, ValueError):
            pass
    if 'relevant_experience' in data:
        try:
            c.relevant_experience = float(data.get('relevant_experience') or 0)
        except (TypeError, ValueError):
            pass

    # Skills — replace all
    if 'skills' in data:
        skills = data.get('skills') or []
        if isinstance(skills, str):
            skills = [s.strip() for s in skills.split(',') if s.strip()]
        # Delete existing
        CandidateSkill.query.filter_by(candidate_id=c.id).delete()
        # Add new
        for s in skills:
            s_clean = (s or '').strip()[:120]
            if s_clean:
                db.session.add(CandidateSkill(candidate_id=c.id, skill=s_clean))

    db.session.commit()
    return jsonify({'message': 'Updated', 'id': c.id})
