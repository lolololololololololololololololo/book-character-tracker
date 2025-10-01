// Debug utilities for browser console
// Add this to window so you can call it from browser console

import { db } from '../db/database'
// import { bookService } from '../db/services'

// Make debugging functions available on window object
declare global {
  interface Window {
    debugBooks: () => Promise<void>
    debugDatabase: () => Promise<void>
    clearDatabase: () => Promise<void>
    cleanDuplicates: () => Promise<void>
  }
}

// Debug function to inspect all books
window.debugBooks = async () => {
  try {
    console.log('=== DATABASE DEBUG INFO ===')
    
    const allBooks = await db.books.toArray()
    console.log('📚 Total books in database:', allBooks.length)
    
    allBooks.forEach((book, index) => {
      console.log(`📖 Book ${index + 1}:`, {
        id: book.id,
        title: book.title,
        author: book.author,
        fileName: book.fileName,
        totalChapters: book.totalChapters,
        chapterBoundariesCount: book.chapterBoundaries?.length || 0,
        chapterBoundaries: book.chapterBoundaries,
        uploadDate: book.uploadDate
      })
    })
    
    // Check for duplicates
    const fileNames = allBooks.map(b => b.fileName)
    const duplicates = fileNames.filter((name, index) => fileNames.indexOf(name) !== index)
    
    if (duplicates.length > 0) {
      console.warn('⚠️ Duplicate files found:', [...new Set(duplicates)])
    }
    
    console.log('=== END DEBUG INFO ===')
    
  } catch (error) {
    console.error('❌ Error debugging books:', error)
  }
}

// Full database debug
window.debugDatabase = async () => {
  try {
    console.log('=== FULL DATABASE DEBUG ===')
    
    // Books
    await window.debugBooks()
    
    // Characters
    const allCharacters = await db.characters.toArray()
    console.log('👥 Total characters:', allCharacters.length)
    
    const charactersByBook = allCharacters.reduce((acc, char) => {
      acc[char.bookId] = (acc[char.bookId] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    console.log('👥 Characters per book:', charactersByBook)
    
    // Settings
    const settings = await db.settings.toArray()
    console.log('⚙️ Settings:', settings)
    
    console.log('=== END FULL DEBUG ===')
    
  } catch (error) {
    console.error('❌ Database debug error:', error)
  }
}

// Clear database function
window.clearDatabase = async () => {
  const confirm = window.confirm('Are you sure you want to clear the entire database? This cannot be undone!')
  
  if (confirm) {
    try {
      await db.books.clear()
      await db.characters.clear()
      await db.settings.clear()
      console.log('✅ Database cleared successfully')
      window.location.reload()
    } catch (error) {
      console.error('❌ Error clearing database:', error)
    }
  }
}

// Clean duplicates function
window.cleanDuplicates = async () => {
  try {
    console.log('🧹 Starting duplicate cleanup...')
    
    const { SafeBookOperations } = await import('./safeBookOperations')
    await SafeBookOperations.emergencyCleanup()
    
    console.log('✅ Duplicate cleanup completed!')
    console.log('📚 Run window.debugBooks() to see the cleaned database')
    
    // Refresh the page to see changes
    if (window.confirm('Duplicate cleanup completed! Refresh page to see changes?')) {
      window.location.reload()
    }
    
  } catch (error) {
    console.error('❌ Duplicate cleanup failed:', error)
  }
}

console.log('🔧 Debug tools loaded! Available commands:')
console.log('- window.debugBooks() - Show all books')
console.log('- window.debugDatabase() - Show full database info') 
console.log('- window.clearDatabase() - Clear entire database')
console.log('- window.cleanDuplicates() - Remove duplicate books')

export {}