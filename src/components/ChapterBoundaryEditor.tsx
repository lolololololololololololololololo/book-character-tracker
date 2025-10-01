import { useState, useEffect } from 'react'
import { ChapterBoundary, Chapter } from '../types'
import ChapterBoundaryManager from './ChapterBoundaryManager'
import * as pdfjsLib from 'pdfjs-dist'

interface ChapterBoundaryEditorProps {
  file: File
  detectedChapters: ChapterBoundary[]
  totalPages: number
  onChaptersUpdated: (chapters: ChapterBoundary[]) => void
  onClose: () => void
}

export default function ChapterBoundaryEditor({
  file,
  detectedChapters,
  onChaptersUpdated,
  onClose
}: ChapterBoundaryEditorProps) {
  const [pdfDocument, setPdfDocument] = useState<any>(null)
  const [initialChapters, setInitialChapters] = useState<Chapter[]>([])
  
  console.log('ChapterBoundaryEditor rendered, pdfDocument:', !!pdfDocument, 'file:', file.name)

  useEffect(() => {
    console.log('ChapterBoundaryEditor useEffect triggered')
    loadPdfDocument()
    convertToChapters()
  }, [file, detectedChapters])

  const loadPdfDocument = async () => {
    try {
      console.log('Loading PDF document...', file.name, 'Type:', file.type, 'Size:', file.size)
      
      // Configure PDF.js worker if not already configured
      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
      }

      // Check if file is valid
      if (!file || file.size === 0) {
        throw new Error('PDF file is empty or corrupted')
      }

      const arrayBuffer = await file.arrayBuffer()
      console.log('PDF ArrayBuffer loaded, size:', arrayBuffer.byteLength)
      
      if (arrayBuffer.byteLength === 0) {
        throw new Error('PDF file contains no data')
      }
      
      const doc = await pdfjsLib.getDocument({
        data: arrayBuffer,
        verbosity: 0 // Reduce console noise
      }).promise
      
      console.log('PDF Document loaded, pages:', doc.numPages)
      
      setPdfDocument(doc)
    } catch (error) {
      console.error('Error loading PDF:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      // Provide more helpful error messages
      let userMessage = 'Failed to load PDF: ' + errorMessage
      if (errorMessage.includes('Invalid PDF structure') || errorMessage.includes('object can not be found')) {
        userMessage = 'The PDF file appears to be corrupted or invalid. Please try uploading the file again.'
      } else if (errorMessage.includes('empty') || errorMessage.includes('no data')) {
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
    const chapters: Chapter[] = detectedChapters.map((boundary, index) => ({
      index,
      title: `Chapter ${boundary.chapter}`,
      startPage: boundary.startPage,
      endPage: boundary.endPage,
      isComplete: Boolean(boundary.startPage && boundary.endPage)
    }))
    
    // If no chapters detected, create default ones
    if (chapters.length === 0) {
      chapters.push(
        { index: 0, title: 'Chapter 1', isComplete: false },
        { index: 1, title: 'Chapter 2', isComplete: false },
        { index: 2, title: 'Chapter 3', isComplete: false }
      )
    }
    
    setInitialChapters(chapters)
  }

  const handleChaptersUpdated = (chapters: Chapter[]) => {
    // Convert back to ChapterBoundary format
    const boundaries: ChapterBoundary[] = chapters
      .filter(chapter => chapter.startPage && chapter.endPage)
      .map((chapter, index) => ({
        chapter: index + 1,
        startPage: chapter.startPage!,
        endPage: chapter.endPage!
      }))
    
    onChaptersUpdated(boundaries)
  }

  const handleComplete = (chapters: Chapter[]) => {
    handleChaptersUpdated(chapters)
    onClose()
  }

  if (!pdfDocument) {
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
      <div className="h-full w-full" onClick={(e) => e.stopPropagation()}>
        <ChapterBoundaryManager
          pdfDocument={pdfDocument}
          initialChapters={initialChapters}
          onChaptersUpdated={handleChaptersUpdated}
          onComplete={handleComplete}
          onCancel={onClose}
        />
      </div>
    </div>
  )
}