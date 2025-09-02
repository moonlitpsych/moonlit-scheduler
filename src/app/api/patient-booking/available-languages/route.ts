// src/app/api/patient-booking/available-languages/route.ts
import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    try {
        console.log('🔍 Environment variables check:')
        console.log('- NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing')
        console.log('- NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing')
        console.log('- SUPABASE_SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY ? '✅ Set' : '❌ Missing')
        console.log('✅ Supabase clients initialized')

        // Get all active, bookable providers with their languages
        const { data: providers, error } = await supabaseAdmin
            .from('providers')
            .select('languages_spoken')
            .eq('is_active', true)
            .eq('is_bookable', true)
            .not('languages_spoken', 'is', null)

        if (error) {
            console.error('❌ Error fetching provider languages:', error)
            return NextResponse.json(
                { success: false, error: 'Failed to fetch provider languages' },
                { status: 500 }
            )
        }

        // Extract and deduplicate languages
        const allLanguages = new Set<string>()
        
        providers?.forEach(provider => {
            if (provider.languages_spoken) {
                let languages: string[] = []
                
                // Handle different data types for languages_spoken
                if (Array.isArray(provider.languages_spoken)) {
                    languages = provider.languages_spoken
                } else if (typeof provider.languages_spoken === 'string') {
                    try {
                        languages = JSON.parse(provider.languages_spoken)
                    } catch {
                        languages = [provider.languages_spoken]
                    }
                }
                
                // Add each language to the set (removes duplicates)
                languages.forEach(lang => {
                    if (lang && lang.trim()) {
                        allLanguages.add(lang.trim())
                    }
                })
            }
        })

        // Convert set to sorted array, with English first
        const languageArray = Array.from(allLanguages).sort((a, b) => {
            if (a.toLowerCase() === 'english') return -1
            if (b.toLowerCase() === 'english') return 1
            return a.localeCompare(b)
        })

        console.log('✅ Found languages:', languageArray)

        return NextResponse.json({
            success: true,
            languages: languageArray,
            total_providers: providers?.length || 0
        })

    } catch (error) {
        console.error('❌ Unexpected error:', error)
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        )
    }
}