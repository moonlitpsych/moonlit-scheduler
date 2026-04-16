import { google, sheets_v4 } from 'googleapis'
import fs from 'fs'
import path from 'path'

/**
 * Google Sheets client for reading the Moonlit P&L spreadsheet.
 * Reuses the same service account credentials as moonlit-rcm.
 *
 * Env vars (one of):
 *   GOOGLE_SHEETS_CREDENTIALS_JSON — service account JSON (stringified; required on Vercel)
 *   GOOGLE_SHEETS_CREDENTIALS_FILE — path to credentials file (local dev)
 * Plus:
 *   GOOGLE_SHEETS_SPREADSHEET_ID   — P&L spreadsheet id
 */
class GoogleSheetsClient {
  private sheets: sheets_v4.Sheets | null = null

  private get spreadsheetId(): string {
    return process.env.GOOGLE_SHEETS_SPREADSHEET_ID || ''
  }

  private async getClient(): Promise<sheets_v4.Sheets> {
    if (this.sheets) return this.sheets

    let credentials: object
    // Prefer credentials file for local dev (env var from Vercel can have escaping issues)
    const credentialsPath = process.env.GOOGLE_SHEETS_CREDENTIALS_FILE || './google-sheets-credentials.json'
    const abs = path.resolve(process.cwd(), credentialsPath)

    if (fs.existsSync(abs)) {
      credentials = JSON.parse(fs.readFileSync(abs, 'utf8'))
    } else {
      const credentialsJson = process.env.GOOGLE_SHEETS_CREDENTIALS_JSON
      if (!credentialsJson) {
        throw new Error(
          `Google Sheets credentials not configured. Set GOOGLE_SHEETS_CREDENTIALS_JSON (Vercel) or place the credentials file at: ${abs}`
        )
      }
      // Handle escaped newlines from Vercel env vars
      const unescaped = credentialsJson.replace(/\\n/g, '\n')
      credentials = JSON.parse(unescaped)
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    })

    this.sheets = google.sheets({ version: 'v4', auth })
    return this.sheets
  }

  async readRange(range: string): Promise<any[][]> {
    const sheets = await this.getClient()
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range,
    })
    return response.data.values || []
  }

  async readSheetAsObjects(sheetName: string): Promise<Record<string, any>[]> {
    const rows = await this.readRange(sheetName)
    if (rows.length < 2) return []

    const headers = rows[0].map((h: string) => h?.toString().trim() || '')
    const data: Record<string, any>[] = []

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      const obj: Record<string, any> = {}
      for (let j = 0; j < headers.length; j++) {
        if (headers[j]) obj[headers[j]] = row[j] ?? ''
      }
      if (Object.values(obj).some(v => v !== '')) data.push(obj)
    }
    return data
  }
}

export const googleSheetsClient = new GoogleSheetsClient()
