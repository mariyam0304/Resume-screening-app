from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from extensions import db


class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), default='recruiter')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def set_password(self, pwd):
        self.password_hash = generate_password_hash(pwd)

    def check_password(self, pwd):
        return check_password_hash(self.password_hash, pwd)

    def get_id(self):
        return str(self.id)

    @property
    def is_authenticated(self):
        return True

    @property
    def is_anonymous(self):
        return False

    @property
    def is_active(self):
        return True


class JD(db.Model):
    __tablename__ = 'jds'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    title = db.Column(db.String(200))
    domain = db.Column(db.String(100))
    raw_text = db.Column(db.Text)
    location = db.Column(db.String(200))
    work_mode = db.Column(db.String(50))
    min_experience = db.Column(db.Float, default=0)
    max_experience = db.Column(db.Float, default=0)
    education = db.Column(db.String(200))
    salary = db.Column(db.String(120))
    notice_period = db.Column(db.String(80))
    employment_type = db.Column(db.String(80))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    requirements = db.relationship('JDRequirement', backref='jd', cascade='all, delete-orphan')


class JDRequirement(db.Model):
    __tablename__ = 'jd_requirements'
    id = db.Column(db.Integer, primary_key=True)
    jd_id = db.Column(db.Integer, db.ForeignKey('jds.id'))
    req_type = db.Column(db.String(30))
    value = db.Column(db.String(200))
    is_mandatory = db.Column(db.Boolean, default=False)


class Candidate(db.Model):
    __tablename__ = 'candidates'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150))
    email = db.Column(db.String(150))
    phone = db.Column(db.String(50))
    location = db.Column(db.String(150))
    total_experience = db.Column(db.Float, default=0)
    relevant_experience = db.Column(db.Float, default=0)
    current_company = db.Column(db.String(200))
    current_designation = db.Column(db.String(200))
    education = db.Column(db.String(300))
    notice_period = db.Column(db.String(80))
    expected_salary = db.Column(db.String(120))
    current_salary = db.Column(db.String(120))
    work_mode_compat = db.Column(db.String(80))
    raw_text = db.Column(db.Text)
    file_path = db.Column(db.String(500))
    file_hash = db.Column(db.String(64))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    skills = db.relationship('CandidateSkill', backref='candidate', cascade='all, delete-orphan')
    experiences = db.relationship('CandidateExperience', backref='candidate', cascade='all, delete-orphan')
    results = db.relationship('ScreeningResult', backref='candidate', cascade='all, delete-orphan')
    notes = db.relationship('RecruiterNote', backref='candidate', cascade='all, delete-orphan')
    status = db.relationship('CandidateStatus', backref='candidate', uselist=False, cascade='all, delete-orphan')


class CandidateSkill(db.Model):
    __tablename__ = 'candidate_skills'
    id = db.Column(db.Integer, primary_key=True)
    candidate_id = db.Column(db.Integer, db.ForeignKey('candidates.id'))
    skill = db.Column(db.String(120))
    category = db.Column(db.String(50))


class CandidateExperience(db.Model):
    __tablename__ = 'candidate_experience'
    id = db.Column(db.Integer, primary_key=True)
    candidate_id = db.Column(db.Integer, db.ForeignKey('candidates.id'))
    company = db.Column(db.String(200))
    designation = db.Column(db.String(200))
    start_date = db.Column(db.String(30))
    end_date = db.Column(db.String(30))
    duration_years = db.Column(db.Float, default=0)
    description = db.Column(db.Text)


class ScreeningResult(db.Model):
    __tablename__ = 'screening_results'
    id = db.Column(db.Integer, primary_key=True)
    jd_id = db.Column(db.Integer, db.ForeignKey('jds.id'))
    candidate_id = db.Column(db.Integer, db.ForeignKey('candidates.id'))
    overall_score = db.Column(db.Float, default=0)
    skills_score = db.Column(db.Float, default=0)
    experience_score = db.Column(db.Float, default=0)
    education_score = db.Column(db.Float, default=0)
    location_score = db.Column(db.Float, default=0)
    notice_score = db.Column(db.Float, default=0)
    domain_score = db.Column(db.Float, default=0)
    responsibility_score = db.Column(db.Float, default=0)
    preferred_skills_score = db.Column(db.Float, default=0)
    status = db.Column(db.String(30))
    explanation = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class ScreeningQuestion(db.Model):
    __tablename__ = 'screening_questions'
    id = db.Column(db.Integer, primary_key=True)
    jd_id = db.Column(db.Integer, db.ForeignKey('jds.id'))
    candidate_id = db.Column(db.Integer, db.ForeignKey('candidates.id'), nullable=True)
    question = db.Column(db.Text)
    category = db.Column(db.String(50))


class InterviewNote(db.Model):
    __tablename__ = 'interview_notes'
    id = db.Column(db.Integer, primary_key=True)
    candidate_id = db.Column(db.Integer, db.ForeignKey('candidates.id'))
    jd_id = db.Column(db.Integer, db.ForeignKey('jds.id'))
    question = db.Column(db.Text)
    answer = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class RecruiterNote(db.Model):
    __tablename__ = 'recruiter_notes'
    id = db.Column(db.Integer, primary_key=True)
    candidate_id = db.Column(db.Integer, db.ForeignKey('candidates.id'))
    note = db.Column(db.Text)
    follow_up_date = db.Column(db.String(30))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class CandidateStatus(db.Model):
    __tablename__ = 'candidate_status'
    id = db.Column(db.Integer, primary_key=True)
    candidate_id = db.Column(db.Integer, db.ForeignKey('candidates.id'), unique=True)
    status = db.Column(db.String(40), default='New')
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AuditLog(db.Model):
    __tablename__ = 'audit_logs'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    action = db.Column(db.String(200))
    details = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
