// Temporary admin endpoint to update provider profile images
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST() {
    try {
        // Map image filenames to exact provider IDs from database
        const imageMapping = [
            { 
                providerId: '504d53c6-54ef-40b0-81d4-80812c2c7bfd', // Anthony Privratsky
                imagePath: '/images/providers/Anthony-Privratsky-removebg-preview.png' 
            },
            { 
                providerId: '19efc9c8-3950-45c4-be1d-f0e04615e0d1', // Tatiana Kaehler  
                imagePath: '/images/providers/Tati-removebg-preview.png' 
            },
            { 
                providerId: '9b093465-e514-4d9f-8c45-22dcd0eb1811', // Doug Sirutis
                imagePath: '/images/providers/douglas-sirutis-removebg-preview.png' 
            },
            { 
                providerId: 'bc0fc904-7cc9-4d22-a094-6a0eb482128d', // Merrick Reynolds
                imagePath: '/images/providers/merrick-reynolds-removebg-preview.png' 
            },
            { 
                providerId: '1f28a0e5-ead8-4ae0-8d3e-f6d0680558b8', // Mitchell Allen
                imagePath: '/images/providers/mitchell-allen-removebg-preview.png' 
            },
            { 
                providerId: '3f33224b-e485-46cc-a2f2-99beb139cbef', // C. Rufus Sweeney (assuming this is the main one)
                imagePath: '/images/providers/sweeney-removebg-preview.png' 
            },
            { 
                providerId: '35ab086b-2894-446d-9ab5-3d41613017ad', // Travis Norseth
                imagePath: '/images/providers/travis-norseth-removebg-preview.png' 
            }
        ]

        const results = []

        for (const mapping of imageMapping) {
            // Get provider info first
            const { data: provider, error: fetchError } = await supabaseAdmin
                .from('providers')
                .select('id, first_name, last_name, profile_image_url')
                .eq('id', mapping.providerId)
                .single()

            if (fetchError || !provider) {
                console.error('Error finding provider:', mapping.providerId, fetchError)
                results.push({ 
                    providerId: mapping.providerId, 
                    status: 'not_found',
                    error: fetchError?.message 
                })
                continue
            }
            
            // Update the profile_image_url
            const { error: updateError } = await supabaseAdmin
                .from('providers')
                .update({ profile_image_url: mapping.imagePath })
                .eq('id', mapping.providerId)

            if (updateError) {
                console.error('Error updating provider:', mapping.providerId, updateError)
                results.push({
                    providerId: mapping.providerId,
                    fullName: `${provider.first_name} ${provider.last_name}`,
                    status: 'update_error',
                    error: updateError.message
                })
                continue
            }

            console.log('✅ Updated provider:', `${provider.first_name} ${provider.last_name}`, 'with image:', mapping.imagePath)
            results.push({
                providerId: mapping.providerId,
                fullName: `${provider.first_name} ${provider.last_name}`,
                imagePath: mapping.imagePath,
                oldImageUrl: provider.profile_image_url,
                status: 'success'
            })
        }

        return NextResponse.json({
            success: true,
            message: 'Provider image update completed',
            results
        })

    } catch (error: any) {
        console.error('❌ Error updating provider images:', error)
        return NextResponse.json(
            { 
                success: false, 
                error: 'Failed to update provider images', 
                details: error.message 
            },
            { status: 500 }
        )
    }
}