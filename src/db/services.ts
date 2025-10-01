import { db } from './database'
import { Book, Character, ChapterBoundary } from '../types'
import { PDFProcessor } from '../services/pdfProcessor'

export class BookService {
  async createBook(
    file: File,
    title: string,
    author: string,
    chapterBoundaries: ChapterBoundary[]
  ): Promise<Book> {
    return new Promise(async (resolve, reject) => {
      try {
        // Safari-safe console logging
        if (console && console.log) {
          console.log('BookService: Creating book:', title)
        }
        
        // Validate file before processing
        if (!file || file.size === 0) {
          throw new Error('PDF file is empty or invalid')
        }
        
        if (!file.type.includes('pdf')) {
          throw new Error('File must be a PDF')
        }

        // Safari-compatible: Handle large files differently
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
        const maxSafariBlob = 50 * 1024 * 1024 // 50MB limit for Safari
        
        if (isSafari && file.size > maxSafariBlob) {
          throw new Error('File too large for Safari. Please use a smaller PDF file.')
        }

        // Safari-compatible blob creation
        let pdfBlob: Blob
        
        try {
          if (isSafari) {
            // Safari: Create blob in chunks to avoid memory issues
            const chunkSize = 1024 * 1024 // 1MB chunks
            const chunks = []
            
            for (let start = 0; start < file.size; start += chunkSize) {
              const chunk = file.slice(start, start + chunkSize)
              const arrayBuffer = await chunk.arrayBuffer()
              chunks.push(arrayBuffer)
            }
            
            pdfBlob = new Blob(chunks, { type: 'application/pdf' })
          } else {
            // Other browsers: Direct conversion
            const arrayBuffer = await file.arrayBuffer()
            pdfBlob = new Blob([arrayBuffer], { type: 'application/pdf' })
          }
          
          // Safari-compatible validation
          if (pdfBlob.size === 0) {
            throw new Error('PDF blob creation failed')
          }
          
        } catch (blobError) {
          throw new Error(`Failed to process PDF file: ${blobError instanceof Error ? blobError.message : 'Unknown error'}`)
        }

        // Safari-compatible ID generation
        const bookId = crypto && crypto.randomUUID ? 
          crypto.randomUUID() : 
          'book_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
        
        const book: Book = {
          id: bookId,
          title,
          author,
          fileName: file.name,
          pdfBlob,
          totalChapters: chapterBoundaries.length,
          currentChapter: 1,
          chapterBoundaries,
          uploadDate: new Date().toISOString()
        }

        // Safari-compatible database transaction
        const tx = db.transaction('rw', db.books, async () => {
          await db.books.add(book)
        })
        
        await tx
        
        if (console && console.log) {
          console.log('BookService: Book successfully created and stored:', book.id)
        }
        
        resolve(book)
        
      } catch (error) {
        if (console && console.error) {
          console.error('BookService: Error creating book:', error)
        }
        reject(new Error(`Failed to create book: ${error instanceof Error ? error.message : 'Unknown error'}`))
      }
    })
  }

  async updateBookChapter(bookId: string, newChapter: number): Promise<void> {
    await db.books.update(bookId, { currentChapter: newChapter })
  }

  async updateChapterBoundaries(bookId: string, chapterBoundaries: ChapterBoundary[]): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        // Safari-safe console logging
        if (console && console.log) {
          console.log('BookService: updateChapterBoundaries called with bookId:', bookId)
          console.log('BookService: Chapter boundaries count:', chapterBoundaries.length)
        }
        
        // Validate inputs first (Safari is stricter)
        if (!bookId || typeof bookId !== 'string') {
          throw new Error('Invalid book ID provided')
        }
        
        if (!Array.isArray(chapterBoundaries)) {
          throw new Error('Chapter boundaries must be an array')
        }
        
        // Safari-compatible: Prevent duplicate creation with explicit book management
        let transactionResult = null
        
        // Step 1: Clean up any existing duplicates BEFORE updating
        await this.removeDuplicateBooks()
        
