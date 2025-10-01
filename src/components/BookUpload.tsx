import { useState } from 'react'
import { Book, ChapterBoundary } from '../types'
import { bookService, pdfService } from '../db/services'
import ChapterBoundaryEditor from './ChapterBoundaryEditor'

interface BookUploadProps {
  onBookAdded: (book: Book) => void
  onCancel: () => void
  setIsUploading: (uploading: boolean) => void
}

export default function BookUpload({ onBookAdded, onCancel, setIsUploading }: BookUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStep, setProcessingStep] = useState('')
  const [detectedChapters, setDetectedChapters] = useState<ChapterBoundary[]>([])
  const [manualMode, setManualMode] = useState(false)
  const [manualChapterCount, setManualChapterCount] = useState(10)
  const [showChapterEditor, setShowChapterEditor] = useState(false)
  const [totalPages, setTotalPages] = useState(0)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile)
      // Auto-fill title from filename
      const fileName = selectedFile.name.replace('.pdf', '')
      if (!title) {
        setTitle(fileName)
      }
    } else {
      alert('Please select a valid PDF file')
    }
  }

  const handleProcessFile = async () => {
    if (!file || !title.trim() || !author.trim()) {
      alert('Please fill in all fields and select a PDF file')
      return
    }

    setIsProcessing(true)
    setIsUploading(true)
    
    try {
      setProcessingStep('Analyzing PDF structure...')
      const { chapterBoundaries, totalPages: pages } = await pdfService.processBookFile(file)
      setTotalPages(pages)
      
      if (chapterBoundaries.length > 0) {
        setDetectedChapters(chapterBoundaries)
        setProcessingStep(`Detected ${chapterBoundaries.length} chapters - Review boundaries`)
        setShowChapterEditor(true)
        setIsProcessing(false)
      } else {
        // Failed to detect chapters
        setProcessingStep('Could not detect chapters automatically')
        setManualMode(true)
        setManualChapterCount(Math.max(1, Math.floor(pages / 20))) // Estimate
        setIsProcessing(false)
      }
    } catch (error) {
      console.error('Error processing file:', error)
      alert('Failed to process PDF file. Please try again.')
      setIsProcessing(false)
      setIsUploading(false)
    }
  }

  const createManualChapters = (chapterCount: number, totalPages: number): ChapterBoundary[] => {
    const pagesPerChapter = Math.floor(totalPages / chapterCount)
    const chapters: ChapterBoundary[] = []
    
    for (let i = 0; i < chapterCount; i++) {
      const startPage = i * pagesPerChapter + 1
      const endPage = i === chapterCount - 1 ? totalPages : (i + 1) * pagesPerChapter
      
      chapters.push({
        chapter: i + 1,
        startPage,
        endPage
      })
    }
    
    return chapters
  }

  const handleManualSubmit = async () => {
    if (!file) return
    
    setIsProcessing(true)
    
    try {
      const manualChapters = createManualChapters(manualChapterCount, totalPages)
      await createBook(manualChapters)
    } catch (error) {
      console.error('Error creating manual chapters:', error)
      alert('Failed to create book. Please try again.')
      setIsProcessing(false)
    }
  }

  const handleChapterBoundariesUpdated = async (updatedChapters: ChapterBoundary[]) => {
    setDetectedChapters(updatedChapters)
    await createBook(updatedChapters)
  }

  const createBook = async (chapters: ChapterBoundary[]) => {
    if (!file) return
    
    try {
      setProcessingStep('Saving book to library...')
      
      const newBook = await bookService.createBook(
        file,
        title.trim(),
        author.trim(),
        chapters
      )
      
      setProcessingStep('Book added successfully!')
      onBookAdded(newBook)
      
    } catch (error) {
      console.error('Error creating book:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      if (errorMessage.includes('already exists')) {
        alert(`A book with the filename "${file.name}" already exists in your library. Please rename the file or delete the existing book first.`)
      } else if (errorMessage.includes('ConstraintError') || errorMessage.includes('AbortError')) {
        alert(
          `Database constraint error occurred. This might be due to duplicate data. ` +
          `Please refresh the page and try again. If the problem persists, the database may need to be reset.`
        )
      } else {
        alert('Failed to save book: ' + errorMessage)
      }
    } finally {
      setIsProcessing(false)
      setIsUploading(false)
      pdfService.cleanup()
    }
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Upload New Book</h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isProcessing}
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

      {!manualMode ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              PDF File
            </label>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isProcessing}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Book Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter book title"
              disabled={isProcessing}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Author
            </label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter author name"
              disabled={isProcessing}
            />
          </div>

          {isProcessing && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <div className="flex items-center">
                <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full mr-3"></div>
                <span className="text-blue-800">{processingStep}</span>
              </div>
            </div>
          )}

          {detectedChapters.length > 0 && !isProcessing && (
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-800 font-medium">
                    ✓ Detected {detectedChapters.length} chapters
                  </p>
                  <p className="text-green-600 text-sm mt-1">
                    Review and adjust chapter boundaries to ensure accuracy
                  </p>
                </div>
                <button
                  onClick={() => setShowChapterEditor(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                >
                  Review Chapters
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleProcessFile}
              disabled={!file || !title.trim() || !author.trim() || isProcessing}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-2 px-4 rounded-md transition-colors font-medium"
            >
              {isProcessing ? 'Processing...' : 'Upload Book'}
            </button>
            <button
              onClick={onCancel}
              disabled={isProcessing}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <p className="text-yellow-800 font-medium">Manual Chapter Setup</p>
            <p className="text-yellow-700 text-sm mt-1">
              Automatic chapter detection failed or found unusual results. Please specify the number of chapters manually.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Number of Chapters
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={manualChapterCount}
              onChange={(e) => setManualChapterCount(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isProcessing}
            />
            <p className="text-sm text-gray-600 mt-1">
              Pages will be divided equally among chapters
            </p>
          </div>

          {isProcessing && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <div className="flex items-center">
                <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full mr-3"></div>
                <span className="text-blue-800">{processingStep}</span>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleManualSubmit}
              disabled={isProcessing}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-2 px-4 rounded-md transition-colors font-medium"
            >
              {isProcessing ? 'Creating...' : 'Create Book'}
            </button>
            <button
              onClick={() => setManualMode(false)}
              disabled={isProcessing}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
            >
              Back
            </button>
          </div>
        </div>
      )}
      </div>

      {/* Chapter Boundary Editor */}
      {showChapterEditor && file && (
        <ChapterBoundaryEditor
          file={file}
          detectedChapters={detectedChapters}
          totalPages={totalPages}
          onChaptersUpdated={handleChapterBoundariesUpdated}
          onClose={() => setShowChapterEditor(false)}
        />
      )}
    </>
  )
}