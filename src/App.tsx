import { useState, useEffect } from 'react'
import BookLibrary from './components/BookLibrary'
import MainApp from './components/MainApp'
import { Book } from './types'
import { db } from './db/database'
import { bookService, databaseManager } from './db/services'
import './utils/debugTools' // Load debug tools

function App() {
  const [currentBook, setCurrentBook] = useState<Book | null>(null)
  const [books, setBooks] = useState<Book[]>([])

  useEffect(() => {
    loadBooks()
  }, [])

  const loadBooks = async () => {
    try {
      if (console && console.log) {
        console.log('App: Starting loadBooks process...')
      }
      
      // Import integrity checker
      const { DatabaseIntegrityChecker } = await import('./utils/databaseIntegrityChecker')
      
      // CRITICAL: Clean duplicates first to prevent corruption
      try {
        if (console && console.log) {
          console.log('App: Cleaning duplicates before loading books...')
        }
        await bookService.removeDuplicateBooks()
      } catch (cleanupError) {
        if (console && console.warn) {
          console.warn('App: Duplicate cleanup failed:', cleanupError)
        }
      }
      
      // Wait for database to settle before operations
      await DatabaseIntegrityChecker.waitForDatabaseSettle(1000)
      
      // Check database health first
      const isHealthy = await DatabaseIntegrityChecker.checkDatabaseHealth()
      
      if (!isHealthy) {
        if (console && console.warn) {
          console.warn('App: Database health check failed, checking for corruption...')
        }
        
        // Check if database is corrupted
        if (await databaseManager.isDatabaseCorrupted()) {
          const resetConfirm = confirm(
            'The database appears to be corrupted. Would you like to reset it? ' +
            'This will delete all existing books and characters.'
          )
          if (resetConfirm) {
            await databaseManager.resetDatabase()
          } else {
            return // Don't proceed if user doesn't want to reset
          }
        }
      }
      
      // Safari-compatible: Multiple attempts to load books
      let allBooks: Book[] = []
      let loadSuccess = false
      
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          if (console && console.log) {
            console.log('App: Load attempt', attempt + 1, 'of 3')
          }
          
          // Clean up any duplicate or corrupted books (only on first attempt)
          if (attempt === 0) {
            await bookService.removeDuplicateBooks()
            await bookService.validateAndFixBooks()
          }
          
          allBooks = await db.books.toArray()
          
          if (allBooks.length >= 0) { // Even 0 books is a valid result
            loadSuccess = true
            break
          }
          
        } catch (loadError) {
          if (console && console.warn) {
            console.warn('App: Load attempt', attempt + 1, 'failed:', loadError)
          }
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)))
        }
      }
      
      if (loadSuccess) {
        if (console && console.log) {
          console.log('App: Successfully loaded', allBooks.length, 'books from database')
        }
        setBooks(allBooks)
      } else {
        if (console && console.error) {
          console.error('App: Failed to load books after all attempts')
        }
        setBooks([]) // Set empty array as fallback
      }
      
      // Load current book from settings if exists
      const settings = await db.settings.get('settings')
      if (settings?.currentBookId) {
        const book = allBooks.find(b => b.id === settings.currentBookId)
        if (book) setCurrentBook(book)
      }
    } catch (error) {
      console.error('Error loading books:', error)
      
      // If there's still an error, offer to reset the database
      const resetConfirm = confirm(
        'There was an error loading your books. Would you like to reset the database? ' +
        'This will delete all existing data but should fix any corruption issues.'
      )
      if (resetConfirm) {
        try {
          await databaseManager.resetDatabase()
          setBooks([])
          setCurrentBook(null)
        } catch (resetError) {
          console.error('Error resetting database:', resetError)
          alert('Failed to reset database. Please clear your browser data manually.')
        }
      }
    }
  }

  const handleBookSelect = async (book: Book) => {
    setCurrentBook(book)
    // Save current book to settings
    try {
      await db.settings.put({
        id: 'settings',
        currentBookId: book.id,
        theme: 'light'
      })
    } catch (error) {
      console.error('Error saving current book:', error)
    }
  }

  const handleBookAdded = (newBook: Book) => {
    setBooks(prev => [...prev, newBook])
    setCurrentBook(newBook)
  }

  const handleBackToLibrary = () => {
    setCurrentBook(null)
  }

  const handleBookUpdated = async () => {
    // Safari-safe console logging
    if (console && console.log) {
      console.log('App: handleBookUpdated called, reloading books...')
    }
    
    try {
      // Safari: Don't reload all books immediately - this can cause race conditions
      // Instead, wait longer and verify current book state first
      
      if (!currentBook) {
        if (console && console.log) {
          console.log('App: No current book, just reloading books list')
        }
        await loadBooks()
        return
      }

      if (console && console.log) {
        console.log('App: Refreshing current book with ID:', currentBook.id)
      }

      // Safari-compatible: Extended retry logic with database state verification
      let updatedBook = null
      let allBooks: Book[] = []
      
      // First, wait for any pending database operations to complete
      await new Promise(resolve => setTimeout(resolve, 500))
      
      for (let attempt = 0; attempt < 6; attempt++) {
        try {
          if (console && console.log) {
            console.log('App: Refresh attempt', attempt + 1, 'of 6')
          }
          
          // Get fresh book list on each attempt
          allBooks = await bookService.getAllBooks()
          
          if (allBooks.length === 0) {
            if (console && console.warn) {
              console.warn('App: Database appears empty on attempt', attempt + 1, 'waiting longer...')
            }
            
            // If database appears empty, wait progressively longer
            await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)))
            continue
          }
          
          // Try to get the specific book
          updatedBook = await bookService.getBook(currentBook.id)
          
          if (updatedBook) {
            if (console && console.log) {
              console.log('App: Successfully found updated book on attempt', attempt + 1)
            }
            break
          }
          
          // If not found by ID, try finding by filename/title immediately
          const matchingBook = allBooks.find(book => {
            return book.fileName === currentBook.fileName || 
                   (book.title === currentBook.title && book.author === currentBook.author)
          })
          
          if (matchingBook) {
            if (console && console.log) {
              console.log('App: Found matching book by filename/title on attempt', attempt + 1)
            }
            updatedBook = matchingBook
            break
          }
          
          // Wait before next attempt with progressive delay
          await new Promise(resolve => setTimeout(resolve, 400 * (attempt + 1)))
          
        } catch (attemptError) {
          if (console && console.warn) {
            console.warn('App: Attempt', attempt + 1, 'error:', attemptError)
          }
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)))
        }
      }
      
      if (updatedBook) {
        if (console && console.log) {
          console.log('App: Successfully refreshed current book!')
        }
        setCurrentBook(updatedBook)
        
        // Update the books list as well to stay in sync
        setBooks(allBooks)
      } else {
        if (console && console.error) {
          console.error('App: Failed to find current book after all attempts')
          console.error('App: Current book:', { id: currentBook.id, title: currentBook.title, fileName: currentBook.fileName })
          console.error('App: Available books:', allBooks.map(b => ({ id: b.id, title: b.title, fileName: b.fileName })))
        }
        
        // Safari: Continue with current book rather than losing state
        // Just update the books list for consistency
        if (allBooks.length > 0) {
          setBooks(allBooks)
        }
      }
      
    } catch (mainError) {
      if (console && console.error) {
        console.error('App: Main error in handleBookUpdated:', mainError)
      }
      
      // Safari: Try a simple books reload as fallback
      try {
        await loadBooks()
      } catch (fallbackError) {
        if (console && console.error) {
          console.error('App: Fallback loadBooks also failed:', fallbackError)
        }
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {!currentBook ? (
        <BookLibrary 
          books={books}
          onBookSelect={handleBookSelect}
          onBookAdded={handleBookAdded}
          onBooksUpdated={loadBooks}
        />
      ) : (
        <MainApp 
          book={currentBook}
          onBackToLibrary={handleBackToLibrary}
          onBookUpdated={handleBookUpdated}
        />
      )}
    </div>
  )
}

export default App