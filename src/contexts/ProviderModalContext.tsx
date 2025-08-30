'use client'

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Provider } from '@/components/shared/ProviderCard'

interface ProviderModalContextType {
    isOpen: boolean
    provider: Provider | null
    openModal: (provider: Provider) => void
    closeModal: () => void
}

const ProviderModalContext = createContext<ProviderModalContextType | undefined>(undefined)

export function useProviderModal() {
    const context = useContext(ProviderModalContext)
    if (!context) {
        throw new Error('useProviderModal must be used within a ProviderModalProvider')
    }
    return context
}

interface ProviderModalProviderProps {
    children: ReactNode
}

export function ProviderModalProvider({ children }: ProviderModalProviderProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [provider, setProvider] = useState<Provider | null>(null)
    const router = useRouter()
    const searchParams = useSearchParams()

    // Generate URL slug from provider name
    const generateSlug = (provider: Provider) => {
        const name = `${provider.first_name}-${provider.last_name}`.toLowerCase()
        return name.replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
    }

    // Parse provider slug from URL
    const parseSlugToProvider = (slug: string): Provider | null => {
        // For now, we'll need to fetch the provider data
        // This is a placeholder - in a real implementation, we'd look up the provider by slug
        return null
    }

    // Open modal with URL update
    const openModal = (provider: Provider) => {
        setProvider(provider)
        setIsOpen(true)
        
        // Update URL with provider slug
        const slug = generateSlug(provider)
        const currentPath = window.location.pathname
        const currentQuery = new URLSearchParams(window.location.search)
        currentQuery.set('provider', slug)
        
        router.push(`${currentPath}?${currentQuery.toString()}`, { scroll: false })
    }

    // Close modal with URL cleanup
    const closeModal = () => {
        setIsOpen(false)
        setProvider(null)
        
        // Remove provider from URL
        const currentPath = window.location.pathname
        const currentQuery = new URLSearchParams(window.location.search)
        currentQuery.delete('provider')
        
        const newUrl = currentQuery.toString() 
            ? `${currentPath}?${currentQuery.toString()}`
            : currentPath
        
        router.push(newUrl, { scroll: false })
    }

    // Handle browser back button
    useEffect(() => {
        const handlePopState = () => {
            const providerSlug = searchParams.get('provider')
            if (!providerSlug && isOpen) {
                setIsOpen(false)
                setProvider(null)
            }
        }

        window.addEventListener('popstate', handlePopState)
        return () => window.removeEventListener('popstate', handlePopState)
    }, [isOpen, searchParams])

    // Handle initial URL state
    useEffect(() => {
        const providerSlug = searchParams.get('provider')
        if (providerSlug && !isOpen) {
            // In a real implementation, we'd fetch provider data by slug
            // For now, this is just the structure
            const foundProvider = parseSlugToProvider(providerSlug)
            if (foundProvider) {
                setProvider(foundProvider)
                setIsOpen(true)
            }
        }
    }, [searchParams, isOpen])

    // ESC key handler
    useEffect(() => {
        const handleEscKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && isOpen) {
                closeModal()
            }
        }

        if (isOpen) {
            document.addEventListener('keydown', handleEscKey)
        }

        return () => {
            document.removeEventListener('keydown', handleEscKey)
        }
    }, [isOpen])

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = 'unset'
        }

        return () => {
            document.body.style.overflow = 'unset'
        }
    }, [isOpen])

    const value: ProviderModalContextType = {
        isOpen,
        provider,
        openModal,
        closeModal
    }

    return (
        <ProviderModalContext.Provider value={value}>
            {children}
        </ProviderModalContext.Provider>
    )
}