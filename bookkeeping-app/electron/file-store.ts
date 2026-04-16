import fs from 'fs'
import path from 'path'
import type { AppConfig, CashLedgerMonth, BankBookMonth, BankAccount, SuggestionData } from '../src/app/lib/types'

/**
 * ローカルファイルベースのデータストア
 * JSONファイルでデスクトップの会計ソフトフォルダにデータを保存
 */
export class FileStore {
  private dataDir: string

  constructor(dataDir: string) {
    this.dataDir = dataDir
  }

  // ===== ディレクトリ管理 =====

  private ensureDir(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }
  }

  private get configPath(): string {
    return path.join(this.dataDir, 'config.json')
  }

  private get bankAccountsPath(): string {
    return path.join(this.dataDir, 'bank-accounts.json')
  }

  private get suggestionsPath(): string {
    return path.join(this.dataDir, 'suggestions.json')
  }

  private cashDir(): string {
    const dir = path.join(this.dataDir, 'cash')
    this.ensureDir(dir)
    return dir
  }

  private bankDir(accountId: string): string {
    const dir = path.join(this.dataDir, 'bank', accountId)
    this.ensureDir(dir)
    return dir
  }

  getExportsDir(): string {
    const dir = path.join(this.dataDir, 'exports')
    this.ensureDir(dir)
    return dir
  }

  // ===== 汎用読み書き =====

  private readJson<T>(filePath: string): T | null {
    try {
      if (!fs.existsSync(filePath)) return null
      const raw = fs.readFileSync(filePath, 'utf-8')
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  }

  private writeJson(filePath: string, data: unknown): void {
    const dir = path.dirname(filePath)
    this.ensureDir(dir)
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
  }

  // ===== Config =====

  hasConfig(): boolean {
    return fs.existsSync(this.configPath)
  }

  readConfig(): AppConfig | null {
    return this.readJson<AppConfig>(this.configPath)
  }

  saveConfig(config: AppConfig): void {
    this.dataDir = config.dataFolder
    this.writeJson(this.configPath, config)
  }

  // ===== 現金出納帳 =====

  readCashMonth(month: string): CashLedgerMonth | null {
    const filePath = path.join(this.cashDir(), `${month}.json`)
    return this.readJson<CashLedgerMonth>(filePath)
  }

  saveCashMonth(data: CashLedgerMonth): void {
    const filePath = path.join(this.cashDir(), `${data.month}.json`)
    this.writeJson(filePath, data)
  }

  listCashMonths(): string[] {
    const dir = this.cashDir()
    try {
      return fs.readdirSync(dir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.replace('.json', ''))
        .sort()
    } catch {
      return []
    }
  }

  // ===== 通帳記録 =====

  readBankMonth(accountId: string, month: string): BankBookMonth | null {
    const filePath = path.join(this.bankDir(accountId), `${month}.json`)
    return this.readJson<BankBookMonth>(filePath)
  }

  saveBankMonth(data: BankBookMonth): void {
    const filePath = path.join(this.bankDir(data.accountId), `${data.month}.json`)
    this.writeJson(filePath, data)
  }

  listBankMonths(accountId: string): string[] {
    const dir = this.bankDir(accountId)
    try {
      return fs.readdirSync(dir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.replace('.json', ''))
        .sort()
    } catch {
      return []
    }
  }

  // ===== 口座マスタ =====

  readBankAccounts(): BankAccount[] {
    return this.readJson<BankAccount[]>(this.bankAccountsPath) || []
  }

  saveBankAccounts(accounts: BankAccount[]): void {
    this.writeJson(this.bankAccountsPath, accounts)
  }

  // ===== 推測入力学習データ =====

  readSuggestions(): SuggestionData {
    return this.readJson<SuggestionData>(this.suggestionsPath) || {
      counterpartyMap: {},
      descriptionToType: {},
    }
  }

  saveSuggestions(data: SuggestionData): void {
    this.writeJson(this.suggestionsPath, data)
  }
}
