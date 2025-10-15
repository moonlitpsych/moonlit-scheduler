// Hook for automatic audit logging when admin makes changes on behalf of provider

import { useEffect, useState } from 'react'
import { providerImpersonationManager } from '@/lib/provider-impersonation'
import { isAdminEmail } from '@/lib/admin-auth'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Database } from '@/types/database'

export function useAdminAudit() {
  const [isAdminViewing, setIsAdminViewing] = useState(false)
  const [currentProviderId, setCurrentProviderId] = useState<string | null>(null)
  const supabase = createClientComponentClient<Database>()

  useEffect(() => {
    checkAdminStatus()
  }, [])

  const checkAdminStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const isAdmin = isAdminEmail(user.email || '')
    const impersonation = providerImpersonationManager.getImpersonatedProvider()

    setIsAdminViewing(isAdmin && !!impersonation)
    setCurrentProviderId(impersonation?.provider.id || null)
  }

  /**
   * Log an admin action
   */
  const logAction = async (action: {
    actionType: string
    description: string
    tableName?: string
    recordId?: string
    changes?: any
  }) => {
    if (!isAdminViewing || !currentProviderId) return

    await providerImpersonationManager.logAdminAction({
      providerId: currentProviderId,
      ...action
    })
  }

  /**
   * Wrapper function to log before and after an action
   */
  const withAuditLog = async <T,>(
    actionType: string,
    actionDescription: string,
    actionFn: () => Promise<T>,
    options?: {
      tableName?: string
      recordId?: string
      getChanges?: (result: T) => any
    }
  ): Promise<T> => {
    const result = await actionFn()

    if (isAdminViewing && currentProviderId) {
      await logAction({
        actionType,
        description: actionDescription,
        tableName: options?.tableName,
        recordId: options?.recordId,
        changes: options?.getChanges ? options.getChanges(result) : undefined
      })
    }

    return result
  }

  return {
    isAdminViewing,
    currentProviderId,
    logAction,
    withAuditLog
  }
}
