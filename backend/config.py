import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'smarthire-dev-secret-change-me')
    SQLALCHEMY_DATABASE_URI = os.getenv(
        'DATABASE_URL',
        'mysql+pymysql://root:password@localhost/smarthire_db'
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    UPLOAD_FOLDER = os.getenv('UPLOAD_FOLDER', 'uploads')
    MAX_CONTENT_LENGTH = 10 * 1024 * 1024
    ALLOWED_EXTENSIONS = {'pdf', 'docx', 'doc', 'txt'}
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
