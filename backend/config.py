import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'smarthire-dev-secret-change-me')

    SQLALCHEMY_DATABASE_URI = (
        os.getenv('MYSQL_URL') or
        os.getenv('DATABASE_URL') or
        'mysql+pymysql://root:password@localhost/smarthire_db'
    )

    SQLALCHEMY_TRACK_MODIFICATIONS = False
    UPLOAD_FOLDER = os.getenv('UPLOAD_FOLDER', 'uploads')
    MAX_CONTENT_LENGTH = 100 * 1024 * 1024
    ALLOWED_EXTENSIONS = {'pdf', 'docx', 'doc', 'txt'}

    # ---------- SSL for cloud MySQL (Aiven) ----------
    # Only enable SSL when we're NOT connecting to localhost.
    _ca_path = os.path.join(os.path.dirname(__file__), 'ca.pem')
    _is_remote = 'localhost' not in SQLALCHEMY_DATABASE_URI and '127.0.0.1' not in SQLALCHEMY_DATABASE_URI

    SQLALCHEMY_ENGINE_OPTIONS = (
        {"connect_args": {"ssl_ca": _ca_path}}
        if (_is_remote and os.path.exists(_ca_path))
        else {}
    )

    DEFAULT_WEIGHTS = {
        'skills': 0.30,
        'experience': 0.20,
        'responsibilities': 0.15,
        'domain': 0.10,
        'preferred_skills': 0.10,
        'education': 0.05,
        'location': 0.05,
        'notice': 0.05,
    }