        // Step 2: Use more explicit transaction to prevent Safari issues
        const tx = db.transaction('rw', db.books, async () => {
          // Get the current book within transaction
          const currentBook = await db.books.get(bookId)
          
          if (!currentBook) {
            throw new Error(`Book with ID ${bookId} not found`)
          }
          
          if (console && console.log) {
            console.log('BookService: Found book for update:', { id: currentBook.id, title: currentBook.title })
          }
          
          // Safari-compatible: Create complete updated book object
          const updatedBook = {
            ...currentBook, // Keep all existing properties
            chapterBoundaries: [...chapterBoundaries], // Update only chapter boundaries
            totalChapters: chapterBoundaries.length,
            // Ensure we keep the same ID and don't create duplicates
            id: bookId
          }
          
          // Safari-compatible: Use put instead of update to ensure exact replacement
          await db.books.put(updatedBook)
          
          // Verify no duplicates were created
          const booksWithSameFilename = await db.books.where('fileName').equals(currentBook.fileName).toArray()
          if (booksWithSameFilename.length > 1) {
            if (console && console.warn) {
              console.warn('BookService: Duplicate detected after update, cleaning up...')
            }
            
            // Keep only the one we just updated
            for (const book of booksWithSameFilename) {
              if (book.id !== bookId) {
                await db.books.delete(book.id)
                if (console && console.log) {
                  console.log('BookService: Removed duplicate book:', book.id)
                }
              }
            }
          }
          
          transactionResult = 1 // Successful update
          return transactionResult
        })
        
        // Wait for transaction to complete
        await tx
        
        if (console && console.log) {
          console.log('BookService: Transaction completed, rows affected:', transactionResult)
        }
        
        // Safari-compatible: Force database sync with multiple verification attempts
        let verificationSuccess = false
        for (let attempt = 0; attempt < 5; attempt++) {
          try {
            // Progressive delay: 100ms, 300ms, 500ms, 700ms, 1000ms
            await new Promise(resolve => setTimeout(resolve, 100 + (attempt * 200)))
            
            const verifyBook = await db.books.get(bookId)
            if (verifyBook && verifyBook.chapterBoundaries && verifyBook.chapterBoundaries.length === chapterBoundaries.length) {
              if (console && console.log) {
                console.log('BookService: Update verification successful on attempt', attempt + 1)
              }
              verificationSuccess = true
              break
            } else if (console && console.log) {
              console.log('BookService: Verification attempt', attempt + 1, 'failed, retrying...')
            }
          } catch (verifyError) {
            if (console && console.warn) {
              console.warn('BookService: Verification attempt', attempt + 1, 'error:', verifyError)
            }
          }
        }
        
        if (!verificationSuccess && console && console.warn) {
          console.warn('BookService: Could not verify update after 5 attempts')
        }
        
        if (console && console.log) {
          console.log('BookService: Successfully updated chapter boundaries')
        }
        
