import os
from flask import Flask, send_from_directory, jsonify
from flask_cors import CORS
from config import Config
from extensions import db, login_manager
from models import User
from routes import register_routes

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), '..', 'frontend')


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

    return app


if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, port=5000)
