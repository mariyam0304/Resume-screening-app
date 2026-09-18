from app import create_app
from extensions import db
from models import User

app = create_app()
with app.app_context():
    db.create_all()
    if not User.query.filter_by(username='admin').first():
        u = User(username='admin', email='admin@example.com')
        u.set_password('admin123')
        db.session.add(u)
        db.session.commit()
        print('Default user created: admin / admin123')
    else:
        print('Admin user already exists.')
    print('Database ready.')