        resolve()
        
      } catch (error) {
        if (console && console.error) {
          console.error('BookService: Error in updateChapterBoundaries:', error)
        }
        reject(new Error(`Failed to update chapter boundaries: ${error instanceof Error ? error.message : 'Unknown error'}`))
      }
    })
  }

  async getBook(bookId: string): Promise<Book | undefined> {
    return await db.books.get(bookId)
  }

  async getAllBooks(): Promise<Book[]> {
    return await db.books.toArray()
  }

  async deleteBook(bookId: string): Promise<void> {
    // Delete all characters associated with this book
    await db.characters.where('bookId').equals(bookId).delete()
    // Delete the book
    await db.books.delete(bookId)
  }

  async removeDuplicateBooks(): Promise<void> {
    try {
      const allBooks = await db.books.toArray()
      
      if (console && console.log) {
        console.log('BookService: Checking for duplicates among', allBooks.length, 'books')
      }
      
      // Group books by filename
      const booksByFilename = new Map<string, any[]>()
      
      for (const book of allBooks) {
        if (!book.fileName) continue // Skip books without filename
        
        if (!booksByFilename.has(book.fileName)) {
          booksByFilename.set(book.fileName, [])
        }
        booksByFilename.get(book.fileName)!.push(book)
      }
      
      let removedCount = 0
      
      // Process each group of books with same filename
      for (const [fileName, books] of booksByFilename) {
        if (books.length > 1) {
          if (console && console.log) {
            console.log('BookService: Found', books.length, 'copies of:', fileName)
          }
          
          // Sort by upload date (keep most recent) and by ID (consistent ordering)
          books.sort((a, b) => {
            const dateA = new Date(a.uploadDate || 0).getTime()
            const dateB = new Date(b.uploadDate || 0).getTime()
            if (dateB !== dateA) return dateB - dateA // Most recent first
            return a.id.localeCompare(b.id) // Consistent ID ordering
          })
          
          const keepBook = books[0]
          const duplicatesToRemove = books.slice(1)
          
          if (console && console.log) {
            console.log('BookService: Keeping book:', keepBook.id, 'Removing:', duplicatesToRemove.length)
          }
          
          // Remove duplicates
          for (const duplicate of duplicatesToRemove) {
            try {
              await this.deleteBook(duplicate.id)
              removedCount++
            } catch (deleteError) {
              if (console && console.warn) {
                console.warn('BookService: Failed to delete duplicate:', duplicate.id, deleteError)
              }
            }
          }
        }
      }
      
      if (console && console.log) {
        console.log('BookService: Removed', removedCount, 'duplicate books')
      }
      
    } catch (error) {
      if (console && console.error) {
        console.error('BookService: Error removing duplicates:', error)
      }
    }
  }

  async validateAndFixBooks(): Promise<void> {
    const allBooks = await db.books.toArray()
    const corruptedBooks: string[] = []
    
    for (const book of allBooks) {
      try {
        // Check if PDF blob is accessible
        if (!book.pdfBlob || book.pdfBlob.size === 0) {
          corruptedBooks.push(book.id)
          continue
        }
        
        // Try to read the first few bytes to verify it's not corrupted
        const chunk = book.pdfBlob.slice(0, 100)
        await chunk.arrayBuffer()
        
      } catch (error) {
        console.warn(`Book ${book.title} has corrupted PDF:`, error)
        corruptedBooks.push(book.id)
      }
    }
    
    // Remove corrupted books
    for (const corruptedId of corruptedBooks) {
      await this.deleteBook(corruptedId)
    }
    
    if (corruptedBooks.length > 0) {
      console.log(`Removed ${corruptedBooks.length} corrupted books`)
    }
  }
}

export class CharacterService {
  async saveCharacters(bookId: string, characters: Character[]): Promise<void> {
    const charactersWithBookId = characters.map(char => ({
      ...char,
      bookId
    }))
    
    await db.characters.bulkPut(charactersWithBookId)
  }

  async getCharactersForBook(bookId: string): Promise<Character[]> {
    return await db.characters.where('bookId').equals(bookId).toArray()
  }

  async getCharactersUpToChapter(bookId: string, maxChapter: number): Promise<Character[]> {
    const allCharacters = await this.getCharactersForBook(bookId)
    
    // Filter characters that have appeared up to the specified chapter
    return allCharacters.filter(character => character.firstAppearance <= maxChapter)
  }

  async updateCharacter(character: Character): Promise<void> {
    await db.characters.put(character)
  }

  async findCharacterByName(bookId: string, name: string): Promise<Character | undefined> {
    return await db.characters
      .where('bookId')
      .equals(bookId)
      .and(char => char.name.toLowerCase() === name.toLowerCase())
      .first()
  }

  async deleteCharactersForBook(bookId: string): Promise<void> {
    await db.characters.where('bookId').equals(bookId).delete()
  }

  async getAnalyzedChapters(bookId: string): Promise<Set<number>> {
    const characters = await this.getCharactersForBook(bookId)
    const analyzedChapters = new Set<number>()
    
    for (const character of characters) {
      // Add chapter where character first appeared
      analyzedChapters.add(character.firstAppearance)
      
      // Add all chapters from character history
      for (const history of character.chapterHistory) {
        analyzedChapters.add(history.chapter)
      }
    }
    
    return analyzedChapters
  }

