import { useState, useEffect } from 'react'
import { Book, Character, ChapterBoundary } from '../types'
import CytoscapeCharacterMap from './CytoscapeCharacterMap'
import CharacterDetail from './CharacterDetail'
import ChapterAnalysis from './ChapterAnalysis'
import NewChapterBoundaryEditor from './NewChapterBoundaryEditor'
import { characterService, bookService } from '../db/services'

interface MainAppProps {
  book: Book
  onBackToLibrary: () => void
  onBookUpdated: () => void
}

export default function MainApp({ book, onBackToLibrary, onBookUpdated }: MainAppProps) {
  const [characters, setCharacters] = useState<Character[]>([])
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null)
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [showChapterEditor, setShowChapterEditor] = useState(false)
  const [analyzedChapters, setAnalyzedChapters] = useState<Set<number>>(new Set())

  useEffect(() => {
    loadCharacters()
  }, [book.id, book.currentChapter])

  const loadCharacters = async () => {
    try {
      const bookCharacters = await characterService.getCharactersUpToChapter(
        book.id, 
        book.currentChapter
      )
      setCharacters(bookCharacters)
      
      // Load analyzed chapters status
      const analyzed = await characterService.getAnalyzedChapters(book.id)
      setAnalyzedChapters(analyzed)
    } catch (error) {
      console.error('Error loading characters:', error)
    }
  }

  const handleChapterChange = async (newChapter: number) => {
    if (newChapter < 1 || newChapter > book.totalChapters) return
    
    try {
      await bookService.updateBookChapter(book.id, newChapter)
      onBookUpdated() // This will update the book object in parent
      
      // Load characters up to new chapter
      const updatedCharacters = await characterService.getCharactersUpToChapter(
        book.id, 
        newChapter
      )
      setCharacters(updatedCharacters)
    } catch (error) {
      console.error('Error updating chapter:', error)
    }
  }

  const handleCharacterSelect = (character: Character) => {
    setSelectedCharacter(character)
  }

  const handleCharactersUpdated = () => {
    loadCharacters() // This now includes analyzed chapters status
  }

  const handleChapterBoundariesUpdated = async (updatedChapters: ChapterBoundary[]) => {
    try {
      if (console && console.log) {
        console.log('MainApp: Updating chapter boundaries for book ID:', book.id)
        console.log('MainApp: New boundaries count:', updatedChapters.length)
      }
      
      // Import integrity checker
      const { DatabaseIntegrityChecker } = await import('../utils/databaseIntegrityChecker')
      
      // CRITICAL: Clean up duplicates BEFORE any operation
      if (console && console.log) {
        console.log('MainApp: Cleaning duplicates before chapter boundary update...')
      }
      
      try {
        await bookService.removeDuplicateBooks()
      } catch (cleanupError) {
        if (console && console.warn) {
          console.warn('MainApp: Duplicate cleanup failed:', cleanupError)
        }
      }
      
      // Wait for any pending database operations to settle
      await DatabaseIntegrityChecker.waitForDatabaseSettle()
      
      // Check database health first
      const isHealthy = await DatabaseIntegrityChecker.checkDatabaseHealth()
      if (!isHealthy) {
        if (console && console.warn) {
          console.warn('MainApp: Database health check failed, attempting to continue...')
        }
      }
      
      // Verify the book exists using the integrity checker
      let existingBook = await DatabaseIntegrityChecker.verifyBookExists(book.id)
      
      if (!existingBook) {
        if (console && console.warn) {
          console.warn('MainApp: Book not found by ID, trying alternative search...')
        }
        
        // Try to find by filename/title
        existingBook = await DatabaseIntegrityChecker.findBookByAlternatives({
          fileName: book.fileName,
          title: book.title,
          author: book.author
        })
      }
      
      if (console && console.log) {
        console.log('MainApp: Book verification result:', !!existingBook)
      }
      
      if (!existingBook) {
        if (console && console.error) {
          console.error('MainApp: Cannot find book for chapter boundary update')
        }
        
        // Offer simplified recovery options
        const shouldRetry = confirm(
          'Unable to locate the book in the database for saving chapter boundaries.\n\n' +
          'This sometimes happens with Safari. Would you like to:\n' +
          '- Retry the save operation\n' +
          '- The app will wait longer for database operations to complete\n\n' +
          'Click OK to retry, or Cancel to go back.'
        )
        
        if (shouldRetry) {
          try {
            if (console && console.log) {
              console.log('MainApp: Retrying save operation with extended wait...')
            }
            
            // Wait longer for Safari database operations
            await DatabaseIntegrityChecker.waitForDatabaseSettle(3000)
            
            // Try the update with the original book ID
            await bookService.updateChapterBoundaries(book.id, updatedChapters)
            
            if (console && console.log) {
              console.log('MainApp: Retry successful!')
            }
            
            // Wait before updating UI
            await new Promise(resolve => setTimeout(resolve, 500))
            await onBookUpdated()
            setShowChapterEditor(false)
            
            return
            
          } catch (retryError) {
            if (console && console.error) {
              console.error('MainApp: Retry failed:', retryError)
            }
            alert('Unable to save chapter boundaries. Please try refreshing the page.')
          }
        }
        
        setShowChapterEditor(false)
        return
      }
      
      // Use safe book operations to prevent duplication
      const { SafeBookOperations } = await import('../utils/safeBookOperations')
      
      const bookIdToUpdate = existingBook ? existingBook.id : book.id
      
      if (console && console.log) {
        console.log('MainApp: Using safe book operations to update chapter boundaries for ID:', bookIdToUpdate)
      }
      
      try {
        await SafeBookOperations.updateChapterBoundariesSafe(bookIdToUpdate, updatedChapters)
        
        if (console && console.log) {
          console.log('MainApp: Successfully updated chapter boundaries using safe operations')
        }
        
      } catch (safeUpdateError) {
        if (console && console.warn) {
          console.warn('MainApp: Safe update failed, trying fallback method:', safeUpdateError)
        }
        
        // Fallback to original method if safe method fails
        await bookService.updateChapterBoundaries(bookIdToUpdate, updatedChapters)
        
        if (console && console.log) {
          console.log('MainApp: Fallback update completed')
        }
      }
      
      // Wait longer before refreshing to ensure Safari database consistency
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Force refresh the book data to ensure UI reflects changes
      if (console && console.log) {
        console.log('MainApp: Calling onBookUpdated to refresh book data...')
      }
      
      await onBookUpdated() // Refresh book data in parent (now async)
      
      setShowChapterEditor(false)
      
      if (console && console.log) {
        console.log('MainApp: Chapter boundaries update process completed')
      }
    } catch (error) {
      console.error('Error updating chapter boundaries:', error)
      alert(`Failed to update chapter boundaries: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleEditChapters = async () => {
    try {
      console.log('Opening chapter editor for book:', {
        id: book.id,
        title: book.title,
        fileName: book.fileName,
        pdfBlobSize: book.pdfBlob?.size,
        chapterBoundaries: book.chapterBoundaries?.length
      })
      
      // Verify PDF blob is accessible before opening editor
      if (!book.pdfBlob || book.pdfBlob.size === 0) {
        alert('PDF file is not available. Please re-upload the book.')
        return
      }
      
      // Test if we can read the blob
      const testChunk = book.pdfBlob.slice(0, 100)
      await testChunk.arrayBuffer()
      
      setShowChapterEditor(true)
    } catch (error) {
      console.error('Error accessing PDF blob:', error)
      alert('Cannot access PDF file. The file may be corrupted. Please re-upload the book.')
    }
  }

  const canGoToNextChapter = book.currentChapter < book.totalChapters
  const canGoToPrevChapter = book.currentChapter > 1

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 py-2 sm:py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
            <div className="flex items-center space-x-2 sm:space-x-4 w-full sm:w-auto">
              <button
                onClick={onBackToLibrary}
                className="text-gray-600 hover:text-gray-900 transition-colors p-2 sm:p-1 -ml-2 sm:ml-0"
                title="Back to library"
              >
                <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">{book.title}</h1>
                <p className="text-xs sm:text-sm text-gray-600 truncate">by {book.author}</p>
              </div>
            </div>

            <div className="flex items-center space-x-2 sm:space-x-4 w-full sm:w-auto mt-2 sm:mt-0">
              {/* Edit Chapters Button */}
              <button
                onClick={handleEditChapters}
                className="text-xs sm:text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 sm:px-3 py-1.5 sm:py-2 rounded-md transition-colors whitespace-nowrap"
                title="Edit chapter boundaries"
              >
                Edit Chapters
              </button>

              {/* Chapter Navigation */}
              <div className="flex items-center space-x-1 sm:space-x-2">
                <button
                  onClick={() => handleChapterChange(book.currentChapter - 1)}
                  disabled={!canGoToPrevChapter}
                  className="p-1.5 sm:p-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                  title="Previous chapter"
                >
                  <svg className="h-3 w-3 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                
                <div className="text-center px-2 sm:px-4">
                  <div className="flex items-center justify-center gap-1 text-xs sm:text-sm text-gray-600 mb-1">
                    <span>Chapter</span>
                    {/* Analysis Status Indicator */}
                    <div 
                      className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${
                        analyzedChapters.has(book.currentChapter) 
                          ? 'bg-green-500' 
                          : 'bg-gray-300'
                      }`}
                      title={
                        analyzedChapters.has(book.currentChapter) 
                          ? 'Chapter analyzed by AI' 
                          : 'Chapter not yet analyzed'
                      }
                    />
                  </div>
                  <div className="font-semibold text-gray-900 text-sm sm:text-base">
                    {book.currentChapter} / {book.totalChapters}
                  </div>
                </div>

                <button
                  onClick={() => handleChapterChange(book.currentChapter + 1)}
                  disabled={!canGoToNextChapter}
                  className="p-1.5 sm:p-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                  title="Next chapter"
                >
                  <svg className="h-3 w-3 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Analyze Chapter Button */}
              <button
                onClick={() => setShowAnalysis(true)}
                disabled={isAnalyzing}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-2 sm:px-4 py-1.5 sm:py-2 rounded-md font-medium transition-colors text-xs sm:text-sm whitespace-nowrap flex-shrink-0"
              >
                {isAnalyzing ? 'Analyzing...' : 'Analyze Chapter'}
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-3 space-y-2">
            {/* Reading Progress */}
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${(book.currentChapter / book.totalChapters) * 100}%` 
                }}
              />
            </div>
            
            {/* Chapter Analysis Status */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 flex-shrink-0">Analysis:</span>
              <div className="flex gap-1 flex-wrap overflow-hidden">
                {Array.from({ length: book.totalChapters }, (_, i) => {
                  const chapterNum = i + 1;
                  const isAnalyzed = analyzedChapters.has(chapterNum);
                  const isCurrent = chapterNum === book.currentChapter;
                  
                  return (
                    <button
                      key={chapterNum}
                      onClick={() => handleChapterChange(chapterNum)}
                      className={`w-3 h-3 sm:w-4 sm:h-4 rounded-sm transition-all flex-shrink-0 ${
                        isCurrent
                          ? 'ring-2 ring-blue-500 ring-offset-1'
                          : ''
                      } ${
                        isAnalyzed
                          ? 'bg-green-500 hover:bg-green-600'
                          : 'bg-gray-300 hover:bg-gray-400'
                      }`}
                      title={`Chapter ${chapterNum}${isAnalyzed ? ' (analyzed)' : ' (not analyzed)'}`}
                    />
                  );
                })}
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500 ml-auto">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-sm"></div>
                  <span>Analyzed</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-gray-300 rounded-sm"></div>
                  <span>Pending</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-2 sm:p-4" style={{ height: 'calc(100vh - 140px)' }}>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-2 sm:gap-6 h-full">
          {/* Character Map */}
          <div className="lg:col-span-3 h-full min-h-0">
            <div className="bg-white rounded-lg shadow-sm border h-full flex flex-col">
              <div className="p-2 sm:p-4 border-b flex-shrink-0">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900">Character Relationships</h2>
                <p className="text-xs sm:text-sm text-gray-600 mt-1">
                  {characters.length === 0 
                    ? 'No characters discovered yet. Analyze a chapter to get started.'
                    : `Showing ${characters.length} character${characters.length !== 1 ? 's' : ''} up to chapter ${book.currentChapter}`
                  }
                </p>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">
                <CytoscapeCharacterMap
                  characters={characters}
                  currentChapter={book.currentChapter}
                  onCharacterSelect={handleCharacterSelect}
                  className="w-full h-full"
                />
              </div>
            </div>
          </div>

          {/* Character Detail Panel */}
          <div className="lg:col-span-1 h-full">
            {selectedCharacter ? (
              <div className="h-full">
                <CharacterDetail
                  character={selectedCharacter}
                  characters={characters}
                  currentChapter={book.currentChapter}
                  onClose={() => setSelectedCharacter(null)}
                />
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6 text-center h-full flex flex-col justify-center">
                <div className="text-gray-400 mb-4">
                  <svg className="mx-auto h-12 w-12 sm:h-16 sm:w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No Character Selected</h3>
                <p className="text-gray-600 text-xs sm:text-sm">
                  Click on a character in the map to view their details and relationships.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Chapter Analysis Modal */}
      {showAnalysis && (
        <ChapterAnalysis
          book={book}
          onClose={() => setShowAnalysis(false)}
          onCharactersUpdated={handleCharactersUpdated}
          isAnalyzing={isAnalyzing}
          setIsAnalyzing={setIsAnalyzing}
        />
      )}

      {/* Chapter Boundary Editor */}
      {showChapterEditor && book.pdfBlob && (() => {
        try {
          const pdfFile = new File([book.pdfBlob], book.fileName, { type: 'application/pdf' })
          return (
            <NewChapterBoundaryEditor
              file={pdfFile}
              detectedChapters={book.chapterBoundaries}
              totalPages={book.chapterBoundaries[book.chapterBoundaries.length - 1]?.endPage || 1}
              bookId={book.id}
              onChaptersUpdated={handleChapterBoundariesUpdated}
              onClose={() => setShowChapterEditor(false)}
            />
          )
        } catch (error) {
          console.error('Error creating file from blob:', error)
          // Close editor and show error
          setTimeout(() => {
            setShowChapterEditor(false)
            alert('Cannot access PDF file. Please try re-uploading the book.')
          }, 0)
          return null
        }
      })()}
    </div>
  )
}