import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import path from 'path'

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData()
        const file = formData.get('file') as File
        const providerId = formData.get('providerId') as string
        const providerName = formData.get('providerName') as string

        if (!file) {
            return NextResponse.json(
                { success: false, error: 'No file provided' },
                { status: 400 }
            )
        }

        // Validate file type
        if (!file.type.startsWith('image/')) {
            return NextResponse.json(
                { success: false, error: 'File must be an image' },
                { status: 400 }
            )
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            return NextResponse.json(
                { success: false, error: 'File size must be less than 5MB' },
                { status: 400 }
            )
        }

        // Generate filename from provider name
        const sanitizedName = providerName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')

        const extension = file.name.split('.').pop()
        const filename = `${sanitizedName}-removebg-preview.${extension}`

        // Convert file to buffer
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        // Save to public/images/providers/
        const publicPath = path.join(process.cwd(), 'public', 'images', 'providers', filename)
        await writeFile(publicPath, buffer)

        // Return the public URL path
        const imageUrl = `/images/providers/${filename}`

        return NextResponse.json({
            success: true,
            data: {
                filename,
                url: imageUrl,
                size: file.size
            }
        })

    } catch (error: any) {
        console.error('❌ Image upload error:', error)
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to upload image' },
            { status: 500 }
        )
    }
}