  async mergeCharacters(sourceCharacterId: string, targetCharacterId: string): Promise<void> {
    const sourceChar = await db.characters.get(sourceCharacterId)
    const targetChar = await db.characters.get(targetCharacterId)
    
    if (!sourceChar || !targetChar) {
      throw new Error('Source or target character not found')
    }

    if (sourceChar.bookId !== targetChar.bookId) {
      throw new Error('Cannot merge characters from different books')
    }

    // Merge character data
    const mergedChar: Character = {
      ...targetChar,
      // Combine mention counts
      mentionCount: targetChar.mentionCount + sourceChar.mentionCount,
      // Use earliest appearance
      firstAppearance: Math.min(targetChar.firstAppearance, sourceChar.firstAppearance),
      // Merge relationships, avoiding duplicates
      relationships: [
        ...targetChar.relationships,
        ...sourceChar.relationships.filter(sourceRel => 
          !targetChar.relationships.some(targetRel => 
            targetRel.targetCharacterId === sourceRel.targetCharacterId &&
            targetRel.type === sourceRel.type
          )
        )
      ],
      // Merge chapter history
      chapterHistory: [
        ...targetChar.chapterHistory,
        ...sourceChar.chapterHistory.filter(sourceHist =>
          !targetChar.chapterHistory.some(targetHist =>
            targetHist.chapter === sourceHist.chapter
          )
        )
      ].sort((a, b) => a.chapter - b.chapter),
      // Combine aliases if they exist
      aliases: [
        ...(targetChar.aliases || []),
        sourceChar.name, // Add source name as alias
        ...(sourceChar.aliases || [])
      ].filter((alias, index, arr) => arr.indexOf(alias) === index) // Remove duplicates
    }

    // Update all relationships that point to the source character
    const allCharacters = await db.characters.where('bookId').equals(sourceChar.bookId).toArray()
    
    for (const char of allCharacters) {
      let updated = false
      const updatedRelationships = char.relationships.map(rel => {
        if (rel.targetCharacterId === sourceCharacterId) {
          updated = true
          return { ...rel, targetCharacterId: targetCharacterId }
        }
        return rel
      })
      
      if (updated) {
        await db.characters.put({
          ...char,
          relationships: updatedRelationships
        })
      }
    }

    // Save merged character and delete source
    await db.characters.put(mergedChar)
    await db.characters.delete(sourceCharacterId)
  }
}

export class PDFService {
  private processor = new PDFProcessor()

  async processBookFile(file: File): Promise<{
    chapterBoundaries: ChapterBoundary[]
    totalPages: number
  }> {
    await this.processor.loadPDF(file)
    const chapterBoundaries = await this.processor.detectChapters()
    const totalPages = this.processor.getTotalPages()
    
    return { chapterBoundaries, totalPages }
  }

