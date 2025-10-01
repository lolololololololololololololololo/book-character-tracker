import { useState } from 'react'
import { Book } from '../types'
import { bookService, databaseManager } from '../db/services'
import BookUpload from './BookUpload'
import AdminMenu from './AdminMenu'
import BookCover from './BookCover'

interface BookLibraryProps {
  books: Book[]
  onBookSelect: (book: Book) => void
  onBookAdded: (book: Book) => void
  onBooksUpdated: () => void
}

export default function BookLibrary({ 
  books, 
  onBookSelect, 
  onBookAdded, 
  onBooksUpdated 
}: BookLibraryProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [showUpload, setShowUpload] = useState(false)

  const handleDeleteBook = async (bookId: string) => {
    if (confirm('Are you sure you want to delete this book? This will also delete all character data.')) {
      try {
        await bookService.deleteBook(bookId)
        onBooksUpdated()
      } catch (error) {
        console.error('Error deleting book:', error)
        alert('Failed to delete book. Please try again.')
      }
    }
  }

  const handleResetDatabase = async () => {
    const confirmReset = confirm(
      'Are you SURE you want to reset the entire database? ' +
      'This will permanently delete ALL books and character data. ' +
      'This action cannot be undone!'
    )
    
    if (confirmReset) {
      const doubleConfirm = confirm(
        'Last warning: This will delete everything! Are you absolutely sure?'
      )
      
      if (doubleConfirm) {
        try {
          await databaseManager.resetDatabase()
          onBooksUpdated()
          alert('Database reset successfully. You can now upload new books.')
        } catch (error) {
          console.error('Error resetting database:', error)
          alert('Failed to reset database. Please clear your browser data manually.')
        }
      }
    }
  }

  const handleForceCleanDatabase = async () => {
    const confirmClean = confirm(
      'FORCE CLEAN database? This is more aggressive than reset and will clear all browser storage. ' +
      'Use this if you are having persistent duplicate/caching issues.'
    )
    
    if (confirmClean) {
      try {
        await databaseManager.forceCleanDatabase()
        onBooksUpdated()
        alert('Database force cleaned successfully. Page will reload.')
        // Force page reload to clear any cached state
        window.location.reload()
      } catch (error) {
        console.error('Error force cleaning database:', error)
        alert('Failed to force clean database. Please manually clear browser data.')
      }
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--apple-gray-50)' }}>
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-3" style={{ color: 'var(--apple-gray-900)' }}>
            Book Character Tracker
          </h1>
          <p className="text-lg" style={{ color: 'var(--apple-gray-600)' }}>
            Track characters chapter-by-chapter without spoilers
          </p>
        </div>

        {/* Upload Modal */}
        {showUpload && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm" onClick={() => setShowUpload(false)} />
            <div className="relative apple-card p-6 max-w-2xl w-full max-h-[80vh] overflow-auto">
              <BookUpload
                onBookAdded={(book) => {
                  onBookAdded(book)
                  setShowUpload(false)
                }}
                onCancel={() => setShowUpload(false)}
                setIsUploading={setIsUploading}
              />
            </div>
          </div>
        )}

        {/* Empty State */}
        {books.length === 0 && !showUpload ? (
          <div className="text-center py-20">
            <div className="mb-8">
              <div className="w-32 h-32 mx-auto mb-6 rounded-full flex items-center justify-center" 
                   style={{ backgroundColor: 'var(--apple-gray-200)' }}>
                <svg className="w-16 h-16" style={{ color: 'var(--apple-gray-500)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
            </div>
            <h3 className="text-2xl font-semibold mb-3" style={{ color: 'var(--apple-gray-900)' }}>
              Welcome to Your Library
            </h3>
            <p className="text-lg mb-8" style={{ color: 'var(--apple-gray-600)' }}>
              Upload your first book to start tracking characters
            </p>
            <button
              onClick={() => setShowUpload(true)}
              className="apple-button-primary px-8 py-4 text-lg font-semibold"
              disabled={isUploading}
            >
              {isUploading ? (
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Processing...
                </div>
              ) : (
                'Upload Your First Book'
              )}
            </button>
          </div>
        ) : (
          /* Book Grid */
          <div className="relative">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {books.map((book) => (
                <div
                  key={book.id}
                  className="apple-card p-6 cursor-pointer group"
                  onClick={() => onBookSelect(book)}
                >
                  <div className="flex items-start gap-4 mb-4">
                    <BookCover title={book.title} author={book.author} />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold mb-1 truncate" style={{ color: 'var(--apple-gray-900)' }}>
                        {book.title}
                      </h3>
                      <p className="text-sm truncate" style={{ color: 'var(--apple-gray-600)' }}>
                        by {book.author}
                      </p>
                      <div className="mt-3 flex items-center justify-between text-xs" style={{ color: 'var(--apple-gray-500)' }}>
                        <span>Chapter {book.currentChapter} of {book.totalChapters}</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteBook(book.id)
                      }}
                      className="opacity-0 group-hover:opacity-100 p-2 rounded-full hover:bg-gray-100 transition-all duration-200"
                      style={{ color: 'var(--apple-gray-400)' }}
                      title="Delete book"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="w-full h-2 rounded-full" style={{ backgroundColor: 'var(--apple-gray-200)' }}>
                      <div
                        className="h-2 rounded-full transition-all duration-500"
                        style={{ 
                          width: `${(book.currentChapter / book.totalChapters) * 100}%`,
                          background: 'linear-gradient(90deg, var(--apple-blue) 0%, var(--apple-teal) 100%)'
                        }}
                      />
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between text-xs" style={{ color: 'var(--apple-gray-500)' }}>
                    <span>{formatDate(book.uploadDate)}</span>
                    <span className="font-medium" style={{ color: 'var(--apple-blue)' }}>
                      {Math.round((book.currentChapter / book.totalChapters) * 100)}% complete
                    </span>
                  </div>
                </div>
              ))}
              
              {/* Add Book Plus Button */}
              <div className="flex items-center justify-center min-h-[200px]">
                <button
                  onClick={() => setShowUpload(true)}
                  className="apple-plus-button"
                  disabled={isUploading}
                  title="Add new book"
                >
                  {isUploading ? (
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="apple-plus-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Book Count */}
        {books.length > 0 && (
          <div className="text-center mt-12">
            <p className="text-sm font-medium" style={{ color: 'var(--apple-gray-500)' }}>
              {books.length} {books.length === 1 ? 'book' : 'books'} in your library
            </p>
          </div>
        )}
      </div>

      {/* Admin Menu */}
      <AdminMenu 
        onResetDatabase={handleResetDatabase}
        onForceCleanDatabase={handleForceCleanDatabase}
      />
    </div>
  )
}