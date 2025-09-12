// src/app/api/debug/intakeq-status/route.ts
// Debug endpoint to monitor IntakeQ rate limiting and cache status

import { NextResponse } from 'next/server'
import { intakeQService } from '@/lib/services/intakeQService'
import { intakeQRateLimiter } from '@/lib/services/rateLimiter'
import { intakeQCache } from '@/lib/services/intakeQCache'

export async function GET() {
  try {
    // Get comprehensive status from all systems
    const serviceStatus = intakeQService.getRateLimitStatus()
    const rateLimiterStatus = intakeQRateLimiter.getStatus()
    const cacheStats = intakeQCache.getStats()

    // Calculate some derived metrics
    const tokenRefillRate = Math.round((8 / 60) * 10) / 10 // tokens per second
    const estimatedWaitTime = rateLimiterStatus.tokens > 0 ? 0 : Math.ceil((1 - rateLimiterStatus.tokens) / tokenRefillRate)
    
    const systemHealth = {
      overall: 'healthy',
      issues: [] as string[]
    }

    // Health checks
    if (rateLimiterStatus.queueLength > 20) {
      systemHealth.issues.push(`High queue length: ${rateLimiterStatus.queueLength}`)
      systemHealth.overall = 'degraded'
    }

    if (rateLimiterStatus.tokens < 1 && rateLimiterStatus.queueLength > 5) {
      systemHealth.issues.push('No tokens available with queued requests')
      systemHealth.overall = 'degraded'
    }

    if (cacheStats.expiredEntries > 10) {
      systemHealth.issues.push(`Many expired cache entries: ${cacheStats.expiredEntries}`)
    }

    // Performance metrics
    const cacheHitRate = cacheStats.size > 0 
      ? Math.round(((cacheStats.size - cacheStats.expiredEntries) / cacheStats.size) * 100)
      : 0

    const response = {
      timestamp: new Date().toISOString(),
      system_health: systemHealth,
      
      // Legacy service counters (for backward compatibility)
      legacy_service: {
        requests_this_minute: serviceStatus.requestsThisMinute,
        requests_today: serviceStatus.requestsToday
      },
      
      // Production rate limiter status
      rate_limiter: {
        tokens_available: rateLimiterStatus.tokens,
        max_tokens: rateLimiterStatus.maxTokens,
        token_percentage: Math.round((rateLimiterStatus.tokens / rateLimiterStatus.maxTokens) * 100),
        queue_length: rateLimiterStatus.queueLength,
        active_requests: rateLimiterStatus.activeRequests,
        is_processing: rateLimiterStatus.isProcessing,
        estimated_wait_seconds: estimatedWaitTime
      },
      
      // Cache performance
      cache: {
        total_entries: cacheStats.size,
        expired_entries: cacheStats.expiredEntries,
        valid_entries: cacheStats.size - cacheStats.expiredEntries,
        cache_hit_rate_percent: cacheHitRate,
        oldest_entry_age_minutes: cacheStats.oldestEntryAge ? Math.round(cacheStats.oldestEntryAge / 60000) : null,
        newest_entry_age_minutes: cacheStats.newestEntryAge ? Math.round(cacheStats.newestEntryAge / 60000) : null
      },
      
      // Performance recommendations
      recommendations: generateRecommendations(rateLimiterStatus, cacheStats, systemHealth),
      
      // Configuration info
      config: {
        rate_limit_rpm: 8,
        max_concurrent: 2,
        cache_ttl_minutes: 10,
        queue_max_size: 30
      }
    }

    return NextResponse.json({
      success: true,
      data: response
    })

  } catch (error: any) {
    console.error('❌ Error getting IntakeQ status:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get IntakeQ status',
        details: error.message 
      },
      { status: 500 }
    )
  }
}

function generateRecommendations(
  rateLimiter: any, 
  cache: any, 
  health: any
): string[] {
  const recommendations: string[] = []

  if (health.overall === 'healthy') {
    recommendations.push('✅ All systems operating normally')
  }

  if (rateLimiter.tokens < 2) {
    recommendations.push('⚠️ Low token count - requests may be queued')
  }

  if (rateLimiter.queueLength > 10) {
    recommendations.push('🚦 High queue length - consider reducing concurrent operations')
  }

  if (rateLimiter.queueLength === 0 && rateLimiter.tokens > 5) {
    recommendations.push('🚀 Good capacity available - optimal performance')
  }

  if (cache.size < 5) {
    recommendations.push('💾 Cache warming up - performance will improve with more requests')
  }

  if (cache.expiredEntries > cache.size * 0.3) {
    recommendations.push('🧹 Many expired cache entries - cleanup recommended')
  }

  const cacheHitRate = cache.size > 0 
    ? Math.round(((cache.size - cache.expiredEntries) / cache.size) * 100)
    : 0
  
  if (cacheHitRate > 70) {
    recommendations.push('🎯 Excellent cache performance - reducing API load effectively')
  } else if (cacheHitRate > 40) {
    recommendations.push('📊 Good cache performance - some requests being cached')
  } else if (cache.size > 0) {
    recommendations.push('📉 Low cache hit rate - may need longer TTL or better caching strategy')
  }

  return recommendations
}