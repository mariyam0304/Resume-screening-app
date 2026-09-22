import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart


def smtp_configured():
    """Check whether SMTP credentials are present in env."""
    return all([
        os.getenv('SMTP_HOST'),
        os.getenv('SMTP_USER'),
        os.getenv('SMTP_PASSWORD'),
    ])


def send_email(to_email, subject, body):
    """
    Send email via SMTP. Supports safe dev redirect.
    Returns (success: bool, message: str).
    """
    if not smtp_configured():
        return False, 'SMTP not configured (simulation mode)'

    if not to_email:
        return False, 'No recipient email'

    # ===== SAFE DEV REDIRECT =====
    redirect = os.getenv('EMAIL_DEV_REDIRECT', '').strip()
    original_to = to_email
    if redirect:
        subject = '[DEV→' + original_to + '] ' + subject
        body = (
            '======================================\n'
            'DEV MODE — Email was redirected\n'
            'Original recipient: ' + original_to + '\n'
            '======================================\n\n'
        ) + body
        to_email = redirect

    try:
        host = os.getenv('SMTP_HOST')
        port = int(os.getenv('SMTP_PORT', '587'))
        user = os.getenv('SMTP_USER')
        pwd = os.getenv('SMTP_PASSWORD')
        from_name = os.getenv('SMTP_FROM_NAME', 'SmartHire AI')

        msg = MIMEMultipart()
        msg['From'] = from_name + ' <' + user + '>'
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'plain', 'utf-8'))

        with smtplib.SMTP(host, port, timeout=15) as server:
            server.starttls()
            server.login(user, pwd)
            server.send_message(msg)

        suffix = ' (redirected to ' + to_email + ')' if redirect else ''
        return True, 'Sent to ' + to_email + suffix
    except Exception as e:
        return False, str(e)
