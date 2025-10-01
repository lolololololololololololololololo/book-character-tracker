// Database integrity checker for Safari compatibility
import { db } from '../db/database'
import { Book } from '../types'

export class DatabaseIntegrityChecker {
  
  // Check if database is accessible and in a consistent state
  static async checkDatabaseHealth(): Promise<boolean> {
    try {
      // Basic accessibility check
      const books = await db.books.toArray()
      
      if (console && console.log) {
        console.log('DatabaseIntegrityChecker: Database accessible, found', books.length, 'books')
      }
      
      // Check for corrupted books
      let corruptedBooks = 0
      for (const book of books) {
        if (!book.id || !book.title || !book.fileName) {
          corruptedBooks++
        }
      }
      
      if (corruptedBooks > 0) {
        if (console && console.warn) {
          console.warn('DatabaseIntegrityChecker: Found', corruptedBooks, 'corrupted books')
        }
        return false
      }
      
      return true
      
    } catch (error) {
      if (console && console.error) {
        console.error('DatabaseIntegrityChecker: Database health check failed:', error)
      }
      return false
    }
  }
  
  // Ensure book exists and is accessible
  static async verifyBookExists(bookId: string): Promise<Book | null> {
    if (!bookId) return null
    
    try {
      // Multiple attempts to get book
      for (let attempt = 0; attempt < 3; attempt++) {
        const book = await db.books.get(bookId)
        if (book) {
          return book
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 200 * (attempt + 1)))
      }
      
      return null
      
    } catch (error) {
      if (console && console.error) {
        console.error('DatabaseIntegrityChecker: Error verifying book:', error)
      }
      return null
    }
  }
  
  // Find book by alternative methods if ID lookup fails
  static async findBookByAlternatives(targetBook: { fileName?: string, title?: string, author?: string }): Promise<Book | null> {
    try {
      const allBooks = await db.books.toArray()
      
      // Try to find by filename first (most reliable)
      if (targetBook.fileName) {
        const byFileName = allBooks.find(book => book.fileName === targetBook.fileName)
        if (byFileName) {
          if (console && console.log) {
            console.log('DatabaseIntegrityChecker: Found book by filename')
          }
          return byFileName
        }
      }
      
      // Try to find by title and author
      if (targetBook.title && targetBook.author) {
        const byTitleAuthor = allBooks.find(book => 
          book.title === targetBook.title && book.author === targetBook.author
        )
        if (byTitleAuthor) {
          if (console && console.log) {
            console.log('DatabaseIntegrityChecker: Found book by title/author')
          }
          return byTitleAuthor
        }
      }
      
      return null
      
    } catch (error) {
      if (console && console.error) {
        console.error('DatabaseIntegrityChecker: Error finding book by alternatives:', error)
      }
      return null
    }
  }
  
  // Wait for database operations to settle
  static async waitForDatabaseSettle(maxWaitMs: number = 2000): Promise<void> {
    const startTime = Date.now()
    
    while (Date.now() - startTime < maxWaitMs) {
      try {
        // Try a simple read operation
        await db.books.count()
        
        // If successful, wait a bit more for any pending writes
        await new Promise(resolve => setTimeout(resolve, 100))
        return
        
      } catch (error) {
        // Database might be busy, wait and retry
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
  }
}