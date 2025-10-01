import { useState, useEffect, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { ChapterBoundary } from '../types'

interface NewChapterBoundaryEditorProps {
  file: File
  detectedChapters: ChapterBoundary[]
  totalPages: number
  bookId?: string // Add book ID to help with debugging
  onChaptersUpdated: (chapters: ChapterBoundary[]) => Promise<void>
  onClose: () => void
}

interface ChapterEdit {
  id: number
  title: string
  startPage: number
  endPage: number
}

export default function NewChapterBoundaryEditor({
  file,
  detectedChapters,
  totalPages,
  bookId,
  onChaptersUpdated,
  onClose
}: NewChapterBoundaryEditorProps) {
  const [pdfDocument, setPdfDocument] = useState<any>(null)
  const [chapters, setChapters] = useState<ChapterEdit[]>([])
  const [selectedChapter, setSelectedChapter] = useState<number>(0)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load PDF document
  useEffect(() => {
    loadPDF()
  }, [file])

  // Initialize chapters from detected boundaries or create defaults
  useEffect(() => {
    if (detectedChapters.length > 0) {
      const initialChapters: ChapterEdit[] = detectedChapters.map((boundary, index) => ({
        id: index + 1,
        title: `Chapter ${index + 1}`,
        startPage: boundary.startPage,
        endPage: boundary.endPage
      }))
      setChapters(initialChapters)
    } else {
      // Create 3 default chapters
      const defaultChapters: ChapterEdit[] = [
        { id: 1, title: 'Chapter 1', startPage: 1, endPage: 10 },
        { id: 2, title: 'Chapter 2', startPage: 11, endPage: 20 },
        { id: 3, title: 'Chapter 3', startPage: 21, endPage: Math.min(30, totalPages) }
      ]
      setChapters(defaultChapters)
    }
  }, [detectedChapters, totalPages])

  const loadPDF = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Safari-compatible PDF.js worker setup
      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
        
        if (isSafari) {
          // Safari: Use a more reliable CDN and specific version
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js'
        } else {
          pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
        }
      }

      // Safari-compatible: Handle file reading with error checking
      let arrayBuffer: ArrayBuffer
      
      try {
        arrayBuffer = await file.arrayBuffer()
        
        if (arrayBuffer.byteLength === 0) {
          throw new Error('PDF file is empty')
        }
      } catch (fileError) {
        throw new Error(`Failed to read PDF file: ${fileError instanceof Error ? fileError.message : 'Unknown error'}`)
      }

      // Safari-compatible: Configure PDF.js with additional options
      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        verbosity: 0,
        maxImageSize: 1024 * 1024, // 1MB limit for Safari
        disableFontFace: false,
        disableRange: true, // Safari: Disable range requests
        disableStream: true // Safari: Disable streaming
      })
      
      const doc = await loadingTask.promise
      
      setPdfDocument(doc)
      setLoading(false)
    } catch (err) {
      if (console && console.error) {
        console.error('Error loading PDF:', err)
      }
      setError('Failed to load PDF file. Please try a smaller PDF file if using Safari.')
      setLoading(false)
    }
  }

  const updateChapter = (chapterId: number, field: 'title' | 'startPage' | 'endPage', value: string | number) => {
    setChapters(prev => {
      const updated = [...prev]
      
      // Find and update the current chapter
      const currentChapterIndex = updated.findIndex(c => c.id === chapterId)
      if (currentChapterIndex === -1) return updated
      
      updated[currentChapterIndex] = { 
        ...updated[currentChapterIndex], 
        [field]: value 
      }

      // Handle automatic sequencing when end page changes
      if (field === 'endPage' && typeof value === 'number') {
        const nextChapterIndex = currentChapterIndex + 1
        
        // Automatically set next chapter's start page
        if (nextChapterIndex < updated.length) {
          updated[nextChapterIndex] = {
            ...updated[nextChapterIndex],
            startPage: value + 1
          }
        }
      }

      // Handle automatic sequencing when start page changes
      if (field === 'startPage' && typeof value === 'number' && currentChapterIndex > 0) {
        const prevChapterIndex = currentChapterIndex - 1
        
        // Automatically set previous chapter's end page
        if (value > 1) {
          updated[prevChapterIndex] = {
            ...updated[prevChapterIndex],
            endPage: value - 1
          }
        }
      }

      return updated
    })
  }

  const addChapter = () => {
    const newId = Math.max(...chapters.map(c => c.id)) + 1
    const lastChapter = chapters[chapters.length - 1]
    const newStartPage = lastChapter ? lastChapter.endPage + 1 : 1
    
    setChapters(prev => [...prev, {
      id: newId,
      title: `Chapter ${newId}`,
      startPage: newStartPage,
      endPage: Math.min(newStartPage + 10, totalPages)
    }])
  }

  const removeChapter = (chapterId: number) => {
    if (chapters.length <= 1) {
      alert('You must have at least one chapter')
      return
    }
    
    setChapters(prev => prev.filter(c => c.id !== chapterId))
    
    // Update selected chapter if needed
    if (selectedChapter >= chapters.length - 1) {
      setSelectedChapter(Math.max(0, chapters.length - 2))
    }
  }

  const handleSave = async () => {
    // Safari-safe console logging
    if (console && console.log) {
      console.log('Editor: Starting save process...')
    }
    
    try {
      // Validate all chapters have valid page ranges
      const invalidChapters = chapters.filter(chapter => 
        !chapter.startPage || 
        !chapter.endPage || 
        chapter.startPage > chapter.endPage ||
        chapter.startPage < 1 ||
        chapter.endPage > totalPages
      )

      if (invalidChapters.length > 0) {
        const errorMessage = 'Please fix the following chapters:\n' + 
          invalidChapters.map(c => 
            `${c.title}: Invalid page range (${c.startPage}-${c.endPage})`
          ).join('\n')
        alert(errorMessage)
        return
      }

      // Check for overlapping chapters
      for (let i = 0; i < chapters.length - 1; i++) {
        const current = chapters[i]
        const next = chapters[i + 1]
        
        if (current.endPage >= next.startPage) {
          alert(`Chapter overlap detected: ${current.title} ends on page ${current.endPage} but ${next.title} starts on page ${next.startPage}`)
          return
        }
      }

      // Safari-compatible: Create boundaries array step by step
      const sortedChapters = [...chapters].sort((a, b) => a.startPage - b.startPage)
      const boundaries: ChapterBoundary[] = []
      
      for (let i = 0; i < sortedChapters.length; i++) {
        const chapter = sortedChapters[i]
        boundaries.push({
          chapter: i + 1,
          startPage: chapter.startPage,
          endPage: chapter.endPage
        })
      }
      
      if (console && console.log) {
        console.log('Editor: Saving chapter boundaries, count:', boundaries.length)
        console.log('Editor: Book ID:', bookId)
      }
      
      // Safari-compatible: Call update handler with proper error handling
      let saveSuccess = false
      let saveError = null
      
      try {
        await onChaptersUpdated(boundaries)
        saveSuccess = true
        
        if (console && console.log) {
          console.log('Editor: Chapter boundaries save completed successfully')
        }
        
      } catch (updateError) {
        saveError = updateError
        if (console && console.error) {
          console.error('Editor: Failed to save chapter boundaries:', updateError)
        }
      }
      
      if (saveSuccess) {
        // Safari-compatible: Add small delay before closing
        setTimeout(() => {
          onClose()
        }, 100)
      } else {
        const errorMessage = saveError instanceof Error ? saveError.message : 'Unknown error'
        alert(`Failed to save changes: ${errorMessage}. Please try refreshing the page and re-uploading your book.`)
      }
      
    } catch (mainError) {
      if (console && console.error) {
        console.error('Editor: Main save error:', mainError)
      }
      alert('An unexpected error occurred while saving. Please try again.')
    }
  }

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-xl">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span>Loading PDF...</span>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-xl max-w-md">
          <h3 className="text-lg font-semibold text-red-600 mb-2">Error</h3>
          <p className="text-gray-700 mb-4">{error}</p>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-gray-100 z-50">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Chapter Boundary Editor</h1>
              <p className="text-sm text-gray-600">Set where each chapter starts and ends</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save & Continue
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex">
          {/* Left Sidebar - Chapter List */}
          <div className="w-96 bg-white border-r border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Chapters</h2>
                <button
                  onClick={addChapter}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Add Chapter
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-3">
                {chapters.map((chapter, index) => (
                  <div
                    key={chapter.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedChapter === index
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => {
                      setSelectedChapter(index)
                      goToPage(chapter.startPage)
                    }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <input
                        type="text"
                        value={chapter.title}
                        onChange={(e) => updateChapter(chapter.id, 'title', e.target.value)}
                        className="font-medium text-gray-900 bg-transparent border-none outline-none p-0"
                        onClick={(e) => e.stopPropagation()}
                      />
                      {chapters.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            removeChapter(chapter.id)
                          }}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-600 w-16">Start:</label>
                        <input
                          type="number"
                          min="1"
                          max={totalPages}
                          value={chapter.startPage}
                          onChange={(e) => updateChapter(chapter.id, 'startPage', parseInt(e.target.value) || 1)}
                          className="w-20 px-2 py-1 text-sm border border-gray-300 rounded"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            goToPage(chapter.startPage)
                          }}
                          className="text-xs text-blue-600 hover:text-blue-700"
                        >
                          Go to
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-600 w-16">End:</label>
                        <input
                          type="number"
                          min="1"
                          max={totalPages}
                          value={chapter.endPage}
                          onChange={(e) => updateChapter(chapter.id, 'endPage', parseInt(e.target.value) || 1)}
                          className="w-20 px-2 py-1 text-sm border border-gray-300 rounded"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            goToPage(chapter.endPage)
                          }}
                          className="text-xs text-blue-600 hover:text-blue-700"
                        >
                          Go to
                        </button>
                      </div>
                    </div>

                    <div className="mt-2 text-xs text-gray-500">
                      Pages: {chapter.endPage - chapter.startPage + 1}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Side - PDF Viewer */}
          <div className="flex-1 bg-gray-50 flex flex-col">
            <PDFViewer
              pdfDocument={pdfDocument}
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// Simplified PDF Viewer Component for Reference
interface PDFViewerProps {
  pdfDocument: any
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

function PDFViewer({ pdfDocument, currentPage, totalPages, onPageChange }: PDFViewerProps) {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
  const [rendering, setRendering] = useState(false)

  const renderPage = useCallback(async () => {
    if (!canvas || !pdfDocument || rendering) return

    try {
      setRendering(true)
      const page = await pdfDocument.getPage(currentPage)
      const context = canvas.getContext('2d')!
      
      const viewport = page.getViewport({ scale: 1.2 })
      canvas.width = viewport.width
      canvas.height = viewport.height

      await page.render({
        canvasContext: context,
        viewport
      }).promise

      setRendering(false)
    } catch (error) {
      console.error('Error rendering page:', error)
      setRendering(false)
    }
  }, [canvas, pdfDocument, currentPage, rendering])

  useEffect(() => {
    renderPage()
  }, [renderPage])

  return (
    <div className="h-full flex flex-col">
      {/* PDF Controls */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 hover:bg-gray-50"
          >
            ← Previous
          </button>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Page</span>
            <input
              type="number"
              min="1"
              max={totalPages}
              value={currentPage}
              onChange={(e) => onPageChange(parseInt(e.target.value) || 1)}
              className="w-16 px-2 py-1 text-sm border border-gray-300 rounded text-center"
            />
            <span className="text-sm text-gray-600">of {totalPages}</span>
          </div>

          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 hover:bg-gray-50"
          >
            Next →
          </button>
        </div>
      </div>

      {/* PDF Display */}
      <div className="flex-1 overflow-auto p-4">
        <div className="flex justify-center">
          <div className="border border-gray-300 shadow-lg">
            <canvas
              ref={setCanvas}
              className={`block ${rendering ? 'opacity-50' : ''}`}
            />
          </div>
        </div>
      </div>
    </div>
  )
}