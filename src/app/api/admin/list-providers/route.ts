// Helper endpoint to see all provider names
import { supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        const { data: providers, error } = await supabase
            .from('providers')
            .select('id, first_name, last_name, profile_image_url')
            .eq('is_active', true)
            .order('last_name')

        if (error) {
            return NextResponse.json({ success: false, error: error.message })
        }

        return NextResponse.json({
            success: true,
            providers: providers?.map(p => ({
                id: p.id,
                name: `${p.first_name} ${p.last_name}`,
                first_name: p.first_name,
                last_name: p.last_name,
                current_image: p.profile_image_url
            }))
        })

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message })
    }
}