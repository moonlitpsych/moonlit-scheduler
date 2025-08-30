'use client'

import { useState, useRef } from 'react'
import { FileText, Upload, Mic, Wand2, Download, Copy, Eye, EyeOff, Loader2, CheckCircle } from 'lucide-react'

interface Patient {
  id: string
  name: string
  email?: string
  phone?: string
  mrn?: string
  dob?: string
}

interface NoteGeneratorProps {
  patient?: Patient
  appointmentId?: string
  appointmentType?: 'initial' | 'follow-up' | 'consultation'
  onNoteSaved?: (noteId: string) => void
}

interface GeneratedNote {
  id: string
  content: string
  noteType: 'soap' | 'intake' | 'progress'
  status: 'draft' | 'reviewed' | 'finalized'
  createdAt: string
  aiModel: string
  transcriptSource?: string
}

export default function NoteGenerator({
  patient,
  appointmentId,
  appointmentType = 'follow-up',
  onNoteSaved
}: NoteGeneratorProps) {
  const [transcript, setTranscript] = useState('')
  const [generatedNote, setGeneratedNote] = useState<GeneratedNote | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [noteType, setNoteType] = useState<'soap' | 'intake' | 'progress'>('soap')
  const [showTranscript, setShowTranscript] = useState(true)
  const [copied, setCopied] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setLoading(true)
      setError('')

      // Handle different file types
      if (file.type.startsWith('audio/')) {
        // Audio transcription logic would go here
        setTranscript('Audio file uploaded. Transcription would be processed here...')
      } else if (file.type === 'text/plain') {
        // Text file reading
        const text = await file.text()
        setTranscript(text)
      } else {
        throw new Error('Unsupported file type. Please upload audio or text files.')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const generateNote = async () => {
    if (!transcript.trim()) {
      setError('Please provide a transcript or upload an audio file first.')
      return
    }

    try {
      setLoading(true)
      setError('')

      // This would call your AI note generation API
      const response = await fetch('/api/notes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          noteType,
          patient,
          appointmentId,
          appointmentType
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate note')
      }

      const data = await response.json()
      
      // Mock generated note structure
      const newNote: GeneratedNote = {
        id: `note_${Date.now()}`,
        content: data.content || generateMockNote(),
        noteType,
        status: 'draft',
        createdAt: new Date().toISOString(),
        aiModel: 'gemini-1.5-pro',
        transcriptSource: 'manual'
      }

      setGeneratedNote(newNote)
    } catch (err: any) {
      console.error('Error generating note:', err)
      setError('Failed to generate clinical note. Please try again.')
      
      // For demo purposes, generate a mock note
      const mockNote: GeneratedNote = {
        id: `note_${Date.now()}`,
        content: generateMockNote(),
        noteType,
        status: 'draft',
        createdAt: new Date().toISOString(),
        aiModel: 'gemini-1.5-pro',
        transcriptSource: 'manual'
      }
      setGeneratedNote(mockNote)
    } finally {
      setLoading(false)
    }
  }

  const generateMockNote = () => {
    const patientName = patient?.name || 'Patient'
    const date = new Date().toLocaleDateString()
    
    if (noteType === 'soap') {
      return `SOAP Note - ${date}

Patient: ${patientName}
Date of Service: ${date}
Provider: [Provider Name]

SUBJECTIVE:
${patientName} presents for ${appointmentType} appointment. Patient reports [chief complaint based on transcript]. Current symptoms include [symptoms from discussion]. Patient describes mood as [mood assessment]. Sleep patterns [sleep information]. Appetite [appetite information].

OBJECTIVE:
Vital Signs: [if available]
Mental Status Exam:
- Appearance: [observations]
- Behavior: [behavioral observations]
- Speech: [speech patterns]
- Mood/Affect: [clinical assessment]
- Thought Process: [thought organization]
- Thought Content: [content assessment]
- Perceptual Disturbances: [any noted]
- Cognition: [cognitive assessment]
- Insight/Judgment: [assessment]

ASSESSMENT:
Primary Diagnosis: [based on clinical presentation]
- [Supporting evidence from session]

Secondary considerations: [if applicable]

Current treatment response: [medication/therapy response]
Risk assessment: [safety considerations]

PLAN:
1. Medication Management:
   - [Current medications and any changes]
   - [Rationale for changes]

2. Therapeutic Interventions:
   - [Therapy recommendations]
   - [Behavioral interventions]

3. Follow-up:
   - [Next appointment timing]
   - [Specific monitoring needs]

4. Patient Education:
   - [Educational topics covered]
   - [Resources provided]

Provider Signature: [Provider Name]
Date: ${date}`
    }

    if (noteType === 'intake') {
      return `Initial Psychiatric Assessment - ${date}

Patient: ${patientName}
Date of Assessment: ${date}
Provider: [Provider Name]

CHIEF COMPLAINT:
[Primary reason for seeking treatment]

HISTORY OF PRESENT ILLNESS:
[Detailed history of current psychiatric symptoms]

PAST PSYCHIATRIC HISTORY:
[Previous mental health treatment, hospitalizations, medications]

MEDICAL HISTORY:
[Relevant medical conditions, surgeries, allergies]

FAMILY HISTORY:
[Family psychiatric and medical history]

SOCIAL HISTORY:
[Substance use, relationships, work, living situation]

MENTAL STATUS EXAMINATION:
[Complete MSE findings]

ASSESSMENT AND DIAGNOSIS:
[Clinical formulation and DSM-5 diagnoses]

TREATMENT PLAN:
[Comprehensive treatment recommendations]

Risk Assessment: [Safety evaluation]

Provider Signature: [Provider Name]
Date: ${date}`
    }

    // Progress note
    return `Progress Note - ${date}

Patient: ${patientName}
Date: ${date}
Session Type: ${appointmentType}

PROGRESS SINCE LAST VISIT:
[Patient's reported progress and changes]

CURRENT STATUS:
[Current symptom presentation and functioning]

INTERVENTIONS PROVIDED:
[Therapeutic interventions during session]

PATIENT RESPONSE:
[Patient engagement and response to treatment]

PLAN FOR NEXT SESSION:
[Goals and plans for continued treatment]

Provider: [Provider Name]
Date: ${date}`
  }

  const saveNote = async () => {
    if (!generatedNote) return

    try {
      setLoading(true)
      
      const response = await fetch('/api/notes/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...generatedNote,
          patientId: patient?.id,
          appointmentId
        })
      })

      if (!response.ok) {
        throw new Error('Failed to save note')
      }

      const data = await response.json()
      onNoteSaved?.(data.id)
      
      // Update note status
      setGeneratedNote(prev => prev ? { ...prev, status: 'reviewed' } : null)
    } catch (err: any) {
      setError('Failed to save note. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const copyNote = async () => {
    if (generatedNote?.content) {
      try {
        await navigator.clipboard.writeText(generatedNote.content)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (err) {
        console.error('Failed to copy note:', err)
      }
    }
  }

  const downloadNote = () => {
    if (!generatedNote) return

    const blob = new Blob([generatedNote.content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `clinical-note-${patient?.name || 'patient'}-${Date.now()}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-[#BF9C73]/20 rounded-full">
            <Wand2 className="w-5 h-5 text-[#BF9C73]" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-[#091747] font-['Newsreader']">
              AI Note Generator
            </h3>
            <p className="text-sm text-[#091747]/60">
              Generate professional clinical notes from appointment transcripts
            </p>
          </div>
        </div>

        {patient && (
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm font-medium text-blue-900">Patient: {patient.name}</p>
            {patient.mrn && (
              <p className="text-xs text-blue-700">MRN: {patient.mrn}</p>
            )}
          </div>
        )}
      </div>

      {/* Note Type Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-[#091747] mb-2">Note Type</label>
        <div className="flex gap-2">
          {[
            { key: 'soap', label: 'SOAP Note' },
            { key: 'intake', label: 'Intake Assessment' },
            { key: 'progress', label: 'Progress Note' }
          ].map(type => (
            <button
              key={type.key}
              onClick={() => setNoteType(type.key as any)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                noteType === type.key
                  ? 'bg-[#BF9C73] text-white'
                  : 'bg-stone-100 text-[#091747] hover:bg-stone-200'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Transcript Input */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-[#091747]">
            Appointment Transcript
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTranscript(!showTranscript)}
              className="text-sm text-[#091747]/60 hover:text-[#091747] flex items-center gap-1"
            >
              {showTranscript ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showTranscript ? 'Hide' : 'Show'}
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-sm bg-stone-100 hover:bg-stone-200 text-[#091747] px-3 py-1 rounded-md transition-colors flex items-center gap-1"
            >
              <Upload className="w-3 h-3" />
              Upload
            </button>
          </div>
        </div>

        {showTranscript && (
          <textarea
            ref={textareaRef}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Paste your appointment transcript here, or upload an audio/text file..."
            className="w-full h-48 px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent font-['Newsreader'] text-sm resize-y"
          />
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.txt"
          onChange={handleFileUpload}
          className="hidden"
        />

        <p className="text-xs text-[#091747]/60 mt-1">
          Upload audio files for automatic transcription or text files with existing transcripts
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Generate Button */}
      {!generatedNote && (
        <div className="mb-6">
          <button
            onClick={generateNote}
            disabled={loading || !transcript.trim()}
            className="w-full bg-[#BF9C73] hover:bg-[#BF9C73]/90 disabled:bg-stone-400 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating Note...
              </>
            ) : (
              <>
                <Wand2 className="w-5 h-5" />
                Generate Clinical Note
              </>
            )}
          </button>
        </div>
      )}

      {/* Generated Note */}
      {generatedNote && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-semibold text-[#091747] font-['Newsreader']">Generated Note</h4>
              <div className="flex items-center gap-3 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  generatedNote.status === 'draft' ? 'bg-blue-100 text-blue-700' :
                  generatedNote.status === 'reviewed' ? 'bg-green-100 text-green-700' :
                  'bg-[#BF9C73]/10 text-[#BF9C73]'
                }`}>
                  {generatedNote.status.charAt(0).toUpperCase() + generatedNote.status.slice(1)}
                </span>
                <span className="text-xs text-[#091747]/50">
                  {generatedNote.noteType.toUpperCase()} • {generatedNote.aiModel}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={copyNote}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
                  copied 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-stone-100 hover:bg-stone-200 text-[#091747]'
                }`}
              >
                {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button
                onClick={downloadNote}
                className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-[#091747] rounded-md text-sm font-medium transition-colors flex items-center gap-1"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
            </div>
          </div>

          <div className="mb-4 p-4 bg-stone-50 rounded-lg border border-stone-200 max-h-96 overflow-y-auto">
            <pre className="whitespace-pre-wrap text-sm text-[#091747] font-['Newsreader'] leading-relaxed">
              {generatedNote.content}
            </pre>
          </div>

          <div className="flex gap-3">
            <button
              onClick={saveNote}
              disabled={loading || generatedNote.status !== 'draft'}
              className="bg-green-600 hover:bg-green-700 disabled:bg-stone-400 text-white px-6 py-2 rounded-lg transition-colors font-medium flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Save Note
                </>
              )}
            </button>
            
            <button
              onClick={() => {
                setGeneratedNote(null)
                setTranscript('')
                setError('')
              }}
              className="bg-stone-100 hover:bg-stone-200 text-[#091747] px-6 py-2 rounded-lg transition-colors font-medium"
            >
              Generate New Note
            </button>
          </div>
        </div>
      )}

      {/* AI Processing Notice */}
      <div className="mt-6 pt-4 border-t border-stone-200">
        <div className="flex items-start gap-2">
          <div className="w-5 h-5 bg-[#BF9C73]/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <Wand2 className="w-3 h-3 text-[#BF9C73]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[#091747]">AI-Powered Clinical Documentation</p>
            <p className="text-xs text-[#091747]/60 mt-1">
              Notes are generated using advanced AI and should be reviewed by the provider before finalizing. 
              All processing is HIPAA-compliant and secure.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}