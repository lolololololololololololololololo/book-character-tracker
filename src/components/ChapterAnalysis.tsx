import { useState } from 'react'
import { Book, Character } from '../types'
import { pdfService, characterService } from '../db/services'
import { characterExtractionService } from '../services/characterExtraction'

interface ChapterAnalysisProps {
  book: Book
  onClose: () => void
  onCharactersUpdated: () => void
  isAnalyzing: boolean
  setIsAnalyzing: (analyzing: boolean) => void
}

export default function ChapterAnalysis({ 
  book, 
  onClose, 
  onCharactersUpdated,
  isAnalyzing,
  setIsAnalyzing
}: ChapterAnalysisProps) {
  const [analysisStep, setAnalysisStep] = useState('')
  const [extractedCharacters, setExtractedCharacters] = useState<Character[]>([])
  const [error, setError] = useState<string | null>(null)
  const [analysisComplete, setAnalysisComplete] = useState(false)

  const currentChapterBoundary = book.chapterBoundaries.find(
    boundary => boundary.chapter === book.currentChapter
  )

  const handleAnalyzeChapter = async () => {
    if (!currentChapterBoundary) {
      setError('Could not find chapter boundary information')
      return
    }

    setIsAnalyzing(true)
    setError(null)
    setAnalysisStep('')
    
    try {
      // Step 1: Validate and extract chapter text
      setAnalysisStep('Validating PDF and extracting text...')
      
      // Validate PDF blob before creating file
      if (!book.pdfBlob || book.pdfBlob.size === 0) {
        throw new Error('PDF file is not available. Please re-upload the book.')
      }
      
      // Test blob integrity
      try {
        const testChunk = book.pdfBlob.slice(0, 1024)
        await testChunk.arrayBuffer()
      } catch (blobError) {
        console.error('PDF blob corruption detected:', blobError)
        throw new Error('PDF file appears to be corrupted. Please re-upload the book.')
      }
      
      const file = new File([book.pdfBlob], book.fileName, { type: 'application/pdf' })
      const chapterText = await pdfService.extractChapterText(
        file, 
        currentChapterBoundary
      )

      if (chapterText.trim().length < 100) {
        throw new Error(
          `Chapter text is too short (${chapterText.trim().length} characters). ` +
          'This might be frontmatter, table of contents, or incorrect chapter boundaries. ' +
          'Please use "Edit Chapters" to adjust the chapter start page.'
        )
      }

      // Step 2: Send to Gemini API
      setAnalysisStep('Analyzing characters with AI...')
      const characters = await characterExtractionService.extractCharacters(
        book.id,
        book.currentChapter,
        chapterText
      )

      // Step 3: Save to database
      setAnalysisStep('Saving character data...')
      await characterService.saveCharacters(book.id, characters)

      setExtractedCharacters(characters)
      setAnalysisStep('Analysis complete!')
      setAnalysisComplete(true)
      
      // Notify parent to refresh character data
      onCharactersUpdated()

    } catch (err) {
      console.error('Analysis error:', err)
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleClose = () => {
    if (!isAnalyzing) {
      pdfService.cleanup()
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Analyze Chapter</h2>
            <p className="text-sm text-gray-600 mt-1">
              Chapter {book.currentChapter} of "{book.title}"
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={isAnalyzing}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {!analysisComplete && !error && (
            <div className="text-center">
              <div className="mb-6">
                <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Chapter Analysis
                </h3>
                <p className="text-gray-600 text-sm mb-6">
                  This will extract character information from Chapter {book.currentChapter} using AI analysis. 
                  Only characters mentioned 2 or more times will be included.
                </p>
              </div>

              {isAnalyzing ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
                  </div>
                  <p className="text-blue-600 font-medium">{analysisStep}</p>
                  <p className="text-gray-500 text-sm">
                    This may take 10-20 seconds...
                  </p>
                </div>
              ) : (
                <button
                  onClick={handleAnalyzeChapter}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium transition-colors"
                >
                  Start Analysis
                </button>
              )}
            </div>
          )}

          {error && (
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-red-900 mb-2">Analysis Failed</h3>
              <p className="text-red-700 text-sm mb-6">{error}</p>
              <div className="space-x-3">
                <button
                  onClick={handleAnalyzeChapter}
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-md font-medium transition-colors"
                >
                  Try Again
                </button>
                <button
                  onClick={handleClose}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-6 py-2 rounded-md font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {analysisComplete && (
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-green-900 mb-2">Analysis Complete!</h3>
              
              {extractedCharacters.length > 0 ? (
                <div>
                  <p className="text-green-700 text-sm mb-4">
                    Found {extractedCharacters.length} character{extractedCharacters.length !== 1 ? 's' : ''} in this chapter
                  </p>
                  
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 text-left">
                    <h4 className="font-medium text-green-900 mb-2">Characters discovered:</h4>
                    <ul className="space-y-1">
                      {extractedCharacters.map((character, index) => (
                        <li key={index} className="text-sm text-green-800">
                          • <span className="font-medium">{character.name}</span>
                          {character.briefDescription && (
                            <span className="text-green-600"> - {character.briefDescription}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <p className="text-gray-600 text-sm mb-4">
                  No new characters found in this chapter that meet the criteria (mentioned 2+ times).
                </p>
              )}

              <button
                onClick={handleClose}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </div>

        {/* Footer Info */}
        {!isAnalyzing && (
          <div className="px-6 py-4 bg-gray-50 border-t text-xs text-gray-500">
            <p>
              <strong>Note:</strong> This analysis requires an internet connection and may take 10-20 seconds. 
              Character data will be saved locally and available offline afterward.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}