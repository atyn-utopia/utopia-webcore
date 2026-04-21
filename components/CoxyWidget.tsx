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

const POS_STORAGE_KEY = 'coxy-floating-pos'
const DRAG_THRESHOLD = 5 // px moved before click is suppressed and we treat it as a drag
const BUBBLE_SIZE = 120 // approx width/height so we can clamp to the viewport

type Anchor = 'top' | 'bottom'
type Pos = { anchor: Anchor; right: number; y: number }

const DEFAULT_POS: Pos = { anchor: 'bottom', right: 20, y: 23 }
// Dashboard default: sits roughly where the old character.gif lived in the welcome banner
const DASHBOARD_POS: Pos = { anchor: 'top', right: 80, y: 157 }

export default function CoxyWidget() {
  const { open, setOpen } = useCoxy()
  const pathname = usePathname()
  const isDashboard = pathname === '/'
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const [pos, setPos] = useState<Pos>(DEFAULT_POS)
  const dragRef = useRef<{ startX: number; startY: number; startRight: number; startPosY: number; anchor: Anchor; moved: boolean } | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Reset position when route changes: dashboard has its own default, other pages use saved/default
  useEffect(() => {
    if (isDashboard) {
      setPos(DASHBOARD_POS)
      return
    }
    try {
      const saved = localStorage.getItem(POS_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        // Migrate legacy bottom-only storage shape
        if (parsed.anchor) setPos(parsed)
        else if (typeof parsed.bottom === 'number') setPos({ anchor: 'bottom', right: parsed.right ?? 20, y: parsed.bottom })
        else setPos(DEFAULT_POS)
      } else {
        setPos(DEFAULT_POS)
      }
    } catch {
      setPos(DEFAULT_POS)
    }
  }, [isDashboard])

  function onBubblePointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startRight: pos.right,
      startPosY: pos.y,
      anchor: pos.anchor,
      moved: false,
    }
    setIsDragging(true)
  }

  function onBubblePointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) dragRef.current.moved = true
    // +dx moves right → distance from right edge decreases
    const nextRight = Math.max(0, Math.min(window.innerWidth - BUBBLE_SIZE, dragRef.current.startRight - dx))
    // Top anchor: +dy increases top value. Bottom anchor: +dy decreases bottom value.
    const nextY = dragRef.current.anchor === 'top'
      ? Math.max(0, Math.min(window.innerHeight - BUBBLE_SIZE, dragRef.current.startPosY + dy))
      : Math.max(0, Math.min(window.innerHeight - BUBBLE_SIZE, dragRef.current.startPosY - dy))
    setPos(p => ({ ...p, right: nextRight, y: nextY }))
  }

  function onBubblePointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch {}
    const wasMoved = dragRef.current?.moved ?? false
    dragRef.current = null
    setIsDragging(false)
    if (!wasMoved) {
      setOpen(true)
    } else if (!isDashboard) {
      // Persist new position — dashboard always resets on visit, so we don't save it
      try { localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(pos)) } catch {}
    }
  }

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
      {/* Floating mascot — draggable, shown on every admin page whenever the chat panel is closed. */}
      {!open && (
        <button
          type="button"
          onPointerDown={onBubblePointerDown}
          onPointerMove={onBubblePointerMove}
          onPointerUp={onBubblePointerUp}
          onPointerCancel={onBubblePointerUp}
          aria-label="Open Coxy chat (drag to move, click to open)"
          className={`fixed z-40 group touch-none ${isDragging ? '' : 'transition-all duration-200 hover:scale-105'}`}
          style={{
            right: `${pos.right}px`,
            ...(pos.anchor === 'top' ? { top: `${pos.y}px` } : { bottom: `${pos.y}px` }),
            cursor: isDragging ? 'grabbing' : 'grab',
            filter: 'drop-shadow(0 12px 24px rgba(15, 23, 42, 0.25)) drop-shadow(0 4px 8px rgba(15, 23, 42, 0.15))',
          }}
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
            Drag me · click to chat
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
              <img src="/character-logo.png" alt="" className="w-full h-full object-contain" />
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
