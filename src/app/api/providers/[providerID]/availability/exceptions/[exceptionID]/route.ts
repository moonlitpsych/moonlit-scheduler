import { NextRequest, NextResponse } from 'next/server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { providerId: string; exceptionId: string } }
) {
  try {
    console.log('Removing exception:', params.exceptionId, 'for provider:', params.providerId)
    
    return NextResponse.json({ 
      success: true, 
      message: 'Exception removed successfully' 
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to remove exception' },
      { status: 500 }
    )
  }
}