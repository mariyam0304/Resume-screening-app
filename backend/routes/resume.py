import os
import hashlib
from flask import Blueprint, request, jsonify, current_app, send_file
from flask_login import login_required,current_user
from werkzeug.utils import secure_filename
from extensions import db
from models import Candidate, CandidateSkill, CandidateExperience, CandidateStatus
from services.text_extractor import extract_text
from services.resume_parser import parse_resume
from services.duplicate_detector import is_duplicate

resume_bp = Blueprint('resume', __name__)


def _allowed(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in current_app.config['ALLOWED_EXTENSIONS']


def _hash_file(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            h.update(chunk)
    return h.hexdigest()


@resume_bp.route('/upload', methods=['POST'])
@login_required
def upload_resumes():
    if 'files' not in request.files:
        return jsonify({'error': 'No files uploaded'}), 400

    files = request.files.getlist('files')
    uploaded, duplicates, errors = [], [], []

    existing_hashes = {c.file_hash for c in Candidate.query.all() if c.file_hash}
    upload_dir = current_app.config['UPLOAD_FOLDER']
    os.makedirs(upload_dir, exist_ok=True)

    for f in files:
        if not f.filename or not _allowed(f.filename):
            errors.append({'file': f.filename, 'error': 'Unsupported file type'})
            continue
        safe_name = secure_filename(f.filename)
        path = os.path.join(upload_dir, safe_name)
        base, ext = os.path.splitext(path)
        i = 1
        while os.path.exists(path):
            path = f"{base}_{i}{ext}"
            i += 1
        f.save(path)

        fhash = _hash_file(path)
        if is_duplicate(fhash, existing_hashes):
            duplicates.append({'file': safe_name, 'warning': 'Possible duplicate candidate detected.'})
            continue
        existing_hashes.add(fhash)

        text = extract_text(path)
        parsed = parse_resume(text)

        cand = Candidate(
            owner_user_id=current_user.id,
            name=parsed['name'], email=parsed['email'], phone=parsed['phone'],
            location=parsed['location'], total_experience=parsed['total_experience'],
            relevant_experience=parsed['relevant_experience'],
            current_company=parsed['current_company'], current_designation=parsed['current_designation'],
            education=parsed['education'], notice_period=parsed['notice_period'],
            expected_salary=parsed['expected_salary'], current_salary=parsed['current_salary'],
            work_mode_compat=parsed['work_mode_compat'], raw_text=text,
            file_path=path, file_hash=fhash
        )
        db.session.add(cand)
        db.session.flush()

        for s in parsed['skills']:
            db.session.add(CandidateSkill(candidate_id=cand.id, skill=s))
        for ex in parsed['experiences']:
            db.session.add(CandidateExperience(
                candidate_id=cand.id, company=ex.get('company'),
                designation=ex.get('designation'), start_date=ex.get('start_date'),
                end_date=ex.get('end_date'), duration_years=ex.get('duration_years', 0),
                description=ex.get('description', '')
            ))
        db.session.add(CandidateStatus(candidate_id=cand.id, status='New'))

        uploaded.append({'id': cand.id, 'name': cand.name, 'file': safe_name})

    db.session.commit()
    return jsonify({'uploaded': uploaded, 'duplicates': duplicates, 'errors': errors})


@resume_bp.route('/<int:candidate_id>/download')
@login_required
def download_resume(candidate_id):
    c = Candidate.query.get_or_404(candidate_id)
    if not c.file_path or not os.path.exists(c.file_path):
        return jsonify({'error': 'File not found'}), 404
    return send_file(c.file_path, as_attachment=True)


@resume_bp.route('/<int:candidate_id>/preview')
@login_required
def preview_resume(candidate_id):
    c = Candidate.query.get_or_404(candidate_id)
    if not c.file_path or not os.path.exists(c.file_path):
        return jsonify({'error': 'File not found'}), 404
    # Serve inline (not as attachment) for browsers that support it
    return send_file(c.file_path, as_attachment=False)
