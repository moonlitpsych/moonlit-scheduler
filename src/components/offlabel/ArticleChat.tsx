'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Sparkles, RefreshCw, Trash2 } from 'lucide-react'
import type { ConversationMessage, GeneratedArticle } from '@/lib/offlabel/types'

interface ArticleChatProps {
  draftId?: string
  onArticleUpdate: (article: GeneratedArticle) => void
  onDraftIdChange: (draftId: string) => void
  initialConversation?: ConversationMessage[]
}

export function ArticleChat({
  draftId,
  onArticleUpdate,
  onDraftIdChange,
  initialConversation = [],
}: ArticleChatProps) {
  const [messages, setMessages] = useState<ConversationMessage[]>(initialConversation)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [input])

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setError(null)

    // Optimistically add user message
    const newUserMessage: ConversationMessage = {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, newUserMessage])
    setIsLoading(true)

    try {
      const response = await fetch('/api/admin/offlabel/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draft_id: draftId,
          message: userMessage,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to send message')
      }

      const data = await response.json()

      // Update draft ID if this is a new conversation
      if (!draftId && data.draft_id) {
        onDraftIdChange(data.draft_id)
      }

      // Add assistant message
      const assistantMessage: ConversationMessage = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, assistantMessage])

      // Update article if we have one
      if (data.article) {
        console.log('[ArticleChat] Received article from API:', data.article.title)
        console.log('[ArticleChat] Content length:', data.article.content?.length || 0)
        onArticleUpdate(data.article)
      } else {
        console.log('[ArticleChat] No article in API response')
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
      // Remove the optimistic user message on error
      setMessages((prev) => prev.slice(0, -1))
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const startNewConversation = () => {
    if (messages.length > 0 && !confirm('Start a new conversation? Current chat history will be cleared.')) {
      return
    }
    setMessages([])
    setError(null)
    onDraftIdChange('') // Clear the draft ID to start fresh
  }

  const suggestedPrompts = [
    "I want to write about the PAX-D trial showing pramipexole works for anhedonia",
    "Help me write a Clinical Wisdom piece about what I tell patients scared of SSRIs",
    "Let's write about the history of lithium - why it's underused",
    "I want to cover the new ketamine research for treatment-resistant depression",
  ]

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border-2 border-stone-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-stone-200 bg-gradient-to-r from-[#BF9C73]/10 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="h-5 w-5 text-[#BF9C73]" />
            <h3 className="font-semibold text-[#091747]">Write with Claude</h3>
          </div>
          {messages.length > 0 && (
            <button
              onClick={startNewConversation}
              className="flex items-center space-x-1 text-xs text-[#091747]/50 hover:text-[#091747] transition-colors"
              title="Start new conversation"
            >
              <RefreshCw className="h-3 w-3" />
              <span>New Chat</span>
            </button>
          )}
        </div>
        <p className="text-sm text-[#091747]/60 mt-1">
          Describe what you want to write about. Claude will help draft your article.
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="space-y-4">
            <p className="text-[#091747]/60 text-center py-8">
              Start a conversation to begin writing your article.
            </p>
            <div className="space-y-2">
              <p className="text-xs font-medium text-[#091747]/50 uppercase tracking-wide">
                Try one of these:
              </p>
              {suggestedPrompts.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => setInput(prompt)}
                  className="block w-full text-left px-4 py-3 bg-stone-50 hover:bg-[#BF9C73]/10 rounded-lg text-sm text-[#091747]/80 transition-colors border border-transparent hover:border-[#BF9C73]/30"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-[#BF9C73] text-white rounded-br-md'
                    : 'bg-stone-100 text-[#091747] rounded-bl-md'
                }`}
              >
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {message.content}
                </div>
                {message.timestamp && (
                  <div
                    className={`text-xs mt-2 ${
                      message.role === 'user' ? 'text-white/70' : 'text-[#091747]/50'
                    }`}
                  >
                    {new Date(message.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-stone-100 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center space-x-2 text-[#091747]/60">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Claude is thinking...</span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-center">
            <div className="bg-red-50 text-red-700 rounded-lg px-4 py-3 text-sm flex items-center space-x-2">
              <span>{error}</span>
              <button
                onClick={() => setError(null)}
                className="text-red-500 hover:text-red-700"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-stone-200 bg-stone-50">
        <div className="flex items-end space-x-2">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe what you want to write about..."
              rows={1}
              className="w-full px-4 py-3 pr-12 border-2 border-stone-200 rounded-xl focus:outline-none focus:border-[#BF9C73] resize-none text-sm"
              disabled={isLoading}
            />
          </div>
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="p-3 bg-[#BF9C73] hover:bg-[#A8865F] text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </div>
        <p className="text-xs text-[#091747]/50 mt-2 text-center">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}
