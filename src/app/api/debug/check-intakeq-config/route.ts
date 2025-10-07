/**
 * Debug endpoint to check IntakeQ API configuration
 */
import { NextResponse } from 'next/server'

export async function GET() {
    const apiKey = process.env.INTAKEQ_API_KEY

    return NextResponse.json({
        success: true,
        has_api_key: !!apiKey,
        api_key_length: apiKey?.length || 0,
        api_key_first_chars: apiKey?.substring(0, 8) + '...' || 'NOT_SET',
        all_env_keys: Object.keys(process.env).filter(k => k.includes('INTAKEQ')),
        note: apiKey
            ? 'IntakeQ API key is configured'
            : 'IntakeQ API key is MISSING from environment variables'
    })
}
