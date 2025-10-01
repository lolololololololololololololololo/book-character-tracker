// Safe book operations for Safari compatibility
import { db } from '../db/database'
import { Book, ChapterBoundary } from '../types'

export class SafeBookOperations {
  
  // Safely update chapter boundaries without creating duplicates
  static async updateChapterBoundariesSafe(bookId: string, chapterBoundaries: ChapterBoundary[]): Promise<void> {
    if (console && console.log) {
      console.log('SafeBookOperations: Starting safe chapter boundary update for:', bookId)
    }
    
    try {
      // Step 1: Get current book count for this filename
      let targetBook = await db.books.get(bookId)
      if (!targetBook) {
        throw new Error(`Book with ID ${bookId} not found`)
      }
      
      const originalFileName = targetBook.fileName
      const booksWithSameFile = await db.books.where('fileName').equals(originalFileName).toArray()
      
      if (console && console.log) {
        console.log('SafeBookOperations: Found', booksWithSameFile.length, 'books with filename:', originalFileName)
      }
      
      // Step 2: Clean up duplicates first
      if (booksWithSameFile.length > 1) {
        // Keep the one we're updating, remove others
        for (const book of booksWithSameFile) {
          if (book.id !== bookId) {
            if (console && console.log) {
              console.log('SafeBookOperations: Removing duplicate book:', book.id)
            }
            await db.books.delete(book.id)
            
            // Also clean up associated characters
            await db.characters.where('bookId').equals(book.id).delete()
          }
        }
      }
      
      // Step 3: Refresh target book reference after cleanup
      targetBook = await db.books.get(bookId)
      if (!targetBook) {
        throw new Error(`Book disappeared during cleanup: ${bookId}`)
      }
      
      // Step 4: Create complete updated book object
      const updatedBook: Book = {
        ...targetBook,
        chapterBoundaries: [...chapterBoundaries],
        totalChapters: chapterBoundaries.length,
        // Explicitly preserve the ID to prevent new book creation
        id: bookId
      }
      
      // Step 5: Use transaction to ensure atomicity
      await db.transaction('rw', db.books, async () => {
        // Delete the old book first
        await db.books.delete(bookId)
        
        // Add the updated book (this ensures clean replacement)
        await db.books.add(updatedBook)
      })
      
      // Step 6: Verify the operation
      const verifyBook = await db.books.get(bookId)
      if (!verifyBook) {
        throw new Error('Book verification failed after update')
      }
      
      // Step 7: Final duplicate check
      const finalCheck = await db.books.where('fileName').equals(originalFileName).toArray()
      if (finalCheck.length > 1) {
        if (console && console.warn) {
          console.warn('SafeBookOperations: Duplicates detected after update, final cleanup...')
        }
        
        // Emergency cleanup
        for (const book of finalCheck) {
          if (book.id !== bookId) {
            await db.books.delete(book.id)
          }
        }
      }
      
      if (console && console.log) {
        console.log('SafeBookOperations: Chapter boundary update completed successfully')
      }
      
    } catch (error) {
      if (console && console.error) {
        console.error('SafeBookOperations: Update failed:', error)
      }
      throw error
    }
  }
  
  // Get book count by filename to detect issues
  static async getBookCountByFilename(fileName: string): Promise<number> {
    try {
      const books = await db.books.where('fileName').equals(fileName).toArray()
      return books.length
    } catch (error) {
      return 0
    }
  }
  
  // Emergency duplicate cleanup
  static async emergencyCleanup(): Promise<void> {
    if (console && console.log) {
      console.log('SafeBookOperations: Starting emergency cleanup...')
    }
    
    try {
      const allBooks = await db.books.toArray()
      const filenameCounts = new Map<string, Book[]>()
      
      // Group by filename
      for (const book of allBooks) {
        if (!filenameCounts.has(book.fileName)) {
          filenameCounts.set(book.fileName, [])
        }
        filenameCounts.get(book.fileName)!.push(book)
      }
      
      // Remove duplicates
      for (const [fileName, books] of filenameCounts) {
        if (books.length > 1) {
          // Sort by upload date, keep most recent
          books.sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime())
          
          // Keep the most recent book (books[0])
          const toDelete = books.slice(1)
          
          for (const book of toDelete) {
            await db.books.delete(book.id)
            await db.characters.where('bookId').equals(book.id).delete()
          }
          
          if (console && console.log) {
            console.log('SafeBookOperations: Cleaned up', toDelete.length, 'duplicates of:', fileName)
          }
        }
      }
      
    } catch (error) {
      if (console && console.error) {
        console.error('SafeBookOperations: Emergency cleanup failed:', error)
      }
    }
  }
}