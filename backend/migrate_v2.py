from app import create_app
from extensions import db
from sqlalchemy import text

app = create_app()
with app.app_context():
    db.create_all()
    cols = [
        ("ALTER TABLE candidates ADD COLUMN is_shortlisted TINYINT(1) DEFAULT 0", "is_shortlisted"),
        ("ALTER TABLE candidates ADD COLUMN rank_order INT DEFAULT 0", "rank_order"),
        ("ALTER TABLE jds ADD COLUMN is_template TINYINT(1) DEFAULT 0", "is_template"),
        ("ALTER TABLE jds ADD COLUMN template_category VARCHAR(80)", "template_category"),
    ]
    for sql, name in cols:
        try:
            db.session.execute(text(sql))
            db.session.commit()
            print("Added column: " + name)
        except Exception:
            db.session.rollback()
            print("Skipped (already exists): " + name)
    print("Migration done.")
