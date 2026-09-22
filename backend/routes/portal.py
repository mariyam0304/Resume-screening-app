"""
Candidate Portal Blueprint — Phase 2 (register, login, profile).
"""
import os
import hashlib
from flask import Blueprint, request, jsonify, current_app, session, send_file
from werkzeug.utils import secure_filename
from extensions import db
from models import CandidateUser, Application, CandidateNotification

portal_bp = Blueprint('portal', __name__)

ALLOWED_RESUME_EXT = {'pdf', 'docx', 'doc', 'txt'}
MAX_RESUME_SIZE = 10 * 1024 * 1024  # 10MB


def _allowed_resume(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_RESUME_EXT


def _hash_file(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            h.update(chunk)
    return h.hexdigest()


def _current_candidate():
    cid = session.get('candidate_id')
    if not cid:
        return None
    return CandidateUser.query.get(cid)


# ============================================================
# STATUS (from Phase 1, kept for compatibility)
# ============================================================

@portal_bp.route('/status', methods=['GET'])
def status():
    return jsonify({
        'module': 'candidate_portal',
        'phase': 2,
        'message': 'Phase 2 ready — candidate auth + profile live.'
    })


# ============================================================
# REGISTER
# ============================================================

@portal_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    username = (data.get('username') or '').strip()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''
    full_name = (data.get('full_name') or '').strip()

    if not username or not email or not password:
        return jsonify({'error': 'Username, email, and password are required'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400

    if CandidateUser.query.filter_by(username=username).first():
        return jsonify({'error': 'Username already taken'}), 400
    if CandidateUser.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already registered'}), 400

    user = CandidateUser(username=username, email=email, full_name=full_name)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    session['candidate_id'] = user.id
    return jsonify({
        'message': 'Registered',
        'candidate': {
            'id': user.id, 'username': user.username,
            'email': user.email, 'full_name': user.full_name
        }
    }), 201


# ============================================================
# LOGIN
# ============================================================

@portal_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''

    user = CandidateUser.query.filter_by(username=username).first()
    if not user or not user.check_password(password):
        return jsonify({'error': 'Invalid credentials'}), 401

    session['candidate_id'] = user.id
    return jsonify({
        'message': 'Logged in',
        'candidate': {
            'id': user.id, 'username': user.username,
            'email': user.email, 'full_name': user.full_name
        }
    })


# ============================================================
# LOGOUT
# ============================================================

@portal_bp.route('/logout', methods=['POST'])
def logout():
    session.pop('candidate_id', None)
    return jsonify({'message': 'Logged out'})


# ============================================================
# CURRENT USER
# ============================================================

@portal_bp.route('/me', methods=['GET'])
def me():
    user = _current_candidate()
    if not user:
        return jsonify({'error': 'Not logged in'}), 401
    return jsonify({
        'id': user.id, 'username': user.username,
        'email': user.email, 'full_name': user.full_name,
        'phone': user.phone, 'location': user.location,
        'education': user.education, 'experience_years': user.experience_years,
        'skills_summary': user.skills_summary,
        'resume_filename': user.resume_filename,
        'has_resume': bool(user.resume_path)
    })


# ============================================================
# UPDATE PROFILE
# ============================================================

@portal_bp.route('/profile', methods=['POST'])
def update_profile():
    user = _current_candidate()
    if not user:
        return jsonify({'error': 'Not logged in'}), 401

    data = request.get_json() or {}
    user.full_name = (data.get('full_name') or user.full_name or '').strip()
    user.phone = (data.get('phone') or user.phone or '').strip()
    user.location = (data.get('location') or user.location or '').strip()
    user.education = (data.get('education') or user.education or '').strip()
    user.skills_summary = (data.get('skills_summary') or user.skills_summary or '').strip()

    try:
        user.experience_years = float(data.get('experience_years') or user.experience_years or 0)
    except (ValueError, TypeError):
        user.experience_years = user.experience_years or 0

    db.session.commit()
    return jsonify({'message': 'Profile updated'})


# ============================================================
# UPLOAD RESUME
# ============================================================

@portal_bp.route('/resume', methods=['POST'])
def upload_resume():
    user = _current_candidate()
    if not user:
        return jsonify({'error': 'Not logged in'}), 401

    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400

    f = request.files['file']
    if not f.filename or not _allowed_resume(f.filename):
        return jsonify({'error': 'Unsupported file type (use PDF, DOCX, DOC, TXT)'}), 400

    upload_dir = current_app.config['UPLOAD_FOLDER']
    candidate_dir = os.path.join(upload_dir, 'candidate_resumes', str(user.id))
    os.makedirs(candidate_dir, exist_ok=True)

    safe_name = secure_filename(f.filename)
    base, ext = os.path.splitext(safe_name)
    path = os.path.join(candidate_dir, safe_name)
    i = 1
    while os.path.exists(path):
        path = os.path.join(candidate_dir, f"{base}_{i}{ext}")
        i += 1

    f.save(path)
    size = os.path.getsize(path)
    if size > MAX_RESUME_SIZE:
        os.remove(path)
        return jsonify({'error': 'File exceeds 10MB limit'}), 400

    # Remove previous resume if it exists
    if user.resume_path and os.path.exists(user.resume_path):
        try:
            os.remove(user.resume_path)
        except Exception:
            pass

    user.resume_path = path
    user.resume_filename = safe_name
    user.resume_hash = _hash_file(path)
    db.session.commit()

    return jsonify({
        'message': 'Resume uploaded',
        'filename': safe_name,
        'size': size
    })


# ============================================================
# DOWNLOAD OWN RESUME
# ============================================================

@portal_bp.route('/resume/download', methods=['GET'])
def download_resume():
    user = _current_candidate()
    if not user or not user.resume_path or not os.path.exists(user.resume_path):
        return jsonify({'error': 'No resume uploaded'}), 404
    return send_file(user.resume_path, as_attachment=True, download_name=user.resume_filename)


# ============================================================
# MY APPLICATIONS (Phase 2 — read only; apply comes in Phase 3)
# ============================================================

@portal_bp.route('/applications', methods=['GET'])
def my_applications():
    user = _current_candidate()
    if not user:
        return jsonify({'error': 'Not logged in'}), 401

    rows = Application.query.filter_by(candidate_user_id=user.id).order_by(Application.applied_at.desc()).all()
    out = []
    for a in rows:
        from models import JD
        jd = JD.query.get(a.jd_id)
        out.append({
            'id': a.id,
            'jd_id': a.jd_id,
            'jd_title': jd.title if jd else '-',
            'status': a.status,
            'applied_at': a.applied_at.isoformat() if a.applied_at else ''
        })
    return jsonify(out)


# ============================================================
# PHASE 3 - Job Board + Apply + Recruiter Inbox
# ============================================================

from models import JD, JDRequirement, ScreeningResult, Candidate, CandidateSkill, CandidateStatus
from services.text_extractor import extract_text
from services.resume_parser import parse_resume
from services.scorer import score_candidate
from services.emailer import send_email, smtp_configured
from flask_login import login_required, current_user


def _load_jd_data_for_scoring(jd):
    reqs = JDRequirement.query.filter_by(jd_id=jd.id).all()
    return {
        'title': jd.title, 'domain': jd.domain,
        'location': jd.location, 'work_mode': jd.work_mode,
        'min_experience': jd.min_experience, 'max_experience': jd.max_experience,
        'education': jd.education, 'salary': jd.salary,
        'notice_period': jd.notice_period,
        'required_skills': [r.value for r in reqs if r.req_type == 'required_skill'],
        'preferred_skills': [r.value for r in reqs if r.req_type == 'preferred_skill'],
        'responsibilities': [r.value for r in reqs if r.req_type == 'responsibility'],
    }


@portal_bp.route('/jobs', methods=['GET'])
def list_open_jobs():
    jds = JD.query.order_by(JD.created_at.desc()).all()
    out = []
    for jd in jds:
        reqs = JDRequirement.query.filter_by(jd_id=jd.id).all()
        out.append({
            'id': jd.id, 'title': jd.title, 'domain': jd.domain,
            'location': jd.location, 'work_mode': jd.work_mode,
            'min_experience': jd.min_experience, 'max_experience': jd.max_experience,
            'education': jd.education, 'salary': jd.salary,
            'notice_period': jd.notice_period, 'employment_type': jd.employment_type,
            'required_skills': [r.value for r in reqs if r.req_type == 'required_skill'][:8],
            'preferred_skills': [r.value for r in reqs if r.req_type == 'preferred_skill'][:5],
            'posted_at': jd.created_at.isoformat() if jd.created_at else '',
        })
    return jsonify(out)


@portal_bp.route('/jobs/<int:jd_id>', methods=['GET'])
def job_detail(jd_id):
    jd = JD.query.get_or_404(jd_id)
    reqs = JDRequirement.query.filter_by(jd_id=jd.id).all()
    return jsonify({
        'id': jd.id, 'title': jd.title, 'domain': jd.domain,
        'location': jd.location, 'work_mode': jd.work_mode,
        'min_experience': jd.min_experience, 'max_experience': jd.max_experience,
        'education': jd.education, 'salary': jd.salary,
        'notice_period': jd.notice_period, 'employment_type': jd.employment_type,
        'raw_text': jd.raw_text,
        'required_skills': [r.value for r in reqs if r.req_type == 'required_skill'],
        'preferred_skills': [r.value for r in reqs if r.req_type == 'preferred_skill'],
        'responsibilities': [r.value for r in reqs if r.req_type == 'responsibility'],
    })


@portal_bp.route('/apply/<int:jd_id>', methods=['POST'])
def apply_to_jd(jd_id):
    user = _current_candidate()
    if not user:
        return jsonify({'error': 'Please log in as a candidate first'}), 401
    if not user.resume_path or not os.path.exists(user.resume_path):
        return jsonify({'error': 'Please upload a resume before applying'}), 400

    existing = Application.query.filter_by(candidate_user_id=user.id, jd_id=jd_id).first()
    if existing:
        return jsonify({'error': 'Already applied', 'application_id': existing.id}), 400

    jd = JD.query.get_or_404(jd_id)
    data = request.get_json() or {}
    cover_note = (data.get('cover_note') or '').strip()

    try:
        resume_text = extract_text(user.resume_path)
    except Exception:
        resume_text = ''

    parsed = parse_resume(resume_text) if resume_text else {}

    jd_data = _load_jd_data_for_scoring(jd)
    candidate_data = {
        'total_experience': parsed.get('total_experience') or user.experience_years or 0,
        'education': parsed.get('education') or user.education or '',
        'location': parsed.get('location') or user.location or '',
        'notice_period': parsed.get('notice_period') or '',
    }
    try:
        score = score_candidate(jd_data, candidate_data, resume_text or '')
        match_score = score['overall_score']
        score_explanation = score['explanation']
    except Exception:
        score = {}
        match_score = 0
        score_explanation = '{}'

    app_row = Application(
        candidate_user_id=user.id, jd_id=jd_id,
        applied_resume_path=user.resume_path,
        applied_resume_filename=user.resume_filename,
        cover_note=cover_note, match_score=match_score, status='Applied',
    )
    db.session.add(app_row)
    db.session.flush()

    existing_cand = Candidate.query.filter_by(email=user.email).first()
    if not existing_cand:
        c = Candidate(
            name=parsed.get('name') or user.full_name or user.username,
            email=user.email,
            phone=parsed.get('phone') or user.phone or '',
            location=parsed.get('location') or user.location or '',
            total_experience=parsed.get('total_experience') or user.experience_years or 0,
            relevant_experience=parsed.get('total_experience') or user.experience_years or 0,
            education=parsed.get('education') or user.education or '',
            notice_period=parsed.get('notice_period') or '',
            raw_text=resume_text or '',
            file_path=user.resume_path,
            file_hash=user.resume_hash or '',
        )
        db.session.add(c)
        db.session.flush()
        existing_cand = c
        for s in parsed.get('skills', []):
            db.session.add(CandidateSkill(candidate_id=c.id, skill=s))
        db.session.add(CandidateStatus(candidate_id=c.id, status='New'))

    sr = ScreeningResult(
        jd_id=jd_id, candidate_id=existing_cand.id,
        overall_score=score.get('overall_score', 0),
        skills_score=score.get('skills_score', 0),
        experience_score=score.get('experience_score', 0),
        education_score=score.get('education_score', 0),
        location_score=score.get('location_score', 0),
        notice_score=score.get('notice_score', 0),
        domain_score=score.get('domain_score', 0),
        responsibility_score=score.get('responsibility_score', 0),
        preferred_skills_score=score.get('preferred_skills_score', 0),
        status=score.get('status', 'Needs Review'),
        explanation=score_explanation,
    )
    db.session.add(sr)

    db.session.add(CandidateNotification(
        candidate_user_id=user.id, application_id=app_row.id,
        message='Application submitted for "' + jd.title + '". Match score: ' + str(round(match_score, 1)) + '%'
    ))

    db.session.commit()
    return jsonify({'message': 'Application submitted', 'application_id': app_row.id, 'match_score': match_score}), 201


@portal_bp.route('/my-applications', methods=['GET'])
def my_applications_full():
    user = _current_candidate()
    if not user:
        return jsonify({'error': 'Not logged in'}), 401
    rows = Application.query.filter_by(candidate_user_id=user.id).order_by(Application.applied_at.desc()).all()
    out = []
    for a in rows:
        jd = JD.query.get(a.jd_id)
        out.append({
            'id': a.id, 'jd_id': a.jd_id,
            'jd_title': jd.title if jd else '-',
            'jd_location': jd.location if jd else '',
            'status': a.status, 'match_score': a.match_score,
            'applied_at': a.applied_at.isoformat() if a.applied_at else '',
        })
    return jsonify(out)


@portal_bp.route('/notifications', methods=['GET'])
def my_notifications():
    user = _current_candidate()
    if not user:
        return jsonify({'error': 'Not logged in'}), 401
    rows = CandidateNotification.query.filter_by(candidate_user_id=user.id).order_by(CandidateNotification.created_at.desc()).limit(50).all()
    return jsonify([{'id': n.id, 'message': n.message, 'is_read': n.is_read,
                     'created_at': n.created_at.isoformat()} for n in rows])


@portal_bp.route('/recruiter/applications/<int:jd_id>', methods=['GET'])
@login_required
def recruiter_applications(jd_id):
    jd = JD.query.filter_by(id=jd_id, user_id=current_user.id).first_or_404()
    apps = Application.query.filter_by(jd_id=jd_id).order_by(Application.match_score.desc()).all()
    out = []
    for a in apps:
        cu = CandidateUser.query.get(a.candidate_user_id)
        out.append({
            'application_id': a.id,
            'candidate_user_id': a.candidate_user_id,
            'name': (cu.full_name or cu.username) if cu else '-',
            'email': cu.email if cu else '',
            'phone': cu.phone if cu else '',
            'location': cu.location if cu else '',
            'education': cu.education if cu else '',
            'experience_years': cu.experience_years if cu else 0,
            'skills_summary': cu.skills_summary if cu else '',
            'resume_filename': a.applied_resume_filename,
            'cover_note': a.cover_note,
            'match_score': a.match_score,
            'status': a.status,
            'applied_at': a.applied_at.isoformat() if a.applied_at else '',
        })
    return jsonify({'jd': {'id': jd.id, 'title': jd.title, 'location': jd.location}, 'applications': out})


@portal_bp.route('/recruiter/application/<int:app_id>', methods=['GET'])
@login_required
def recruiter_application_detail(app_id):
    a = Application.query.get_or_404(app_id)
    jd = JD.query.get(a.jd_id)
    if not jd or jd.user_id != current_user.id:
        return jsonify({'error': 'Not authorized'}), 403
    cu = CandidateUser.query.get(a.candidate_user_id)
    return jsonify({
        'application_id': a.id, 'status': a.status, 'match_score': a.match_score,
        'applied_at': a.applied_at.isoformat() if a.applied_at else '',
        'cover_note': a.cover_note,
        'candidate': {
            'user_id': cu.id if cu else None,
            'username': cu.username if cu else '',
            'name': cu.full_name if cu else '',
            'email': cu.email if cu else '',
            'phone': cu.phone if cu else '',
            'location': cu.location if cu else '',
            'education': cu.education if cu else '',
            'experience_years': cu.experience_years if cu else 0,
            'skills_summary': cu.skills_summary if cu else '',
            'resume_filename': a.applied_resume_filename,
        },
        'jd': {'id': jd.id, 'title': jd.title, 'location': jd.location},
    })


@portal_bp.route('/recruiter/application/<int:app_id>/status', methods=['POST'])
@login_required
def recruiter_update_status(app_id):
    a = Application.query.get_or_404(app_id)
    jd = JD.query.get(a.jd_id)
    if not jd or jd.user_id != current_user.id:
        return jsonify({'error': 'Not authorized'}), 403
    data = request.get_json() or {}
    new_status = (data.get('status') or '').strip()
    allowed = ['Applied', 'Under Review', 'Shortlisted', 'Interview Scheduled', 'Rejected']
    if new_status not in allowed:
        return jsonify({'error': 'Invalid status'}), 400
    a.status = new_status
    if 'recruiter_note' in data:
        a.recruiter_note = data['recruiter_note']
    db.session.commit()
    db.session.add(CandidateNotification(
        candidate_user_id=a.candidate_user_id, application_id=a.id,
        message='Your application for "' + jd.title + '" is now: ' + new_status
    ))
    db.session.commit()
    # ===== FEATURE A - Send email =====
    try:
        cu = CandidateUser.query.get(a.candidate_user_id)
        if cu and cu.email:
            _subject = 'Update on your application for ' + jd.title
            _body = ('Hi ' + (cu.full_name or cu.username) + ',\n\n'
                     'Your application status has been updated.\n\n'
                     'Job: ' + jd.title + '\n'
                     'Status: ' + new_status + '\n\n'
                     'Log in to SmartHire AI to see the details.\n\n'
                     'Best regards,\nSmartHire AI Team')
            _ok, _msg = send_email(cu.email, _subject, _body)
            _email_status = 'sent' if _ok else 'failed: ' + _msg
        else:
            _email_status = 'no email'
    except Exception as _e:
        _email_status = 'error: ' + str(_e)

    return jsonify({'message': 'Status updated', 'status': new_status, 'email_status': _email_status})


@portal_bp.route('/recruiter/application/<int:app_id>/resume', methods=['GET'])
@login_required
def recruiter_download_applicant_resume(app_id):
    a = Application.query.get_or_404(app_id)
    jd = JD.query.get(a.jd_id)
    if not jd or jd.user_id != current_user.id:
        return jsonify({'error': 'Not authorized'}), 403
    if not a.applied_resume_path or not os.path.exists(a.applied_resume_path):
        return jsonify({'error': 'Resume file missing'}), 404
    return send_file(a.applied_resume_path, as_attachment=True,
                     download_name=a.applied_resume_filename or 'resume.pdf')


# ============================================================
# PHASE 4 - Notifications + Recommendations + Dashboard counts
# ============================================================

from models import JD as _JD


@portal_bp.route('/notifications/count', methods=['GET'])
def notification_count():
    user = _current_candidate()
    if not user:
        return jsonify({'count': 0})
    count = CandidateNotification.query.filter_by(
        candidate_user_id=user.id, is_read=False
    ).count()
    return jsonify({'count': count})


@portal_bp.route('/notifications/mark-read', methods=['POST'])
def mark_notifications_read():
    user = _current_candidate()
    if not user:
        return jsonify({'error': 'Not logged in'}), 401
    CandidateNotification.query.filter_by(
        candidate_user_id=user.id, is_read=False
    ).update({'is_read': True})
    db.session.commit()
    return jsonify({'message': 'Marked read'})


@portal_bp.route('/recommended-jobs', methods=['GET'])
def recommended_jobs():
    """Recommend jobs to a logged-in candidate based on their profile skills."""
    user = _current_candidate()
    if not user:
        return jsonify([])

    # Build a mini-resume text from the candidate's profile
    candidate_text = ' '.join([
        user.skills_summary or '',
        user.education or '',
        user.location or '',
        user.full_name or ''
    ]).lower()

    jds = _JD.query.order_by(_JD.created_at.desc()).limit(20).all()
    scored = []
    for jd in jds:
        reqs = JDRequirement.query.filter_by(jd_id=jd.id).all()
        required = [r.value.lower() for r in reqs if r.req_type == 'required_skill']
        if not required:
            continue

        hits = sum(1 for s in required if s in candidate_text)
        # Exp match
        exp_match = True
        if jd.min_experience and (user.experience_years or 0) < jd.min_experience:
            exp_match = False

        score = (hits / len(required)) * 100
        if exp_match:
            score = min(100, score + 5)

        if score >= 30:
            scored.append({
                'jd_id': jd.id,
                'title': jd.title,
                'location': jd.location,
                'min_experience': jd.min_experience,
                'match_percent': round(score, 1),
                'matched_skills': [s for s in required if s in candidate_text][:5],
                'required_skills': required[:6]
            })

    scored.sort(key=lambda x: -x['match_percent'])
    return jsonify(scored[:8])


@portal_bp.route('/recruiter/dashboard-counts', methods=['GET'])
@login_required
def recruiter_dashboard_counts():
    """Return application counts per JD + total unread notifications."""
    jds = _JD.query.filter_by(user_id=current_user.id).all()
    out = []
    total_apps = 0
    total_shortlisted = 0
    for jd in jds:
        apps = Application.query.filter_by(jd_id=jd.id).all()
        short = sum(1 for a in apps if a.status == 'Shortlisted')
        out.append({
            'jd_id': jd.id,
            'title': jd.title,
            'application_count': len(apps),
            'shortlisted_count': short,
            'new_today': sum(1 for a in apps if a.applied_at and
                             (a.applied_at.date() == __import__('datetime').datetime.utcnow().date()))
        })
        total_apps += len(apps)
        total_shortlisted += short

    return jsonify({
        'per_jd': out,
        'total_applications': total_apps,
        'total_shortlisted': total_shortlisted,
    })


# ============================================================
# TIER 1 - Personalized Interview Questions
# ============================================================

@portal_bp.route('/recruiter/candidate-questions/<int:app_id>', methods=['GET'])
@login_required
def recruiter_candidate_questions(app_id):
    """Generate personalized interview questions for a candidate + JD."""
    a = Application.query.get_or_404(app_id)
    jd = JD.query.get(a.jd_id)
    if not jd or jd.user_id != current_user.id:
        return jsonify({'error': 'Not authorized'}), 403

    cu = CandidateUser.query.get(a.candidate_user_id)
    if not cu:
        return jsonify({'error': 'Candidate not found'}), 404

    # Load JD requirements
    reqs = JDRequirement.query.filter_by(jd_id=jd.id).all()
    required = [r.value for r in reqs if r.req_type == 'required_skill']
    preferred = [r.value for r in reqs if r.req_type == 'preferred_skill']

    # Build candidate text
    cand_text = ' '.join([
        cu.skills_summary or '',
        cu.education or '',
        cu.full_name or '',
        cu.location or ''
    ]).lower()

    # Also get their resume text
    resume_text = ''
    if cu.resume_path and os.path.exists(cu.resume_path):
        try:
            resume_text = extract_text(cu.resume_path) or ''
        except Exception:
            pass
    resume_low = resume_text.lower()

    questions = []

    # 1. Mandatory skill missing
    for s in required:
        if s.lower() not in resume_low and s.lower() not in cand_text:
            questions.append({
                'question': 'You did not mention ' + s + ' in your resume. Do you have any hands-on experience with it?',
                'category': 'Mandatory Skill Gap',
                'severity': 'high'
            })

    # 2. Preferred skill missing
    for s in preferred:
        if s.lower() not in resume_low and s.lower() not in cand_text:
            questions.append({
                'question': 'Have you ever worked with ' + s + '? It is preferred for this role.',
                'category': 'Preferred Skill Gap',
                'severity': 'medium'
            })

    # 3. Experience-related
    if jd.min_experience:
        if (cu.experience_years or 0) < jd.min_experience:
            questions.append({
                'question': 'The role requires ' + str(jd.min_experience) + '+ years. You have ' +
                             str(cu.experience_years or 0) + ' years. Can you describe the depth of your experience?',
                'category': 'Experience',
                'severity': 'high'
            })
        elif (cu.experience_years or 0) > jd.max_experience * 1.5 if jd.max_experience else False:
            questions.append({
                'question': 'You have ' + str(cu.experience_years) + ' years of experience, which is above the range. Why are you interested in this role?',
                'category': 'Overqualification',
                'severity': 'low'
            })

    # 4. Location compatibility
    if jd.location and cu.location and jd.location.lower() not in cu.location.lower():
        questions.append({
            'question': 'This role is based in ' + jd.location + '. You are currently in ' + cu.location +
                         '. Would you be open to relocating or commuting?',
            'category': 'Location',
            'severity': 'medium'
        })

    # 5. Notice period
    if jd.notice_period and 'immediate' in jd.notice_period.lower():
        questions.append({
            'question': 'How soon can you join? The role prefers an immediate joiner.',
            'category': 'Availability',
            'severity': 'medium'
        })

    # 6. Career gap detection (basic)
    import re as _re
    from datetime import datetime as _dt
    year_ranges = _re.findall(r'(20\d{2})\s*[-–to]+\s*(20\d{2}|present|current)', resume_text or '', _re.I)
    if len(year_ranges) >= 2:
        parsed = sorted((int(y1), _dt.now().year if y2.lower() in ('present','current') else int(y2))
                        for y1, y2 in year_ranges)
        for i in range(1, len(parsed)):
            gap = parsed[i][0] - parsed[i-1][1]
            if gap >= 1:
                questions.append({
                    'question': 'There appears to be a gap of about ' + str(gap) +
                                 ' year(s) between ' + str(parsed[i-1][1]) + ' and ' + str(parsed[i][0]) +
                                 '. Can you tell us about that period?',
                    'category': 'Career Gap',
                    'severity': 'medium'
                })

    # 7. Key responsibility probing
    resp_items = [r.value for r in reqs if r.req_type == 'responsibility'][:3]
    for r in resp_items:
        questions.append({
            'question': 'Can you describe a specific project where you handled: ' + r[:100] + '?',
            'category': 'Responsibilities',
            'severity': 'low'
        })

    # 8. Soft skills check
    questions.append({
        'question': 'How do you handle disagreements with team members on technical decisions?',
        'category': 'Soft Skills',
        'severity': 'low'
    })
    questions.append({
        'question': 'What is your expected CTC and are you open to negotiation?',
        'category': 'Compensation',
        'severity': 'medium'
    })

    return jsonify({
        'candidate_name': cu.full_name or cu.username,
        'jd_title': jd.title,
        'total': len(questions),
        'questions': questions
    })




# ============================================================
# TIER 1B - Personalized Interview Questions (for any candidate)
# Works for recruiter-uploaded candidates too, not just portal apps.
# ============================================================

@portal_bp.route('/recruiter/candidate-questions-by-id/<int:candidate_id>', methods=['GET'])
@login_required
def recruiter_candidate_questions_by_id(candidate_id):
    """Generate questions using a Candidate + optional latest JD match."""
    from models import Candidate as _Candidate, CandidateSkill as _CS

    c = _Candidate.query.get_or_404(candidate_id)

    # Try to find the JD this candidate was most recently screened for
    jd_id = request.args.get('jd_id', type=int)
    jd = None
    if jd_id:
        jd = JD.query.filter_by(id=jd_id, user_id=current_user.id).first()
    if not jd:
        # Fall back to the JD with the most recent screening result for this candidate
        sr = ScreeningResult.query.filter_by(candidate_id=c.id).order_by(
            ScreeningResult.created_at.desc()).first()
        if sr:
            jd = JD.query.filter_by(id=sr.jd_id, user_id=current_user.id).first()

    if not jd:
        return jsonify({
            'error': 'No JD associated with this candidate yet. '
                     'Screening the candidate against a JD first will enable '
                     'personalized questions.'
        }), 400

    # Load JD requirements
    reqs = JDRequirement.query.filter_by(jd_id=jd.id).all()
    required = [r.value for r in reqs if r.req_type == 'required_skill']
    preferred = [r.value for r in reqs if r.req_type == 'preferred_skill']

    # Candidate skills
    skills = [_CS.query.filter_by(candidate_id=c.id).first() and s.skill or s.skill
              for s in _CS.query.filter_by(candidate_id=c.id).all()]
    skills_text = ' '.join([s.lower() for s in skills if s])
    profile_text = ' '.join([
        skills_text,
        (c.education or '').lower(),
        (c.location or '').lower(),
        (c.current_designation or '').lower(),
    ])
    resume_text = c.raw_text or ''
    resume_low = resume_text.lower()

    def has_skill(skill):
        s_low = skill.lower()
        return s_low in resume_low or s_low in profile_text

    questions = []

    # Mandatory skills missing
    for s in required:
        if not has_skill(s):
            questions.append({
                'question': 'You did not mention ' + s + ' in your resume. Do you have any hands-on experience with it?',
                'category': 'Mandatory Skill Gap',
                'severity': 'high'
            })

    # Preferred skills missing
    for s in preferred:
        if not has_skill(s):
            questions.append({
                'question': 'Have you ever worked with ' + s + '? It is preferred for this role.',
                'category': 'Preferred Skill Gap',
                'severity': 'medium'
            })

    # Experience
    if jd.min_experience and (c.total_experience or 0) < jd.min_experience:
        questions.append({
            'question': 'The role requires ' + str(jd.min_experience) + '+ years. You have ' +
                         str(c.total_experience or 0) + ' years. Can you describe the depth of your experience?',
            'category': 'Experience',
            'severity': 'high'
        })

    # Location
    if jd.location and c.location and jd.location.lower() not in (c.location or '').lower():
        questions.append({
            'question': 'This role is based in ' + jd.location + '. You are currently in ' + c.location +
                         '. Would you be open to relocating or commuting?',
            'category': 'Location',
            'severity': 'medium'
        })

    # Notice period
    if jd.notice_period and 'immediate' in jd.notice_period.lower():
        questions.append({
            'question': 'How soon can you join? The role prefers an immediate joiner.',
            'category': 'Availability',
            'severity': 'medium'
        })

    # Career gap
    import re as _re
    from datetime import datetime as _dt
    year_ranges = _re.findall(r'(20\d{2})\s*[-to]+\s*(20\d{2}|present|current)', resume_text, _re.I)
    if len(year_ranges) >= 2:
        try:
            parsed = sorted((int(y1), _dt.now().year if y2.lower() in ('present','current') else int(y2))
                            for y1, y2 in year_ranges)
            for i in range(1, len(parsed)):
                gap = parsed[i][0] - parsed[i-1][1]
                if gap >= 1:
                    questions.append({
                        'question': 'There appears to be a gap of about ' + str(gap) +
                                     ' year(s) between ' + str(parsed[i-1][1]) + ' and ' + str(parsed[i][0]) +
                                     '. Can you tell us about that period?',
                        'category': 'Career Gap',
                        'severity': 'medium'
                    })
        except Exception:
            pass

    # Responsibilities
    resp_items = [r.value for r in reqs if r.req_type == 'responsibility'][:3]
    for r in resp_items:
        questions.append({
            'question': 'Can you describe a specific project where you handled: ' + r[:100] + '?',
            'category': 'Responsibilities',
            'severity': 'low'
        })

    # Soft skills & compensation
    questions.append({
        'question': 'How do you handle disagreements with team members on technical decisions?',
        'category': 'Soft Skills',
        'severity': 'low'
    })
    questions.append({
        'question': 'What is your expected CTC and are you open to negotiation?',
        'category': 'Compensation',
        'severity': 'medium'
    })

    return jsonify({
        'candidate_name': c.name or 'Candidate',
        'jd_title': jd.title,
        'jd_id': jd.id,
        'total': len(questions),
        'questions': questions
    })


# ============================================================
# FEATURE 4 - JD Performance Funnel
# ============================================================

@portal_bp.route('/recruiter/jd-funnel/<int:jd_id>', methods=['GET'])
@login_required
def jd_funnel(jd_id):
    jd = JD.query.filter_by(id=jd_id, user_id=current_user.id).first_or_404()

    apps = Application.query.filter_by(jd_id=jd_id).all()
    total = len(apps)

    stages = ['Applied', 'Under Review', 'Shortlisted', 'Interview Scheduled', 'Rejected']
    counts = {s: 0 for s in stages}
    for a in apps:
        if a.status in counts:
            counts[a.status] += 1

    results = ScreeningResult.query.filter_by(jd_id=jd_id).all()
    avg_score = round(sum(r.overall_score or 0 for r in results) / len(results), 1) if results else 0
    top_score = max([r.overall_score or 0 for r in results], default=0)

    reqs = JDRequirement.query.filter_by(jd_id=jd_id, req_type='required_skill').all()
    required = [r.value for r in reqs]
    skill_hits = []
    for skill in required:
        hits = 0
        for a in apps:
            cu = CandidateUser.query.get(a.candidate_user_id)
            if cu and cu.skills_summary and skill.lower() in cu.skills_summary.lower():
                hits += 1
        skill_hits.append({'skill': skill, 'have': hits, 'total': total})

    return jsonify({
        'jd': {'id': jd.id, 'title': jd.title, 'location': jd.location},
        'total_applications': total,
        'stages': counts,
        'avg_score': avg_score,
        'top_score': top_score,
        'required_skills_heatmap': skill_hits
    })


# ============================================================
# FEATURE 5 - Interview Scheduling
# ============================================================

@portal_bp.route('/recruiter/schedule-interview', methods=['POST'])
@login_required
def schedule_interview():
    data = request.get_json() or {}
    app_id = data.get('application_id')
    if not app_id:
        return jsonify({'error': 'application_id required'}), 400

    a = Application.query.get_or_404(app_id)
    jd = JD.query.get(a.jd_id)
    if not jd or jd.user_id != current_user.id:
        return jsonify({'error': 'Not authorized'}), 403

    from models import InterviewSchedule as _IS
    interview = _IS(
        application_id=app_id,
        scheduled_at=data.get('scheduled_at'),
        duration_minutes=data.get('duration_minutes', 30),
        mode=data.get('mode', 'Video'),
        meeting_link=data.get('meeting_link', ''),
        interviewer_name=data.get('interviewer_name', ''),
        notes=data.get('notes', '')
    )
    db.session.add(interview)

    a.status = 'Interview Scheduled'

    db.session.add(CandidateNotification(
        candidate_user_id=a.candidate_user_id,
        application_id=a.id,
        message='Interview scheduled for "' + jd.title + '" on ' + str(data.get('scheduled_at'))
    ))

    db.session.commit()

    # ===== FEATURE A - Send interview email =====
    cu = CandidateUser.query.get(a.candidate_user_id)
    email_status = 'skipped'
    if cu and cu.email:
        subject = 'Interview Scheduled: ' + jd.title
        body = (
            'Hi ' + (cu.full_name or cu.username) + ',\n\n'
            'Great news! An interview has been scheduled for you.\n\n'
            'Job: ' + jd.title + '\n'
            'Date & Time: ' + str(data.get('scheduled_at')) + '\n'
            'Duration: ' + str(data.get('duration_minutes', 30)) + ' minutes\n'
            'Mode: ' + str(data.get('mode', 'Video')) + '\n'
        )
        if data.get('meeting_link'):
            body += 'Meeting Link: ' + str(data.get('meeting_link')) + '\n'
        if data.get('interviewer_name'):
            body += 'Interviewer: ' + str(data.get('interviewer_name')) + '\n'
        if data.get('notes'):
            body += '\nNotes: ' + str(data.get('notes')) + '\n'
        body += '\nPlease log in to SmartHire AI for details.\n\nBest regards,\nSmartHire AI Team'

        ok, msg = send_email(cu.email, subject, body)
        email_status = 'sent' if ok else 'failed: ' + msg

    return jsonify({'message': 'Interview scheduled', 'id': interview.id, 'email_status': email_status}), 201


@portal_bp.route('/interview/my', methods=['GET'])
def my_interviews():
    user = _current_candidate()
    if not user:
        return jsonify([])
    my_apps = Application.query.filter_by(candidate_user_id=user.id).all()
    app_ids = [a.id for a in my_apps]
    if not app_ids:
        return jsonify([])

    from models import InterviewSchedule as _IS
    rows = _IS.query.filter(_IS.application_id.in_(app_ids)).order_by(_IS.scheduled_at.asc()).all()

    out = []
    for i in rows:
        a = Application.query.get(i.application_id)
        jd = JD.query.get(a.jd_id) if a else None
        out.append({
            'id': i.id,
            'scheduled_at': i.scheduled_at,
            'duration_minutes': i.duration_minutes,
            'mode': i.mode,
            'meeting_link': i.meeting_link,
            'interviewer_name': i.interviewer_name,
            'notes': i.notes,
            'status': i.status,
            'jd_title': jd.title if jd else '-'
        })
    return jsonify(out)


