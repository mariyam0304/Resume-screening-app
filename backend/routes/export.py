import io
import csv
from flask import Blueprint, send_file
from flask_login import login_required
from openpyxl import Workbook
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from models import ScreeningResult, Candidate

export_bp = Blueprint('export', __name__)


def _rows(jd_id):
    rows = ScreeningResult.query.filter_by(jd_id=jd_id).order_by(ScreeningResult.overall_score.desc()).all()
    out = []
    for r in rows:
        c = Candidate.query.get(r.candidate_id)
        out.append({
            'Candidate': c.name, 'Email': c.email, 'Location': c.location,
            'Experience': c.total_experience, 'Notice': c.notice_period,
            'Match Score': r.overall_score, 'Status': r.status,
        })
    return out


@export_bp.route('/csv/<int:jd_id>')
@login_required
def export_csv(jd_id):
    data = _rows(jd_id)
    buf = io.StringIO()
    if data:
        writer = csv.DictWriter(buf, fieldnames=list(data[0].keys()))
        writer.writeheader()
        writer.writerows(data)
    mem = io.BytesIO(buf.getvalue().encode('utf-8'))
    mem.seek(0)
    return send_file(mem, mimetype='text/csv', as_attachment=True, download_name=f'screening_{jd_id}.csv')


@export_bp.route('/excel/<int:jd_id>')
@login_required
def export_excel(jd_id):
    data = _rows(jd_id)
    wb = Workbook()
    ws = wb.active
    ws.title = 'Screening'
    if data:
        ws.append(list(data[0].keys()))
        for row in data:
            ws.append(list(row.values()))
    mem = io.BytesIO()
    wb.save(mem)
    mem.seek(0)
    return send_file(mem, as_attachment=True, download_name=f'screening_{jd_id}.xlsx',
                     mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')


@export_bp.route('/pdf/<int:jd_id>')
@login_required
def export_pdf(jd_id):
    data = _rows(jd_id)
    mem = io.BytesIO()
    c = canvas.Canvas(mem, pagesize=A4)
    width, height = A4
    y = height - 40
    c.setFont('Helvetica-Bold', 14)
    c.drawString(40, y, f'SmartHire Screening Report - JD #{jd_id}')
    y -= 25
    c.setFont('Helvetica', 9)
    for row in data:
        line = f"{row['Candidate']} | {row['Match Score']}% | {row['Status']} | Exp: {row['Experience']}y | {row['Location']}"
        c.drawString(40, y, line[:110])
        y -= 14
        if y < 40:
            c.showPage()
            y = height - 40
            c.setFont('Helvetica', 9)
    c.save()
    mem.seek(0)
    return send_file(mem, as_attachment=True, download_name=f'screening_{jd_id}.pdf',
                     mimetype='application/pdf')
