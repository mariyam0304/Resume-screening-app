"""
Creates Phase 1 tables in the database.
Safe to run multiple times.
"""
from app import create_app
from extensions import db
from models import CandidateUser, Application, CandidateNotification

app = create_app()
with app.app_context():
    db.create_all()
    print("Phase 1 tables ensured:")
    print("  - candidate_users")
    print("  - applications")
    print("  - candidate_notifications")
    print("Done.")
