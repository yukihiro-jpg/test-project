"""FastAPIアプリケーション"""

from __future__ import annotations

import shutil
from datetime import date
from io import BytesIO
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.responses import HTMLResponse, RedirectResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from yokin_chosa.config import InvestigationConfig
from yokin_chosa.investigation import DepositInvestigation
from yokin_chosa.models import (
    AccountType,
    BankAccount,
    Heir,
    HolderType,
    InvestigationCase,
    Transaction,
    VerificationResult,
)

# アプリケーション初期化
app = FastAPI(title="預金調査ツール")

BASE_DIR = Path(__file__).parent
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

# インメモリストレージ（デスクトップアプリなのでDB不要）
_cases: dict[str, InvestigationCase] = {}
_investigations: dict[str, DepositInvestigation] = {}
_transactions: dict[str, dict[str, list[Transaction]]] = {}  # case_id -> {acc_id -> txs}


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse(
        "index.html",
        {"request": request, "cases": list(_cases.values())},
    )


@app.post("/case/create")
async def create_case(
    request: Request,
    decedent_name: str = Form(...),
    date_of_death: str = Form(...),
    investigation_period_years: int = Form(5),
    threshold_amount: int = Form(500_000),
):
    form = await request.form()
    heir_names = form.getlist("heir_name[]")
    heir_relationships = form.getlist("heir_relationship[]")

    heirs = []
    for name, rel in zip(heir_names, heir_relationships):
        name = str(name).strip()
        rel = str(rel).strip()
        if name:
            heirs.append(Heir(name=name, relationship=rel))

    case = InvestigationCase(
        decedent_name=decedent_name,
        date_of_death=date.fromisoformat(date_of_death),
        investigation_period_years=investigation_period_years,
        threshold_amount=threshold_amount,
        heirs=heirs,
    )
    _cases[case.case_id] = case
    _transactions[case.case_id] = {}
    return RedirectResponse(f"/case/{case.case_id}/upload", status_code=303)


@app.get("/case/{case_id}/upload", response_class=HTMLResponse)
async def upload_page(request: Request, case_id: str):
    case = _cases.get(case_id)
    if not case:
        return RedirectResponse("/", status_code=303)

    tx_counts = {}
    for acc in case.accounts:
        txs = _transactions.get(case_id, {}).get(acc.id, [])
        tx_counts[acc.id] = len(txs)

    return templates.TemplateResponse(
        "upload.html",
        {
            "request": request,
            "case": case,
            "transaction_counts": tx_counts,
        },
    )


@app.post("/case/{case_id}/add-account")
async def add_account(
    case_id: str,
    bank_name: str = Form(...),
    branch_name: str = Form(""),
    account_type: str = Form("普通"),
    account_number: str = Form(...),
    account_holder: str = Form(...),
    holder_type: str = Form("被相続人"),
    pdf_file: UploadFile = File(...),
):
    case = _cases.get(case_id)
    if not case:
        return RedirectResponse("/", status_code=303)

    # 口座作成
    acc_type_map = {t.value: t for t in AccountType}
    holder_type_map = {t.value: t for t in HolderType}

    account = BankAccount(
        bank_name=bank_name,
        branch_name=branch_name,
        account_type=acc_type_map.get(account_type, AccountType.ORDINARY),
        account_number=account_number,
        account_holder=account_holder,
        holder_type=holder_type_map.get(holder_type, HolderType.DECEDENT),
    )
    case.accounts.append(account)

    # 相続人の口座を紐づけ
    if account.holder_type != HolderType.DECEDENT:
        for heir in case.heirs:
            if heir.name == account.account_holder:
                heir.accounts.append(account)
                break

    # PDFアップロード・解析
    upload_dir = Path("uploads") / case_id
    upload_dir.mkdir(parents=True, exist_ok=True)
    pdf_path = upload_dir / f"{account.id}.pdf"

    with open(pdf_path, "wb") as f:
        shutil.copyfileobj(pdf_file.file, f)

    # PDF解析
    try:
        from yokin_chosa.parsers.pdf_parser import extract_transactions_from_pdf
        txs = extract_transactions_from_pdf(pdf_path, account)
    except Exception:
        txs = []

    if case_id not in _transactions:
        _transactions[case_id] = {}
    _transactions[case_id][account.id] = txs

    return RedirectResponse(f"/case/{case_id}/upload", status_code=303)


@app.post("/case/{case_id}/remove-account/{account_id}")
async def remove_account(case_id: str, account_id: str):
    case = _cases.get(case_id)
    if case:
        case.accounts = [a for a in case.accounts if a.id != account_id]
        if case_id in _transactions and account_id in _transactions[case_id]:
            del _transactions[case_id][account_id]
    return RedirectResponse(f"/case/{case_id}/upload", status_code=303)


@app.post("/case/{case_id}/analyze")
async def analyze(case_id: str):
    case = _cases.get(case_id)
    if not case:
        return RedirectResponse("/", status_code=303)

    investigation = DepositInvestigation(case)

    # 取引データを読み込み
    for acc_id, txs in _transactions.get(case_id, {}).items():
        account = next((a for a in case.accounts if a.id == acc_id), None)
        if account:
            investigation.load_transactions_directly(account, txs)

    # 分析実行
    investigation.run_analysis()
    _investigations[case_id] = investigation

    return RedirectResponse(f"/case/{case_id}/review", status_code=303)


@app.get("/case/{case_id}/review", response_class=HTMLResponse)
async def review_page(request: Request, case_id: str):
    case = _cases.get(case_id)
    investigation = _investigations.get(case_id)
    if not case or not investigation:
        return RedirectResponse(f"/case/{case_id}/upload", status_code=303)

    from yokin_chosa.report.movement_table import generate_movement_table
    movement_df = generate_movement_table(case.accounts, investigation.flagged)

    return templates.TemplateResponse(
        "review.html",
        {
            "request": request,
            "case": case,
            "flagged": investigation.flagged,
            "movement_table": movement_df if not movement_df.empty else None,
            "nominal_findings": investigation.nominal_findings,
            "gift_tax_findings": investigation.gift_tax_findings,
        },
    )


@app.post("/case/{case_id}/update-verification")
async def update_verification(request: Request, case_id: str):
    investigation = _investigations.get(case_id)
    if not investigation:
        return RedirectResponse(f"/case/{case_id}/upload", status_code=303)

    form = await request.form()

    result_map = {v.value: v for v in VerificationResult}

    for f in investigation.flagged:
        result_key = f"result_{f.transaction.id}"
        note_key = f"note_{f.transaction.id}"

        if result_key in form:
            result_value = str(form[result_key])
            if result_value in result_map:
                f.verification_result = result_map[result_value]

        if note_key in form:
            f.notes = str(form[note_key])

    return RedirectResponse(f"/case/{case_id}/review", status_code=303)


@app.get("/case/{case_id}/download-excel")
async def download_excel(case_id: str):
    case = _cases.get(case_id)
    investigation = _investigations.get(case_id)
    if not case or not investigation:
        return RedirectResponse("/", status_code=303)

    output = BytesIO()
    investigation.generate_excel(output)
    output.seek(0)

    filename = f"預金調査_{case.decedent_name}_{case.date_of_death}.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{filename}"},
    )
