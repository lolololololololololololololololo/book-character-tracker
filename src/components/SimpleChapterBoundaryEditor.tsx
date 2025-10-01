import { useState, useEffect } from 'react'
import { ChapterBoundary, Chapter } from '../types'
import ChapterSidebar from './ChapterSidebar'
import SimplePDFViewer from './SimplePDFViewer'
import '../utils/chapterDebugger' // Import debugger for development

interface SimpleChapterBoundaryEditorProps {
  file: File
  detectedChapters: ChapterBoundary[]
  totalPages: number
  onChaptersUpdated: (chapters: ChapterBoundary[]) => void
  onClose: () => void
}

export default function SimpleChapterBoundaryEditor({
  file,
  detectedChapters,
  onChaptersUpdated,
  onClose
}: SimpleChapterBoundaryEditorProps) {
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)

  const [chapters, setChapters] = useState<Chapter[]>([])
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  console.log('SimpleChapterBoundaryEditor rendered, file:', file.name)

  useEffect(() => {
    console.log('SimpleChapterBoundaryEditor useEffect triggered')
    loadPdfBlob()
    convertToChapters()
  }, [file, detectedChapters])

  const loadPdfBlob = async () => {
    try {
      console.log('Loading PDF blob...', file.name, 'Type:', file.type, 'Size:', file.size)
      
      // Check if file is valid
      if (!file || file.size === 0) {
        throw new Error('PDF file is empty or corrupted')
      }

      // Create a blob from the file
      const blob = new Blob([await file.arrayBuffer()], { type: 'application/pdf' })
      console.log('PDF Blob created, size:', blob.size)
      
      if (blob.size === 0) {
        throw new Error('PDF file contains no data')
      }
      
      setPdfBlob(blob)
      setIsLoading(false)
    } catch (error) {
      console.error('Error loading PDF:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      // Provide more helpful error messages
      let userMessage = 'Failed to load PDF: ' + errorMessage
      if (errorMessage.includes('empty') || errorMessage.includes('no data')) {
        userMessage = 'The PDF file appears to be empty or corrupted. Please check the file and try again.'
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        userMessage = 'Network error loading PDF. Please check your connection and try again.'
      }
      
      alert(userMessage)
      // Close the editor on error
      onClose()
    }
  }

  const convertToChapters = () => {
    console.log('Converting detected chapters to editor format:', detectedChapters)
    
    const chapters: Chapter[] = detectedChapters.map((boundary, index) => ({
      index,
      title: `Chapter ${boundary.chapter}`,
      startPage: boundary.startPage,
      endPage: boundary.endPage,
      isComplete: Boolean(boundary.startPage && boundary.endPage)
    }))
    
    // If no chapters detected, create default ones
    if (chapters.length === 0) {
      console.log('No chapters detected, creating default chapters')
      chapters.push(
        { index: 0, title: 'Chapter 1', isComplete: false },
        { index: 1, title: 'Chapter 2', isComplete: false },
        { index: 2, title: 'Chapter 3', isComplete: false }
      )
    }
    
    console.log('Converted chapters:', chapters)
    setChapters(chapters)
  }

  const handleAddChapter = () => {
    const newChapter: Chapter = {
      index: chapters.length,
      title: `Chapter ${chapters.length + 1}`,
      isComplete: false
    }
    setChapters(prev => [...prev, newChapter])
  }

  const handleRemoveChapter = (chapterIndex: number) => {
    if (chapters.length <= 1) {
      alert('You must have at least one chapter')
      return
    }

    const chapterToDelete = chapters[chapterIndex]
    const confirmDelete = confirm(
      `Are you sure you want to delete "${chapterToDelete.title}"?\n\n` +
      'This will remove the chapter and renumber all following chapters.'
    )
    
    if (!confirmDelete) {
      return
    }

    setChapters(prev => {
      const updated = prev.filter((_, index) => index !== chapterIndex)
      // Reindex chapters and update titles
      return updated.map((chapter, index) => ({
        ...chapter,
        index,
        title: chapter.title.includes('Chapter') ? `Chapter ${index + 1}` : chapter.title
      }))
    })

    // Update selected chapter if it was removed
    if (selectedChapter === chapterIndex) {
      setSelectedChapter(null)
    } else if (selectedChapter !== null && selectedChapter > chapterIndex) {
      setSelectedChapter(selectedChapter - 1)
    }
    
    // Show success message
    alert(`Chapter "${chapterToDelete.title}" has been deleted. Remember to save your changes!`)
  }

  const handleChapterTitleChange = (chapterIndex: number, title: string) => {
    setChapters(prev => prev.map((chapter, index) => 
      index === chapterIndex 
        ? { ...chapter, title }
        : chapter
    ))
  }

  const handleChapterSelect = (chapterIndex: number) => {
    setSelectedChapter(chapterIndex)
  }

  const handleChapterBoundarySet = (chapterIndex: number, type: 'start' | 'end', pageNumber: number) => {
    setChapters(prev => {
      const updated = [...prev]
      
      if (type === 'start') {
        // Validate that start page is not after existing end page
        if (updated[chapterIndex].endPage && pageNumber > updated[chapterIndex].endPage!) {
          alert(`Start page (${pageNumber}) cannot be after end page (${updated[chapterIndex].endPage})`)
          return prev
        }
        
        updated[chapterIndex] = {
          ...updated[chapterIndex],
          startPage: pageNumber
        }
      } else if (type === 'end') {
        // Validate that end page is not before existing start page
        if (updated[chapterIndex].startPage && pageNumber < updated[chapterIndex].startPage!) {
          alert(`End page (${pageNumber}) cannot be before start page (${updated[chapterIndex].startPage})`)
          return prev
        }
        
        updated[chapterIndex] = {
          ...updated[chapterIndex],
          endPage: pageNumber
        }

        // Automatically set the next chapter's start page if it doesn't have one
        if (chapterIndex < updated.length - 1 && !updated[chapterIndex + 1].startPage) {
          const nextChapterIndex = chapterIndex + 1
          updated[nextChapterIndex] = {
            ...updated[nextChapterIndex],
            startPage: pageNumber + 1
          }
        }
      }

      // Update completion status
      updated[chapterIndex] = {
        ...updated[chapterIndex],
        isComplete: Boolean(updated[chapterIndex].startPage && updated[chapterIndex].endPage)
      }

      return updated
    })
  }

  const handleChaptersUpdated = (updatedChapters: Chapter[]) => {
    // Convert back to ChapterBoundary format
    // Include all chapters that have at least a start page (more flexible)
    const boundaries: ChapterBoundary[] = updatedChapters
      .filter(chapter => chapter.startPage) // Only need start page minimum
      .map((chapter, index) => ({
        chapter: index + 1,
        startPage: chapter.startPage!,
        endPage: chapter.endPage || chapter.startPage! // Use start page as end if no end page set
      }))
    
    console.log('Saving chapter boundaries:', boundaries)
    onChaptersUpdated(boundaries)
  }

  const handleSave = () => {
    // Save current changes without requiring completion
    const validChapters = chapters.filter(chapter => chapter.startPage)
    
    if (validChapters.length === 0) {
      alert('Please set at least one chapter start page before saving.')
      return
    }

    console.log('Saving chapters:', chapters.map(c => ({ title: c.title, start: c.startPage, end: c.endPage })))
    handleChaptersUpdated(chapters)
    
    const completeChapters = chapters.filter(c => c.startPage && c.endPage).length
    const incompleteChapters = validChapters.length - completeChapters
    
    let message = `Saved ${validChapters.length} chapter boundaries successfully!`
    if (incompleteChapters > 0) {
      message += `\n\nNote: ${incompleteChapters} chapter${incompleteChapters > 1 ? 's' : ''} still need end pages.`
    }
    
    alert(message)
  }

  const handleComplete = () => {
    // Validate that all chapters have at least start pages
    const incompleteChapters = chapters.filter(chapter => !chapter.startPage)
    
    if (incompleteChapters.length > 0) {
      const chapterNames = incompleteChapters.map(c => c.title).join(', ')
      
      const confirmSave = confirm(
        `Some chapters are incomplete (${chapterNames}). ` +
        'Do you want to save the current progress and continue?'
      )
      
      if (!confirmSave) {
        return
      }
    }

    handleChaptersUpdated(chapters)
    onClose()
  }

  const getCompletionStats = () => {
    const complete = chapters.filter(c => c.isComplete).length
    const withStart = chapters.filter(c => c.startPage).length
    return { complete, withStart, total: chapters.length }
  }

  // Show loading state while PDF is loading
  if (isLoading || !pdfBlob) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
          <div className="flex items-center justify-center mb-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-700">Loading PDF...</span>
          </div>
          <div className="text-center text-sm text-gray-500">
            <p>Preparing chapter editor...</p>
            <p className="mt-2">File: {file.name}</p>
          </div>
          <button
            onClick={onClose}
            className="mt-4 w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  const stats = getCompletionStats()

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50"
      onClick={(e) => {
        // Only close if clicking the overlay background
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div className="h-full w-full flex" onClick={(e) => e.stopPropagation()}>
        {/* Sidebar */}
        <ChapterSidebar
          chapters={chapters}
          selectedChapter={selectedChapter}
          onChapterSelect={handleChapterSelect}
          onAddChapter={handleAddChapter}
          onRemoveChapter={handleRemoveChapter}
          onChapterTitleChange={handleChapterTitleChange}
        />

        {/* Main Content */}
        <div className="flex-1 flex flex-col bg-gray-100">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Chapter Boundary Editor</h1>
                <p className="text-sm text-gray-600 mt-1">
                  Define where each chapter starts and ends in your PDF
                </p>
              </div>
              
              <div className="flex items-center gap-4">
                {/* Progress Stats */}
                <div className="text-sm text-gray-600">
                  <span className="font-medium">{stats.complete}</span> complete, 
                  <span className="font-medium ml-1">{stats.withStart}</span> with start pages
                  <span className="ml-1">of {stats.total} chapters</span>
                  
                  {/* Debug button */}
                  <button
                    onClick={() => {
                      console.log('=== CHAPTER DEBUG INFO ===')
                      console.log('Current chapters in editor:', chapters)
                      console.log('Detected chapters from props:', detectedChapters)
                      if ((window as any).chapterDebugger) {
                        (window as any).chapterDebugger.listAllBooks()
                      }
                    }}
                    className="ml-4 px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200"
                    title="Debug chapter state"
                  >
                    🐛 Debug
                  </button>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  
                  <button
                    onClick={handleSave}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Save Changes
                  </button>
                  
                  <button
                    onClick={() => {
                      handleSave()
                      setTimeout(() => {
                        onClose()
                        // Force page refresh to ensure changes are reflected
                        window.location.reload()
                      }, 500)
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    Save & Close
                  </button>
                  
                  <button
                    onClick={handleComplete}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Save & Continue
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* PDF Viewer */}
          <div className="flex-1">
            <SimplePDFViewer
              pdfBlob={pdfBlob}
              chapters={chapters}
              selectedChapter={selectedChapter}
              onChapterBoundarySet={handleChapterBoundarySet}
            />
          </div>
        </div>
      </div>
    </div>
  )
}