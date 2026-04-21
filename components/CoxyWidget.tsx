'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useCoxy } from '@/contexts/CoxyContext'

const SUGGESTIONS = [
  'How do I onboard a new external designer?',
  'How does phone number rotation work?',
  'What happens when an API key expires?',
  'How do I connect Google Search Console?',
]

export default function CoxyWidget() {
  const { open, setOpen } = useCoxy()
  const pathname = usePathname()
  // Hide the floating mascot on the dashboard — the welcome banner already shows Coxy.
  const showFloatingBubble = pathname !== '/'
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: '/api/coxy/chat' }),
  })

  const isStreaming = status === 'streaming' || status === 'submitted'

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, status])

  // Focus input when opening
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  function submit(text: string) {
    if (!text.trim() || isStreaming) return
    sendMessage({ text: text.trim() })
    setInput('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    submit(input)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit(input)
    }
  }

  return (
    <>
      {/* Floating mascot — only when closed and not on the dashboard (which has its own big Coxy). */}
      {!open && showFloatingBubble && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open Coxy chat"
          className="fixed bottom-5 right-5 z-40 transition-transform duration-200 hover:scale-105 group"
          style={{ filter: 'drop-shadow(0 12px 24px rgba(15, 23, 42, 0.25)) drop-shadow(0 4px 8px rgba(15, 23, 42, 0.15))' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/character-floating.gif"
            alt="Coxy — click to chat"
            className="h-28 w-auto pointer-events-none select-none"
            draggable={false}
          />
          {/* Tooltip bubble on hover */}
          <span className="absolute right-full top-1/2 -translate-y-1/2 mr-2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none text-[11px] font-medium px-2.5 py-1 rounded-full"
            style={{ background: 'var(--foreground)', color: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
            Ask Coxy
          </span>
          {/* Online dot */}
          <span className="absolute top-1 right-1 w-3 h-3 rounded-full border-2 border-white" style={{ background: '#22c55e' }} aria-hidden />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-5 right-5 z-50 w-[calc(100vw-2.5rem)] sm:w-[400px] h-[600px] max-h-[calc(100vh-2.5rem)] rounded-2xl bg-white shadow-2xl flex flex-col overflow-hidden"
          style={{ border: '1px solid #e2e8f0' }}
        >
          {/* Header */}
          <div className="px-4 py-3 flex items-center gap-3 flex-shrink-0" style={{ borderBottom: '1px solid #e2e8f0', background: 'linear-gradient(to right, #f0f4f8, #ffffff)' }}>
            <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/character-logo.gif" alt="" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold flex items-center gap-1.5" style={{ color: 'var(--foreground)' }}>
                Coxy
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#22c55e' }} aria-hidden />
              </h3>
              <p className="text-[11px]" style={{ color: '#64748b' }}>Your Webcore assistant</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close Coxy chat"
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors flex-shrink-0"
              style={{ color: '#64748b' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ background: '#fafbfc' }}>
            {messages.length === 0 ? (
              <div className="text-center pt-6">
                <p className="text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>Hi, I&apos;m Coxy 👋</p>
                <p className="text-xs mb-5" style={{ color: '#64748b' }}>Ask me anything about Utopia Webcore.</p>
                <div className="space-y-2 text-left">
                  <p className="text-[10px] font-semibold uppercase tracking-wider px-1" style={{ color: '#94a3b8' }}>Try asking</p>
                  {SUGGESTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => submit(s)}
                      className="w-full text-left text-xs px-3 py-2.5 rounded-lg border bg-white transition-all hover:border-[var(--primary)] hover:bg-slate-50"
                      style={{ borderColor: '#e2e8f0', color: '#475569' }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map(m => (
                <MessageBubble key={m.id} role={m.role} parts={m.parts} />
              ))
            )}
            {isStreaming && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex gap-2">
                <div className="w-7 h-7 flex-shrink-0 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/character-floating.gif" alt="" className="w-full h-full object-contain" />
                </div>
                <div className="px-3 py-2 rounded-2xl rounded-tl-sm" style={{ background: 'white', border: '1px solid #e2e8f0' }}>
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#94a3b8', animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#94a3b8', animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#94a3b8', animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            {error && (
              <div className="px-3 py-2 rounded-lg text-xs" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>
                Something went wrong. Try again in a moment.
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="px-3 py-3 flex items-end gap-2 flex-shrink-0" style={{ borderTop: '1px solid #e2e8f0', background: 'white' }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Coxy…"
              rows={1}
              className="flex-1 resize-none rounded-xl px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--primary)]"
              style={{ border: '1px solid #e2e8f0', maxHeight: '120px' }}
              disabled={isStreaming}
            />
            <button
              type="submit"
              disabled={!input.trim() || isStreaming}
              aria-label="Send message"
              className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'var(--primary)' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m-7 7l7-7 7 7" /></svg>
            </button>
          </form>
        </div>
      )}
    </>
  )
}

interface MessagePart {
  type: string
  text?: string
}

function MessageBubble({ role, parts }: { role: 'user' | 'assistant' | 'system'; parts: MessagePart[] }) {
  const text = parts.filter(p => p.type === 'text').map(p => p.text).join('')
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] px-3 py-2 rounded-2xl rounded-tr-sm text-sm whitespace-pre-wrap"
          style={{ background: 'var(--primary)', color: 'white' }}>
          {text}
        </div>
      </div>
    )
  }
  return (
    <div className="flex gap-2">
      <div className="w-7 h-7 flex-shrink-0 flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/character-floating.gif" alt="" className="w-full h-full object-contain" />
      </div>
      <div className="max-w-[85%] px-3 py-2 rounded-2xl rounded-tl-sm text-sm whitespace-pre-wrap"
        style={{ background: 'white', border: '1px solid #e2e8f0', color: 'var(--foreground)' }}>
        {text || <span style={{ color: '#cbd5e1' }}>…</span>}
      </div>
    </div>
  )
}
