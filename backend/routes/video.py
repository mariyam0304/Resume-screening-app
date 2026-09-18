import os
import uuid
from flask import Blueprint, request, jsonify, current_app, send_file, abort
from flask_login import login_required
from werkzeug.utils import secure_filename
from extensions import db
from models import Candidate, VideoInterview, VideoNote

video_bp = Blueprint('video', __name__)

ALLOWED_VIDEO = {'mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v'}
MAX_VIDEO_SIZE = 500 * 1024 * 1024  # 500 MB


def _video_dir(candidate_id):
    base = current_app.config['UPLOAD_FOLDER']
    d = os.path.join(base, 'interviews', str(candidate_id))
    os.makedirs(d, exist_ok=True)
    return d


def _ext(filename):
    return filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''


@video_bp.route('/candidate/<int:cid>', methods=['GET'])
@login_required
def list_videos(cid):
    rows = VideoInterview.query.filter_by(candidate_id=cid).order_by(VideoInterview.uploaded_at.desc()).all()
    return jsonify([{
        'id': v.id, 'title': v.title, 'round_label': v.round_label,
        'filename': v.filename, 'file_size': v.file_size,
        'duration': v.duration, 'rating': v.rating,
        'view_count': v.view_count, 'last_position': v.last_position,
        'uploaded_at': v.uploaded_at.isoformat() if v.uploaded_at else '',
        'notes_count': len(v.notes)
    } for v in rows])


@video_bp.route('/upload/<int:cid>', methods=['POST'])
@login_required
def upload_video(cid):
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400

    c = Candidate.query.get_or_404(cid)
    f = request.files['file']
    if not f.filename:
        return jsonify({'error': 'Empty filename'}), 400

    if _ext(f.filename) not in ALLOWED_VIDEO:
        return jsonify({'error': 'Unsupported format. Use MP4, WebM, MOV, MKV, AVI, M4V'}), 400

    title = request.form.get('title', '').strip() or f.filename
    round_label = request.form.get('round_label', 'Interview').strip()
    duration = float(request.form.get('duration', 0) or 0)

    safe = secure_filename(f.filename)
    unique = uuid.uuid4().hex[:8] + '_' + safe
    path = os.path.join(_video_dir(cid), unique)

    f.save(path)
    size = os.path.getsize(path)

    if size > MAX_VIDEO_SIZE:
        os.remove(path)
        return jsonify({'error': 'File exceeds 500MB limit'}), 400

    v = VideoInterview(
        candidate_id=cid, title=title, round_label=round_label,
        filename=safe, file_path=path, file_size=size, duration=duration
    )
    db.session.add(v)
    db.session.commit()
    return jsonify({'id': v.id, 'message': 'Uploaded'}), 201


@video_bp.route('/<int:vid>/stream')
@login_required
def stream_video(vid):
    v = VideoInterview.query.get_or_404(vid)
    if not os.path.exists(v.file_path):
        abort(404)
    # Increment view count
    v.view_count = (v.view_count or 0) + 1
    db.session.commit()
    return send_file(v.file_path, conditional=True)


@video_bp.route('/<int:vid>/download')
@login_required
def download_video(vid):
    v = VideoInterview.query.get_or_404(vid)
    if not os.path.exists(v.file_path):
        abort(404)
    return send_file(v.file_path, as_attachment=True, download_name=v.filename)


@video_bp.route('/<int:vid>/rate', methods=['POST'])
@login_required
def rate_video(vid):
    v = VideoInterview.query.get_or_404(vid)
    data = request.get_json() or {}
    rating = int(data.get('rating', 0))
    v.rating = max(0, min(5, rating))
    db.session.commit()
    return jsonify({'rating': v.rating})


@video_bp.route('/<int:vid>/position', methods=['POST'])
@login_required
def save_position(vid):
    v = VideoInterview.query.get_or_404(vid)
    data = request.get_json() or {}
    v.last_position = float(data.get('position', 0))
    db.session.commit()
    return jsonify({'ok': True})


@video_bp.route('/<int:vid>', methods=['DELETE'])
@login_required
def delete_video(vid):
    v = VideoInterview.query.get_or_404(vid)
    if v.file_path and os.path.exists(v.file_path):
        try: os.remove(v.file_path)
        except Exception: pass
    VideoNote.query.filter_by(video_id=vid).delete()
    db.session.delete(v)
    db.session.commit()
    return jsonify({'message': 'Deleted'})


@video_bp.route('/<int:vid>/notes', methods=['GET'])
@login_required
def list_notes(vid):
    rows = VideoNote.query.filter_by(video_id=vid).order_by(VideoNote.timestamp_sec.asc()).all()
    return jsonify([{
        'id': n.id, 'timestamp_sec': n.timestamp_sec, 'text': n.text,
        'created_at': n.created_at.isoformat()
    } for n in rows])


@video_bp.route('/<int:vid>/notes', methods=['POST'])
@login_required
def add_note(vid):
    VideoInterview.query.get_or_404(vid)
    data = request.get_json() or {}
    n = VideoNote(
        video_id=vid,
        timestamp_sec=float(data.get('timestamp_sec', 0)),
        text=data.get('text', '')
    )
    db.session.add(n)
    db.session.commit()
    return jsonify({'id': n.id})


@video_bp.route('/notes/<int:nid>', methods=['DELETE'])
@login_required
def delete_note(nid):
    n = VideoNote.query.get_or_404(nid)
    db.session.delete(n)
    db.session.commit()
    return jsonify({'message': 'Deleted'})
