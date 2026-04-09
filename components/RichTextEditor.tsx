'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import LinkExtension from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import Heading from '@tiptap/extension-heading'
import Image from '@tiptap/extension-image'
import { useEffect, useCallback, useState, useRef } from 'react'

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
}

interface HeadingItem {
  text: string
  level: number
  id: string
}

function toSlug(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim()
}

function ToolbarButton({
  active, onClick, title, children,
}: {
  active?: boolean; onClick: () => void; title: string; children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="w-8 h-8 flex items-center justify-center rounded transition-colors"
      style={{ background: active ? '#e2e8f0' : 'transparent', color: active ? '#1e293b' : '#64748b' }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = '#f1f5f9' }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div className="w-px h-5 mx-1" style={{ background: '#e2e8f0' }} />
}

// Custom heading extension that auto-generates IDs
const HeadingWithId = Heading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      id: { default: null, rendered: true },
    }
  },
  renderHTML({ node, HTMLAttributes }) {
    const text = node.textContent
    const id = HTMLAttributes.id || toSlug(text)
    return [`h${node.attrs.level}`, { ...HTMLAttributes, id }, 0]
  },
})

export default function RichTextEditor({ value, onChange, placeholder = 'Start writing...' }: RichTextEditorProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [showHeadingPicker, setShowHeadingPicker] = useState(false)
  const [headings, setHeadings] = useState<HeadingItem[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false }),
      HeadingWithId.configure({ levels: [1, 2, 3, 4, 5, 6] }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      LinkExtension.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer' },
      }),
      Image.configure({ inline: false, allowBase64: true }),
      Placeholder.configure({ placeholder }),
      CharacterCount,
    ],
    content: value,
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML())
      extractHeadings(ed)
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[400px] px-4 py-3',
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items
        if (!items) return false
        for (const item of Array.from(items)) {
          if (item.type.startsWith('image/')) {
            event.preventDefault()
            const file = item.getAsFile()
            if (!file) return false
            const reader = new FileReader()
            reader.onload = () => {
              const src = reader.result as string
              const alt = window.prompt('Enter alt text for this image:', '') ?? ''
              view.dispatch(view.state.tr.replaceSelectionWith(
                view.state.schema.nodes.image.create({ src, alt })
              ))
            }
            reader.readAsDataURL(file)
            return true
          }
        }
        return false
      },
      handleDrop: (view, event) => {
        const files = event.dataTransfer?.files
        if (!files?.length) return false
        const file = files[0]
        if (!file.type.startsWith('image/')) return false
        event.preventDefault()
        const reader = new FileReader()
        reader.onload = () => {
          const src = reader.result as string
          const alt = window.prompt('Enter alt text for this image:', '') ?? ''
          const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? view.state.selection.from
          view.dispatch(view.state.tr.insert(pos,
            view.state.schema.nodes.image.create({ src, alt })
          ))
        }
        reader.readAsDataURL(file)
        return true
      },
    },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function extractHeadings(ed: any) {
    const items: HeadingItem[] = []
    ed.state.doc.descendants((node: { type: { name: string }; attrs: { level: number }; textContent: string }) => {
      if (node.type.name === 'heading') {
        const text = node.textContent
        if (text.trim()) {
          items.push({ text, level: node.attrs.level, id: toSlug(text) })
        }
      }
    })
    setHeadings(items)
  }

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value)
      extractHeadings(editor)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  // Initial heading extraction
  useEffect(() => {
    if (editor) extractHeadings(editor)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  // Close context menu on click outside
  useEffect(() => {
    function handleClick() { setContextMenu(null); setShowHeadingPicker(false) }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (!editor) return
    const { from, to } = editor.state.selection
    if (from === to) return // no text selected
    e.preventDefault()

    const rect = containerRef.current?.getBoundingClientRect()
    setContextMenu({
      x: e.clientX - (rect?.left ?? 0),
      y: e.clientY - (rect?.top ?? 0),
    })
    setShowHeadingPicker(false)
  }, [editor])

  const setLink = useCallback(() => {
    if (!editor) return
    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('Enter URL:', previousUrl ?? 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    }
  }, [editor])

  const linkToHeading = useCallback((headingId: string) => {
    if (!editor) return
    editor.chain().focus().extendMarkRange('link').setLink({ href: `#${headingId}` }).run()
    setContextMenu(null)
    setShowHeadingPicker(false)
  }, [editor])

  const linkToUrl = useCallback(() => {
    setContextMenu(null)
    setShowHeadingPicker(false)
    setLink()
  }, [setLink])

  if (!editor) return null

  const wordCount = editor.storage.characterCount.words()
  const charCount = editor.storage.characterCount.characters()

  const currentHeading = editor.isActive('heading', { level: 1 }) ? 'H1'
    : editor.isActive('heading', { level: 2 }) ? 'H2'
    : editor.isActive('heading', { level: 3 }) ? 'H3'
    : editor.isActive('heading', { level: 4 }) ? 'H4'
    : editor.isActive('heading', { level: 5 }) ? 'H5'
    : editor.isActive('heading', { level: 6 }) ? 'H6'
    : 'P'

  return (
    <div className="rounded-lg border relative flex flex-col" style={{ borderColor: '#cbd5e1' }} ref={containerRef}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 flex-wrap sticky top-0 z-10 rounded-t-lg" style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
        {/* Heading dropdown */}
        <select
          value={currentHeading}
          onChange={e => {
            const val = e.target.value
            if (val === 'P') editor.chain().focus().setParagraph().run()
            else {
              const level = parseInt(val.replace('H', '')) as 1 | 2 | 3 | 4 | 5 | 6
              editor.chain().focus().toggleHeading({ level }).run()
            }
          }}
          className="text-xs font-medium px-2 py-1.5 rounded border cursor-pointer focus:outline-none"
          style={{ borderColor: '#e2e8f0', background: 'white', color: '#475569', minWidth: '100px' }}
        >
          <option value="P">Paragraph</option>
          <option value="H1">Heading 1</option>
          <option value="H2">Heading 2</option>
          <option value="H3">Heading 3</option>
          <option value="H4">Heading 4</option>
          <option value="H5">Heading 5</option>
          <option value="H6">Heading 6</option>
        </select>

        <Divider />

        <ToolbarButton active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold">
          <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6zM6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" stroke="currentColor" strokeWidth="2" fill="none" /></svg>
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="4" x2="10" y2="4" /><line x1="14" y1="20" x2="5" y2="20" /><line x1="15" y1="4" x2="9" y2="20" /></svg>
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 3v7a6 6 0 006 6 6 6 0 006-6V3" /><line x1="4" y1="21" x2="20" y2="21" /></svg>
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="12" x2="20" y2="12" /><path d="M17.5 7.5c0-2-1.5-3.5-5.5-3.5S6.5 5 6.5 7.5c0 4 11 4 11 8.5 0 2.5-2 3.5-5.5 3.5S6 18 6 16" /></svg>
        </ToolbarButton>

        {/* Link */}
        <ToolbarButton active={editor.isActive('link')} onClick={setLink} title="Insert Link">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" /></svg>
        </ToolbarButton>
        {editor.isActive('link') && (
          <ToolbarButton onClick={() => editor.chain().focus().unsetLink().run()} title="Remove Link">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" /><line x1="4" y1="4" x2="20" y2="20" /></svg>
          </ToolbarButton>
        )}

        <Divider />

        <ToolbarButton active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet List">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="9" y1="6" x2="20" y2="6" /><line x1="9" y1="12" x2="20" y2="12" /><line x1="9" y1="18" x2="20" y2="18" /><circle cx="5" cy="6" r="1" fill="currentColor" /><circle cx="5" cy="12" r="1" fill="currentColor" /><circle cx="5" cy="18" r="1" fill="currentColor" /></svg>
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered List">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="10" y1="6" x2="20" y2="6" /><line x1="10" y1="12" x2="20" y2="12" /><line x1="10" y1="18" x2="20" y2="18" /><text x="3" y="8" fontSize="7" fill="currentColor" stroke="none" fontWeight="600">1</text><text x="3" y="14" fontSize="7" fill="currentColor" stroke="none" fontWeight="600">2</text><text x="3" y="20" fontSize="7" fill="currentColor" stroke="none" fontWeight="600">3</text></svg>
        </ToolbarButton>

        <Divider />

        <ToolbarButton active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="Align Left">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="15" y2="12" /><line x1="3" y1="18" x2="18" y2="18" /></svg>
        </ToolbarButton>
        <ToolbarButton active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Align Center">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="6" y1="12" x2="18" y2="12" /><line x1="4" y1="18" x2="20" y2="18" /></svg>
        </ToolbarButton>
        <ToolbarButton active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="Align Right">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="9" y1="12" x2="21" y2="12" /><line x1="6" y1="18" x2="21" y2="18" /></svg>
        </ToolbarButton>

        <Divider />

        <ToolbarButton active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Blockquote">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179z" /></svg>
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Code Block">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal Rule">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12" /></svg>
        </ToolbarButton>

        {/* Insert image */}
        <ToolbarButton onClick={() => {
          const url = window.prompt('Enter image URL:', 'https://')
          if (!url) return
          const alt = window.prompt('Enter alt text:', '') ?? ''
          editor.chain().focus().setImage({ src: url, alt }).run()
        }} title="Insert Image">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
        </ToolbarButton>

        <Divider />

        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Undo">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 105.64-8.36L1 10" /></svg>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Redo">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 11-5.64-8.36L23 10" /></svg>
        </ToolbarButton>
      </div>

      {/* Editor area with right-click handler */}
      <div onContextMenu={handleContextMenu} className="overflow-y-auto" style={{ maxHeight: '500px' }}>
        <EditorContent editor={editor} />
      </div>

      {/* Right-click context menu */}
      {contextMenu && (
        <div
          className="absolute z-50 rounded-lg border shadow-lg py-1 min-w-[180px]"
          style={{ left: contextMenu.x, top: contextMenu.y, background: 'white', borderColor: '#e2e8f0' }}
          onClick={e => e.stopPropagation()}
        >
          <button
            type="button"
            className="w-full text-left px-3 py-2 text-xs hover:bg-[#f1f5f9] flex items-center gap-2 transition-colors"
            style={{ color: '#475569' }}
            onClick={linkToUrl}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" /></svg>
            Link to URL...
          </button>

          {headings.length > 0 && (
            <>
              <div className="h-px mx-2 my-1" style={{ background: '#e2e8f0' }} />
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-xs hover:bg-[#f1f5f9] flex items-center gap-2 transition-colors"
                style={{ color: '#475569' }}
                onClick={() => setShowHeadingPicker(!showHeadingPicker)}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h7" /></svg>
                Link to heading
                <svg className="w-3 h-3 ml-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
              </button>

              {showHeadingPicker && (
                <div className="border-t" style={{ borderColor: '#e2e8f0' }}>
                  <div className="max-h-48 overflow-y-auto py-1">
                    {headings.map((h, i) => (
                      <button
                        key={i}
                        type="button"
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#f1f5f9] transition-colors truncate"
                        style={{ color: '#1e293b', paddingLeft: `${12 + (h.level - 1) * 12}px` }}
                        onClick={() => linkToHeading(h.id)}
                      >
                        <span className="text-[10px] font-medium mr-1.5" style={{ color: '#94a3b8' }}>H{h.level}</span>
                        {h.text}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {editor.isActive('image') && (
            <>
              <div className="h-px mx-2 my-1" style={{ background: '#e2e8f0' }} />
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-xs hover:bg-[#f1f5f9] flex items-center gap-2 transition-colors"
                style={{ color: '#475569' }}
                onClick={() => {
                  const currentAlt = editor.getAttributes('image').alt ?? ''
                  const alt = window.prompt('Edit alt text:', currentAlt)
                  if (alt !== null) {
                    editor.chain().focus().updateAttributes('image', { alt }).run()
                  }
                  setContextMenu(null)
                }}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
                Edit alt text
              </button>
            </>
          )}

          {editor.isActive('link') && (
            <>
              <div className="h-px mx-2 my-1" style={{ background: '#e2e8f0' }} />
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-xs hover:bg-[#fef2f2] flex items-center gap-2 transition-colors"
                style={{ color: '#dc2626' }}
                onClick={() => { editor.chain().focus().unsetLink().run(); setContextMenu(null) }}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" /><line x1="4" y1="4" x2="20" y2="20" /></svg>
                Remove link
              </button>
            </>
          )}
        </div>
      )}

      {/* Footer with counts */}
      <div className="flex items-center justify-end gap-4 px-4 py-2 text-xs rounded-b-lg" style={{ background: '#f8fafc', borderTop: '1px solid #cbd5e1', color: '#94a3b8' }}>
        <span>{wordCount} words</span>
        <span>{charCount} characters</span>
      </div>
    </div>
  )
}
