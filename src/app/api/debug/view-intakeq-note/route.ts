/**
 * DEBUG: View raw IntakeQ note content
 * GET /api/debug/view-intakeq-note?noteId=xxx
 * OR
 * GET /api/debug/view-intakeq-note?clientId=xxx (gets most recent locked note)
 */

import { NextRequest, NextResponse } from 'next/server'
import { intakeQService } from '@/lib/services/intakeQService'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const noteId = searchParams.get('noteId')
    const clientId = searchParams.get('clientId')

    if (!noteId && !clientId) {
      return NextResponse.json({
        error: 'Provide noteId or clientId parameter'
      }, { status: 400 })
    }

    let note: any

    if (noteId) {
      // Get specific note by ID
      note = await intakeQService.getNote(noteId)
    } else if (clientId) {
      // Get most recent locked note for client
      const notes = await intakeQService.getClientNotes(clientId, { limit: 5 })
      const lockedNotes = notes.filter((n: any) => n.Status === 'locked')

      if (lockedNotes.length === 0) {
        return NextResponse.json({
          error: 'No locked notes found for this client',
          allNotes: notes.map((n: any) => ({
            Id: n.Id,
            Status: n.Status,
            CreatedDate: n.CreatedDate
          }))
        }, { status: 404 })
      }

      note = await intakeQService.getNote(lockedNotes[0].Id)
    }

    // Extract relevant sections
    const hpiQuestion = note.Questions?.find((q: any) =>
      q.Text?.toLowerCase().includes('hpi') ||
      q.Text?.toLowerCase().includes('history of present illness')
    )

    // Find "Assessment and Plan:" specifically (not "Risk Assessment:")
    const assessmentQuestion = note.Questions?.find((q: any) =>
      q.Text?.toLowerCase().includes('assessment and plan')
    ) || note.Questions?.find((q: any) =>
      // Fallback: Look for "plan" but exclude "risk assessment"
      q.Text?.toLowerCase().includes('plan') &&
      !q.Text?.toLowerCase().includes('risk assessment')
    )

    return NextResponse.json({
      noteId: note.Id,
      createdDate: note.CreatedDate,
      status: note.Status,
      totalQuestions: note.Questions?.length || 0,
      hpiSection: hpiQuestion ? {
        questionText: hpiQuestion.Text,
        answerPreview: hpiQuestion.Answer?.substring(0, 500),
        answerLength: hpiQuestion.Answer?.length || 0,
        fullAnswer: hpiQuestion.Answer
      } : null,
      assessmentSection: assessmentQuestion ? {
        questionText: assessmentQuestion.Text,
        answerPreview: assessmentQuestion.Answer?.substring(0, 500),
        answerLength: assessmentQuestion.Answer?.length || 0,
        fullAnswer: assessmentQuestion.Answer
      } : null,
      allQuestions: note.Questions?.map((q: any) => ({
        text: q.Text,
        hasAnswer: !!q.Answer,
        answerLength: q.Answer?.length || 0
      }))
    })

  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}