  async extractChapterText(file: File, chapterBoundary: ChapterBoundary): Promise<string> {
    try {
      // Validate file before processing
      if (!file || file.size === 0) {
        throw new Error('Invalid PDF file provided')
      }
      
      // Test file readability
      const testChunk = file.slice(0, 1024)
      await testChunk.arrayBuffer()
      
      await this.processor.loadPDF(file)
      return await this.processor.extractChapterText(chapterBoundary)
    } catch (error) {
      console.error('PDF extraction error:', error)
      throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async extractTextFromPage(file: File, pageNumber: number): Promise<{ text: string; fontSize: number[] }> {
    await this.processor.loadPDF(file)
    return await this.processor.extractTextFromPage(pageNumber)
  }

  cleanup(): void {
    this.processor.cleanup()
  }
}

// Database management utilities
export class DatabaseManager {
  async resetDatabase(): Promise<void> {
    try {
      await db.delete()
      // Clear any browser cache/storage related to IndexedDB
      if ('indexedDB' in window && 'databases' in indexedDB) {
        const databases = await indexedDB.databases()
        await Promise.all(
          databases
            .filter(db => db.name?.includes('BookCharacter'))
            .map(dbInfo => {
              if (dbInfo.name) {
                const deleteReq = indexedDB.deleteDatabase(dbInfo.name)
                return new Promise((resolve, reject) => {
                  deleteReq.onsuccess = () => resolve(true)
                  deleteReq.onerror = () => reject(deleteReq.error)
                })
              }
            })
        )
      }
      
      await db.open()
      console.log('Database reset successfully')
    } catch (error) {
      console.error('Error resetting database:', error)
      throw error
    }
  }

  async isDatabaseCorrupted(): Promise<boolean> {
    try {
      await db.books.toArray()
      return false
    } catch (error) {
      console.error('Database corruption detected:', error)
      return true
    }
  }

  async repairDatabase(): Promise<void> {
    try {
      console.log('Starting database repair...')
      
      // Try to get all books and check for corruption
      const books = await db.books.toArray()
      const corruptedBookIds: string[] = []
      
      for (const book of books) {
        try {
          // Validate book structure
          if (!book.id || !book.title || !book.fileName) {
            console.warn('Book missing required fields:', book)
            corruptedBookIds.push(book.id)
            continue
          }
          
        // Check if PDF blob is accessible
        if (!book.pdfBlob || book.pdfBlob.size === 0) {
          console.warn('Book has invalid PDF blob:', book.title)
          corruptedBookIds.push(book.id)
          continue
        }
        
        // More thorough blob validation
        try {
          // Test blob integrity with larger chunk and timeout
          const testChunk = book.pdfBlob.slice(0, Math.min(book.pdfBlob.size, 50000))
          
          // Add timeout to prevent hanging
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Blob validation timeout')), 5000)
          )
          
          await Promise.race([
            testChunk.arrayBuffer(),
            timeoutPromise
          ])
          
          // Additional validation: check if blob looks like a PDF
          const headerChunk = book.pdfBlob.slice(0, 10)
          const headerBuffer = await headerChunk.arrayBuffer()
          const headerBytes = new Uint8Array(headerBuffer)
          const pdfSignature = String.fromCharCode(...headerBytes.slice(0, 4))
          
          if (pdfSignature !== '%PDF') {
            console.warn('Book blob does not have PDF signature:', book.title, 'signature:', pdfSignature)
            corruptedBookIds.push(book.id)
            continue
          }
          
        } catch (validationError) {
          console.warn('Blob validation failed for book:', book.title, validationError)
          corruptedBookIds.push(book.id)
          continue
        }        } catch (error) {
          console.warn(`Book ${book.title} is corrupted:`, error)
          corruptedBookIds.push(book.id)
        }
      }
      
      // Remove corrupted books
      if (corruptedBookIds.length > 0) {
        console.log(`Removing ${corruptedBookIds.length} corrupted books...`)
        for (const bookId of corruptedBookIds) {
          await bookService.deleteBook(bookId)
        }
      }
      
      console.log('Database repair completed')
      
    } catch (error) {
      console.error('Database repair failed:', error)
      throw error
    }
  }

  async forceCleanDatabase(): Promise<void> {
    try {
      console.log('Starting force clean of database...')
      
      // Close the database first
      db.close()
      
      // Delete the database completely
      await db.delete()
      
      // Clear localStorage just in case
      localStorage.clear()
      
      // Clear sessionStorage 
      sessionStorage.clear()
      
      // Force garbage collection of any cached data
      if ('gc' in window) {
        (window as any).gc()
      }
      
      console.log('Force cleaned database and storage')
      
      // Reopen with fresh connection
      await db.open()
      
      console.log('Database reopened successfully')
      
    } catch (error) {
      console.error('Error force cleaning database:', error)
      throw error
    }
  }

  async emergencyDatabaseRepair(): Promise<void> {
    try {
      console.log('🚨 Starting emergency database repair...')
      
      // Get all books and check each one
      const books = await db.books.toArray()
      console.log(`Found ${books.length} books to check`)
      
      let repairedCount = 0
      let removedCount = 0
      
      for (const book of books) {
        try {
          // Check if PDF blob exists and is readable
          if (!book.pdfBlob || book.pdfBlob.size === 0) {
            console.log(`❌ Removing book with invalid blob: ${book.title}`)
            await bookService.deleteBook(book.id)
            removedCount++
            continue
          }
          
          // Try to read the blob
          const testChunk = book.pdfBlob.slice(0, 1000)
          await testChunk.arrayBuffer()
          
          // Check if it's a valid PDF
          const headerChunk = book.pdfBlob.slice(0, 4)
          const headerBuffer = await headerChunk.arrayBuffer()
          const headerBytes = new Uint8Array(headerBuffer)
          const signature = String.fromCharCode(...headerBytes)
          
          if (!signature.startsWith('%PDF')) {
            console.log(`❌ Removing book with invalid PDF signature: ${book.title}`)
            await bookService.deleteBook(book.id)
            removedCount++
            continue
          }
          
          console.log(`✅ Book OK: ${book.title}`)
          repairedCount++
          
        } catch (error) {
          console.log(`❌ Removing corrupted book: ${book.title}`, error)
          await bookService.deleteBook(book.id)
          removedCount++
        }
      }
      
      console.log(`🔧 Emergency repair complete: ${repairedCount} books OK, ${removedCount} books removed`)
      
    } catch (error) {
      console.error('Emergency repair failed:', error)
      throw error
    }
  }
}

export const databaseManager = new DatabaseManager()
export const bookService = new BookService()
export const characterService = new CharacterService()
export const pdfService = new PDFService()