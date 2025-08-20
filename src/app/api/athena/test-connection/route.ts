// src/app/api/athena/test-connection/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { athenaService } from '@/lib/services/athenaService'

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing Athena connection via API...')

    const result = await athenaService.testConnection()

    return NextResponse.json({
      success: result.success,
      timestamp: new Date().toISOString(),
      athena_connection: result.success ? 'connected' : 'failed',
      ...result
    })

  } catch (error: any) {
    console.error('❌ Athena connection test failed:', error)
    
    return NextResponse.json(
      { 
        success: false,
        athena_connection: 'failed',
        error: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json()

    switch (action) {
      case 'sync-providers':
        console.log('🔄 Starting provider sync...')
        const syncResult = await athenaService.syncProviders()
        
        return NextResponse.json({
          success: true,
          action: 'sync-providers',
          result: syncResult,
          timestamp: new Date().toISOString()
        })

      case 'get-providers':
        console.log('👥 Fetching providers from Athena...')
        const providers = await athenaService.getProviders()
        
        return NextResponse.json({
          success: true,
          action: 'get-providers',
          providers: providers.slice(0, 10), // Limit for API response
          total_count: providers.length,
          timestamp: new Date().toISOString()
        })

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }

  } catch (error: any) {
    console.error('❌ Athena API action failed:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}