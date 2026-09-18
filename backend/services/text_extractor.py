import os
from PyPDF2 import PdfReader
from docx import Document


def extract_text(file_path):
    ext = os.path.splitext(file_path)[1].lower()
    if ext == '.pdf':
        return _pdf(file_path)
    if ext == '.docx':
        return _docx(file_path)
    if ext == '.doc':
        try:
            return _docx(file_path)
        except Exception:
            return ''
    if ext == '.txt':
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            return f.read()
    return ''


def _pdf(path):
    text = []
    reader = PdfReader(path)
    for page in reader.pages:
        try:
            text.append(page.extract_text() or '')
        except Exception:
            continue
    return '\n'.join(text)


def _docx(path):
    doc = Document(path)
    return '\n'.join(p.text for p in doc.paragraphs)
