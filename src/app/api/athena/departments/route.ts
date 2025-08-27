// src/app/api/athena/departments/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { athenaService } from '@/lib/services/athenaService'

export async function GET(request: NextRequest) {
  try {
    console.log('🏢 Fetching departments from Athena...')

    const token = await (athenaService as any).getToken()
    const baseUrl = process.env.ATHENA_BASE_URL
    const practiceId = process.env.ATHENA_PRACTICE_ID

    const response = await fetch(`${baseUrl}/v1/${practiceId}/departments`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Athena API error: ${response.status} ${error}`)
    }

    const data = await response.json()
    const departments = data.departments || []

    console.log(`✅ Found ${departments.length} departments`)

    return NextResponse.json({
      success: true,
      departments: departments,
      total_count: departments.length,
      mapping_suggestion: departments.map((dept: any) => ({
        athena_department_id: dept.departmentid,
        athena_name: dept.name,
        suggested_specialty: mapToSpecialty(dept.name),
        active: dept.isactive === 'true'
      }))
    })

  } catch (error: any) {
    console.error('❌ Error fetching departments:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch departments',
        details: error.message
      },
      { status: 500 }
    )
  }
}

function mapToSpecialty(departmentName: string): string {
  const name = departmentName.toLowerCase()
  
  if (name.includes('psychiatry') || name.includes('psychiatric')) {
    return 'Mental Health - Psychiatry'
  }
  if (name.includes('psychology') || name.includes('psycholog')) {
    return 'Mental Health - Psychology'
  }
  if (name.includes('therapy') || name.includes('counseling')) {
    return 'Mental Health - Therapy'
  }
  if (name.includes('telehealth') || name.includes('virtual')) {
    return 'Mental Health - Telehealth'
  }
  
  return 'Mental Health - General'
}