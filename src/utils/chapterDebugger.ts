// Debug utility for checking chapter boundaries in the database
import { bookService } from '../db/services'

export class ChapterDebugger {
  static async logBookChapters(bookId: string) {
    try {
      const book = await bookService.getBook(bookId)
      if (!book) {
        console.log('❌ Book not found:', bookId)
        return
      }

      console.log('📚 Book Debug Info:')
      console.log('  Title:', book.title)
      console.log('  Total Chapters:', book.totalChapters)
      console.log('  Chapter Boundaries:')
      
      book.chapterBoundaries.forEach((chapter) => {
        console.log(`    Chapter ${chapter.chapter}: Pages ${chapter.startPage}-${chapter.endPage}`)
      })

      return book.chapterBoundaries
    } catch (error) {
      console.error('❌ Error debugging chapters:', error)
    }
  }

  static async listAllBooks() {
    try {
      const books = await bookService.getAllBooks()
      console.log('📖 All Books in Database:')
      
      books.forEach((book, index) => {
        console.log(`  ${index + 1}. ${book.title} (${book.chapterBoundaries.length} chapters)`)
      })

      return books
    } catch (error) {
      console.error('❌ Error listing books:', error)
    }
  }

  static async compareChapterStates(bookId: string, editorChapters: any[]) {
    try {
      const dbChapters = await this.logBookChapters(bookId)
      
      console.log('🔍 Comparing Editor vs Database:')
      console.log('  Editor chapters:', editorChapters.length)
      console.log('  Database chapters:', dbChapters?.length || 0)
      
      console.log('  Editor state:')
      editorChapters.forEach((chapter, index) => {
        console.log(`    ${index}: ${chapter.title} (${chapter.startPage}-${chapter.endPage})`)
      })

      console.log('  Database state:')
      dbChapters?.forEach((chapter, index) => {
        console.log(`    ${index}: Chapter ${chapter.chapter} (${chapter.startPage}-${chapter.endPage})`)
      })

    } catch (error) {
      console.error('❌ Error comparing states:', error)
    }
  }

  static async emergencyRepair() {
    const { databaseManager } = await import('../db/services')
    console.log('🚨 Starting emergency database repair...')
    try {
      await databaseManager.emergencyDatabaseRepair()
      console.log('✅ Emergency repair completed!')
      return true
    } catch (error) {
      console.error('❌ Emergency repair failed:', error)
      return false
    }
  }

  static async forceReset() {
    const { databaseManager } = await import('../db/services')
    console.log('🚨 WARNING: This will delete ALL books and data!')
    const confirmed = confirm('Are you sure you want to delete ALL books and reset the database? This cannot be undone!')
    
    if (!confirmed) {
      console.log('❌ Reset cancelled by user')
      return false
    }
    
    try {
      await databaseManager.forceCleanDatabase()
      console.log('✅ Database reset completed!')
      alert('Database has been reset. Please refresh the page.')
      return true
    } catch (error) {
      console.error('❌ Database reset failed:', error)
      return false
    }
  }
}

// Make it available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).chapterDebugger = ChapterDebugger
  console.log('🛠 Chapter debugger available as window.chapterDebugger')
  console.log('📚 Available commands:')
  console.log('  - chapterDebugger.listAllBooks()')
  console.log('  - chapterDebugger.logBookChapters(bookId)')
  console.log('  - chapterDebugger.emergencyRepair()')
  console.log('  - chapterDebugger.forceReset() ⚠️ DANGER: Deletes all data!')
}