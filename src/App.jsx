import { useState, useMemo, useEffect } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import './App.css'

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

const API_URL = import.meta.env.VITE_API_URL

function Starfield() {
  const stars = useMemo(() => {
    return Array.from({ length: 80 }).map((_, i) => ({
      id: i,
      top: Math.random() * 100,
      left: Math.random() * 100,
      size: Math.random() * 2 + 1,
      duration: Math.random() * 6 + 4,
      delay: Math.random() * 5,
    }))
  }, [])

  return (
    <div className="starfield">
      {stars.map(star => (
        <div
          key={star.id}
          className="star"
          style={{
            top: `${star.top}%`,
            left: `${star.left}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            animationDuration: `${star.duration}s`,
            animationDelay: `${star.delay}s`,
          }}
        />
      ))}
    </div>
  )
}

function PDFViewer({ filename, panelWidth }) {
  const [numPages, setNumPages] = useState(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [selectionPopup, setSelectionPopup] = useState(null)
  const [selectionRects, setSelectionRects] = useState(null)
  const [annotations, setAnnotations] = useState([])

  useEffect(() => {
    if (!filename) return

    fetch(`${API_URL}/annotations/${filename}`)
      .then(res => res.json())
      .then(data => setAnnotations(data))
      .catch(err => console.error('Failed to load annotations:', err))
  }, [filename])

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages)
    setPageNumber(1)
  }

  const handleMouseUp = () => {
    const selection = window.getSelection()
    const text = selection.toString().trim()

    if (!text) {
      setSelectionPopup(null)
      setSelectionRects(null)
      return
    }

    const pageEl = document.querySelector('.react-pdf__Page')
    if (!pageEl) return
    const pageBox = pageEl.getBoundingClientRect()

    const range = selection.getRangeAt(0)

    const rects = Array.from(range.getClientRects()).map(rect => ({
      x: rect.left - pageBox.left,
      y: rect.top - pageBox.top,
      width: rect.width,
      height: rect.height
    }))

    const popupRect = range.getBoundingClientRect()
    setSelectionPopup({
      text,
      x: popupRect.left + popupRect.width / 2,
      y: popupRect.top
    })
    setSelectionRects(rects)
  }

  const handleHighlightClick = () => {
    const text = selectionPopup.text
    const page = pageNumber
    const rects = selectionRects

    fetch(`${API_URL}/annotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: filename,
        page_number: page,
        highlighted_text: text,
        note: '',
        position_data: JSON.stringify(rects)
      })
    })
      .then(res => res.json())
      .then(data => {
        setAnnotations(prev => [...prev, {
          id: data.id,
          filename,
          page_number: page,
          highlighted_text: text,
          note: '',
          position_data: JSON.stringify(rects)
        }])
      })
      .catch(err => console.error('Failed to save annotation:', err))

    setSelectionPopup(null)
    setSelectionRects(null)
    window.getSelection().removeAllRanges()
  }

  if (!filename) return null

  const currentPageAnnotations = annotations.filter(a => a.page_number === pageNumber)

  return (
    <div className="pdf-viewer" style={{ width: panelWidth }} onMouseUp={handleMouseUp}>
      <div className="pdf-page-wrapper">
        <Document
          file={`${API_URL}/pdf/${filename}`}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={<div className="pdf-loading">Loading PDF...</div>}
        >
          <Page pageNumber={pageNumber} width={panelWidth - 40} />
        </Document>

        <div className="highlight-overlay">
          {currentPageAnnotations.map(a => {
            let rects = []
            try {
              rects = JSON.parse(a.position_data || '[]')
            } catch {
              rects = []
            }
            return rects.map((r, i) => (
              <div
                key={`${a.id}_${i}`}
                className="highlight-mark"
                style={{
                  left: r.x,
                  top: r.y,
                  width: r.width,
                  height: r.height
                }}
                title={a.note || a.highlighted_text}
              />
            ))
          })}
        </div>
      </div>

      {numPages && (
        <div className="pdf-controls">
          <button
            onClick={() => setPageNumber(p => Math.max(1, p - 1))}
            disabled={pageNumber <= 1}
          >
            ← Prev
          </button>
          <span>Page {pageNumber} of {numPages}</span>
          <button
            onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
            disabled={pageNumber >= numPages}
          >
            Next →
          </button>
        </div>
      )}

      {selectionPopup && (
        <div
          className="highlight-popup"
          style={{ left: selectionPopup.x, top: selectionPopup.y - 40 }}
        >
          <button onClick={handleHighlightClick}>🖍 Highlight</button>
        </div>
      )}
    </div>
  )
}

function App() {
  const [question, setQuestion] = useState('')
  const [messagesByFile, setMessagesByFile] = useState({})
  const [uploadStatus, setUploadStatus] = useState('')
  const [uploadedFiles, setUploadedFiles] = useState([])
  const [selectedFile, setSelectedFile] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [summary, setSummary] = useState(null)
  const [pdfPanelWidth, setPdfPanelWidth] = useState(650)
  const [isDragging, setIsDragging] = useState(false)

  const messages = messagesByFile[selectedFile] || []

  useEffect(() => {
    if (!selectedFile) {
      setSummary(null)
      return
    }

    fetch(`${API_URL}/summary/${selectedFile}`)
      .then(res => res.json())
      .then(data => setSummary(data.summary ? data : null))
      .catch(() => setSummary(null))
  }, [selectedFile])

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return
      const newWidth = e.clientX - 220
      const clamped = Math.min(Math.max(newWidth, 300), 1000)
      setPdfPanelWidth(clamped)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  const handleUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)

    setUploadStatus('Uploading...')

    fetch(`${API_URL}/upload`, {
      method: 'POST',
      body: formData
    })
      .then(async response => {
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.detail || 'Upload failed')
        }
        return data
      })
      .then(data => {
        setUploadStatus(`✓ ${data.filename} (${data.chunks_created} chunks)`)
        setUploadedFiles(prev => {
          if (prev.includes(data.filename)) return prev
          return [...prev, data.filename]
        })
        setMessagesByFile(prev => ({ ...prev, [data.filename]: prev[data.filename] || [] }))
        setSelectedFile(data.filename)
      })
      .catch(error => setUploadStatus(`✗ ${error.message}`))
  }

  const handleDeleteDocument = () => {
    if (!selectedFile) return

    const fileToDelete = selectedFile

    fetch(`${API_URL}/document/${encodeURIComponent(fileToDelete)}`, {
      method: 'DELETE'
    })
      .then(async response => {
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.detail || 'Delete failed')
        }
        return data
      })
      .then(() => {
        const remaining = uploadedFiles.filter(f => f !== fileToDelete)

        setUploadedFiles(remaining)

        setMessagesByFile(prev => {
          const updated = { ...prev }
          delete updated[fileToDelete]
          return updated
        })

        setSelectedFile(remaining.length > 0 ? remaining[0] : '')
        setUploadStatus('')
      })
      .catch(error => setUploadStatus(`✗ ${error.message}`))
  }

  const handleSubmit = async () => {
    if (!selectedFile || !question.trim()) return

    const userQuestion = question
    setQuestion('')
    setIsLoading(true)

    const history = (messagesByFile[selectedFile] || []).map(msg => ({
      role: msg.role,
      content: msg.text
    }))

    setMessagesByFile(prev => ({
      ...prev,
      [selectedFile]: [...(prev[selectedFile] || []), { role: 'user', text: userQuestion }]
    }))

    setMessagesByFile(prev => ({
      ...prev,
      [selectedFile]: [...prev[selectedFile], { role: 'assistant', text: '', sources: [] }]
    }))

    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userQuestion, filename: selectedFile, history: history })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Something went wrong')
      }

      setIsLoading(false)

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        const parts = buffer.split('\n\n')
        buffer = parts.pop()

        for (const part of parts) {
          if (!part.startsWith('data: ')) continue
          const jsonStr = part.slice(6)
          const event = JSON.parse(jsonStr)

          if (event.type === 'answer_chunk') {
            setMessagesByFile(prev => {
              const current = [...prev[selectedFile]]
              const lastMsg = current[current.length - 1]
              current[current.length - 1] = { ...lastMsg, text: lastMsg.text + event.text }
              return { ...prev, [selectedFile]: current }
            })
          } else if (event.type === 'done') {
            setMessagesByFile(prev => {
              const current = [...prev[selectedFile]]
              const lastMsg = current[current.length - 1]
              current[current.length - 1] = { ...lastMsg, sources: event.sources }
              return { ...prev, [selectedFile]: current }
            })
          } else if (event.type === 'error') {
            setMessagesByFile(prev => {
              const current = [...prev[selectedFile]]
              const lastMsg = current[current.length - 1]
              current[current.length - 1] = { ...lastMsg, text: `⚠️ ${event.message}` }
              return { ...prev, [selectedFile]: current }
            })
          }
        }
      }
    } catch (error) {
      setIsLoading(false)
      setMessagesByFile(prev => {
        const current = [...prev[selectedFile]]
        current[current.length - 1] = { role: 'assistant', text: `⚠️ ${error.message}`, sources: [] }
        return { ...prev, [selectedFile]: current }
      })
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit()
  }

  return (
    <>
      <Starfield />
      <div className="app">
        <div className="sidebar">
          <h1>Chat with PDFs</h1>

          <div className="upload-box">
            <label className="upload-label">
              Upload PDF
              <input type="file" accept="application/pdf" onChange={handleUpload} hidden />
            </label>
            {uploadStatus && <p className="upload-status">{uploadStatus}</p>}
          </div>

          {uploadedFiles.length > 0 && (
            <div className="doc-list">
              <p className="doc-list-title">Documents</p>
              {uploadedFiles.map(filename => (
                <button
                  key={filename}
                  className={`doc-item ${filename === selectedFile ? 'active' : ''}`}
                  onClick={() => setSelectedFile(filename)}
                >
                  {filename}
                </button>
              ))}
            </div>
          )}

          {selectedFile && (
            <button className="delete-btn" onClick={handleDeleteDocument}>
              Remove "{selectedFile}"
            </button>
          )}
        </div>

        <div className="main-content">
          <PDFViewer filename={selectedFile} panelWidth={pdfPanelWidth} />

          <div
            className="divider"
            onMouseDown={() => setIsDragging(true)}
          />

          <div className="chat-area">
            {summary && (
              <div className="summary-card">
                <p className="summary-text">{summary.summary}</p>
                <div className="summary-topics">
                  {summary.topics.map((topic, i) => (
                    <span key={i} className="topic-tag">{topic}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="messages" key={selectedFile}>
              {messages.length === 0 && (
                <div className="empty-state">
                  {selectedFile
                    ? `Ask a question about ${selectedFile}`
                    : 'Upload a PDF to get started'}
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={`message ${msg.role}`}>
                  <div className="bubble">
                    {msg.text}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="sources">
                        Sourced from page(s): {msg.sources.map(p => p + 1).join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="message assistant">
                  <div className="bubble loading">Thinking...</div>
                </div>
              )}
            </div>

            <div className="input-bar">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={selectedFile ? "Ask a question..." : "Upload a PDF first"}
                disabled={!selectedFile}
              />
              <button onClick={handleSubmit} disabled={!selectedFile || !question.trim()}>
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default App