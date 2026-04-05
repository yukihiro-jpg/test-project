"""メール通知モジュール"""
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime

logger = logging.getLogger(__name__)

SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587


def send_email(sender_email, sender_password, to_email, subject, body):
    msg = MIMEMultipart()
    msg["From"] = sender_email
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain", "utf-8"))
    try:
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(sender_email, sender_password)
            server.send_message(msg)
        logger.info(f"メール送信完了: {subject}")
    except Exception as e:
        logger.error(f"メール送信エラー: {e}")
        raise


def format_daily_report(report_date, client_data, errors=None):
    subject = f"【日下部税理士事務所】ファイル同期レポート {report_date}"
    lines = [
        f"ファイル同期レポート（{report_date}）",
        f"集計対象: 前日24時までのアップロード",
        "", "=" * 50,
    ]
    has_activity = False
    for client_name, operations in sorted(client_data.items()):
        lines.append(f"\n■ {client_name}")
        uploads = [op for op in operations if op["operation"] in ("upload", "update_upload")]
        downloads_by_acct = [op for op in operations if op["operation"] == "download"]
        if uploads:
            has_activity = True
            lines.append("  【顧問先からのアップロード】")
            for op in uploads:
                size_kb = op["size_bytes"] / 1024
                ts = _format_time(op["timestamp"])
                action = "更新" if op["operation"] == "update_upload" else "新規"
                lines.append(f"    - {op['file_path']} ({size_kb:.0f}KB) [{action}] {ts}")
        else:
            lines.append("  【顧問先からのアップロード】なし")
        if downloads_by_acct:
            has_activity = True
            lines.append("  【税理士から顧問先への送付】")
            for op in downloads_by_acct:
                size_kb = op["size_bytes"] / 1024
                ts = _format_time(op["timestamp"])
                lines.append(f"    - {op['file_path']} ({size_kb:.0f}KB) {ts}")
    if not has_activity:
        lines.append("\n本日のファイル操作はありませんでした。")
    lines.extend(["", "=" * 50])
    if errors:
        lines.append("\n[!] 同期エラー:")
        for err in errors:
            lines.append(f"  - {err}")
    else:
        lines.append("\n同期エラー: なし")
    lines.extend(["", "---", "日下部税理士事務所 ファイル同期システム"])
    return subject, "\n".join(lines)


def _format_time(iso_timestamp):
    try:
        dt = datetime.fromisoformat(iso_timestamp.replace("Z", "+00:00"))
        return dt.astimezone().strftime("%H:%M")
    except (ValueError, AttributeError):
        return ""
