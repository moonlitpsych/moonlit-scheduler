import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const query = searchParams.get('query')

        if (!query || query.trim() === '') {
            // Return top 20 most-used focus areas
            const { data: topFocus, error } = await supabaseAdmin
                .from('focus_areas')
                .select(`
                    id,
                    slug,
                    name,
                    focus_type
                `)
                .eq('is_active', true)
                .order('name', { ascending: true })
                .limit(20)

            if (error) {
                console.error('❌ Error fetching top focus areas:', error)
                return NextResponse.json(
                    { success: false, error: 'Failed to fetch focus areas', details: error },
                    { status: 500 }
                )
            }

            return NextResponse.json({
                success: true,
                data: topFocus?.map(area => ({
                    id: area.id,
                    slug: area.slug,
                    name: area.name,
                    type: area.focus_type
                })) || []
            })
        } else {
            // Perform ranked search using tsvector + ILIKE + trigram
            const sanitizedQuery = query.trim()
            
            const { data: searchResults, error } = await supabaseAdmin
                .rpc('search_focus_areas', {
                    search_query: sanitizedQuery
                })

            if (error) {
                console.error('❌ Error searching focus areas:', error)
                // Fallback to simple ILIKE search
                const { data: fallbackResults, error: fallbackError } = await supabaseAdmin
                    .from('focus_areas')
                    .select('id, slug, name, focus_type')
                    .eq('is_active', true)
                    .or(`name.ilike.%${sanitizedQuery}%,synonyms.cs.{${sanitizedQuery}}`)
                    .limit(10)

                if (fallbackError) {
                    console.error('❌ Error with fallback search:', fallbackError)
                    return NextResponse.json(
                        { success: false, error: 'Failed to search focus areas', details: fallbackError },
                        { status: 500 }
                    )
                }

                return NextResponse.json({
                    success: true,
                    data: fallbackResults?.map(area => ({
                        id: area.id,
                        slug: area.slug,
                        name: area.name,
                        type: area.focus_type
                    })) || []
                })
            }

            return NextResponse.json({
                success: true,
                data: searchResults?.map((area: any) => ({
                    id: area.id,
                    slug: area.slug,
                    name: area.name,
                    type: area.focus_type
                })) || []
            })
        }

    } catch (error: any) {
        console.error('❌ Error in focus areas API:', error)
        return NextResponse.json(
            { 
                success: false, 
                error: 'Failed to fetch focus areas', 
                details: error.message 
            },
            { status: 500 }
        )
    }
}