import os
from flask import Flask, send_from_directory, jsonify
from flask_cors import CORS
from config import Config
from extensions import db, login_manager
from models import User
from routes import register_routes

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), '..', 'frontend')



def bootstrap_database(app):
    """Create tables and default admin user on first run.
    Safe to run multiple times — idempotent."""
    import os
    from extensions import db
    from models import User

    with app.app_context():
        try:
            db.create_all()
            print('[bootstrap] Tables ensured.')

            admin_username = os.getenv('ADMIN_USERNAME', 'admin')
            admin_password = os.getenv('ADMIN_PASSWORD', 'admin123')
            admin_email = os.getenv('ADMIN_EMAIL', 'admin@example.com')

            existing = User.query.filter_by(username=admin_username).first()
            if not existing:
                u = User(username=admin_username, email=admin_email)
                u.set_password(admin_password)
                db.session.add(u)
                db.session.commit()
                print('[bootstrap] Admin user created: ' + admin_username)
            else:
                print('[bootstrap] Admin user already exists: ' + admin_username)
        except Exception as e:
            print('[bootstrap] ERROR: ' + str(e))
            import traceback
            traceback.print_exc()

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    CORS(app, supports_credentials=True)

    db.init_app(app)
    login_manager.init_app(app)

    @login_manager.user_loader
    def load_user(uid):
        return User.query.get(int(uid))

    @login_manager.unauthorized_handler
    def unauthorized():
        return jsonify({'error': 'Authentication required'}), 401

    register_routes(app)
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    @app.route('/')
    def index():
        return send_from_directory(FRONTEND_DIR, 'index.html')

    @app.route('/<path:path>')
    def static_files(path):
        full = os.path.join(FRONTEND_DIR, path)
        if os.path.exists(full):
            return send_from_directory(FRONTEND_DIR, path)
        return send_from_directory(FRONTEND_DIR, 'index.html')


    @app.route('/setup-admin-xyz789', methods=['GET'])
    def setup_admin():
        """One-time endpoint to create admin user. Remove after use."""
        from extensions import db
        from models import User
        try:
            db.create_all()
            existing = User.query.filter_by(username='admin').first()
            if existing:
                return jsonify({'status': 'exists', 'message': 'Admin already exists'})
            u = User(username='admin', email='admin@example.com')
            u.set_password('admin123')
            db.session.add(u)
            db.session.commit()
            return jsonify({'status': 'created', 'message': 'Admin user created'})
        except Exception as e:
            import traceback
            return jsonify({'status': 'error', 'error': str(e), 'trace': traceback.format_exc()}), 500
    return app


# Module-level app instance (needed for gunicorn)
app = create_app()
bootstrap_database(app)


if __name__ == '__main__':
    import os
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)



