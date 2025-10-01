// Database cleanup utility to fix common issues
import { db } from '../db/database'
import { bookService } from '../db/services'

export class DatabaseCleanup {
  
  // Clean up duplicate books and fix ID issues
  static async cleanupDatabase(): Promise<void> {
    console.log('🧹 Starting database cleanup...')
    
    try {
      const allBooks = await db.books.toArray()
      console.log(`📚 Found ${allBooks.length} books in database`)
      
      // Group books by filename to find duplicates
      const booksByFilename = new Map<string, any[]>()
      
      for (const book of allBooks) {
        const filename = book.fileName
        if (!booksByFilename.has(filename)) {
          booksByFilename.set(filename, [])
        }
        booksByFilename.get(filename)!.push(book)
      }
      
      let removedCount = 0
      
      // Remove duplicates, keeping the most recent one
      for (const [filename, books] of booksByFilename) {
        if (books.length > 1) {
          console.log(`🔍 Found ${books.length} copies of "${filename}"`)
          
          // Sort by upload date (most recent first)
          books.sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime())
          
          const keepBook = books[0]
          const duplicates = books.slice(1)
          
          console.log(`✅ Keeping book with ID: ${keepBook.id}`)
          
          for (const duplicate of duplicates) {
            console.log(`🗑️ Removing duplicate with ID: ${duplicate.id}`)
            await bookService.deleteBook(duplicate.id)
            removedCount++
          }
        }
      }
      
      console.log(`🧹 Database cleanup complete. Removed ${removedCount} duplicate books.`)
      
    } catch (error) {
      console.error('❌ Database cleanup failed:', error)
      throw error
    }
  }
  
  // Fix chapter boundary issues
  static async fixChapterBoundaries(): Promise<void> {
    console.log('🔧 Fixing chapter boundaries...')
    
    try {
      const allBooks = await db.books.toArray()
      
      for (const book of allBooks) {
        let needsUpdate = false
        let updatedBoundaries = [...(book.chapterBoundaries || [])]
        
        // Ensure chapter boundaries are valid
        if (!updatedBoundaries || updatedBoundaries.length === 0) {
          // Create default chapter boundaries
          updatedBoundaries = [{
            chapter: 1,
            startPage: 1,
            endPage: 10
          }]
          needsUpdate = true
          console.log(`📖 Added default chapter boundaries for "${book.title}"`)
        }
        
        // Sort chapter boundaries by chapter number
        updatedBoundaries.sort((a, b) => a.chapter - b.chapter)
        
        // Renumber chapters to be sequential
        for (let i = 0; i < updatedBoundaries.length; i++) {
          if (updatedBoundaries[i].chapter !== i + 1) {
            updatedBoundaries[i].chapter = i + 1
            needsUpdate = true
          }
        }
        
        if (needsUpdate) {
          await db.books.update(book.id, { 
            chapterBoundaries: updatedBoundaries,
            totalChapters: updatedBoundaries.length
          })
          console.log(`🔧 Fixed chapter boundaries for "${book.title}"`)
        }
      }
      
    } catch (error) {
      console.error('❌ Failed to fix chapter boundaries:', error)
      throw error
    }
  }
  
  // Complete database repair
  static async repairDatabase(): Promise<void> {
    console.log('🚨 Starting complete database repair...')
    
    try {
      await this.cleanupDatabase()
      await this.fixChapterBoundaries()
      console.log('✅ Database repair completed successfully')
    } catch (error) {
      console.error('❌ Database repair failed:', error)
      throw error
    }
  }
}