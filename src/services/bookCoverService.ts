/**
 * Service for fetching book cover images from OpenLibrary API
 * OpenLibrary API Documentation: https://openlibrary.org/dev/docs/api/covers
 */

export interface BookCoverData {
  coverUrl: string | null
  isbn?: string
  title: string
  author: string
}

/**
 * Search for a book's ISBN using OpenLibrary search API
 */
async function searchBookISBN(title: string, author: string): Promise<string | null> {
  try {
    const query = `title:"${title}" author:"${author}"`
    const searchUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=5`
    
    const response = await fetch(searchUrl)
    if (!response.ok) return null
    
    const data = await response.json()
    
    if (data.docs && data.docs.length > 0) {
      // Try to find the best match
      for (const doc of data.docs) {
        if (doc.isbn && doc.isbn.length > 0) {
          return doc.isbn[0] // Return the first ISBN
        }
      }
    }
    
    return null
  } catch (error) {
    console.warn('Error searching for book ISBN:', error)
    return null
  }
}

/**
 * Get cover URL from OpenLibrary using different methods
 */
export async function getBookCover(title: string, author: string): Promise<BookCoverData> {
  const result: BookCoverData = {
    coverUrl: null,
    title,
    author
  }

  try {
    // Method 1: Try to find ISBN first for better cover quality
    const isbn = await searchBookISBN(title, author)
    
    if (isbn) {
      result.isbn = isbn
      const isbnCoverUrl = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`
      
      // Check if ISBN cover exists
      const isbnResponse = await fetch(isbnCoverUrl, { method: 'HEAD' })
      if (isbnResponse.ok && isbnResponse.headers.get('content-type')?.includes('image')) {
        result.coverUrl = isbnCoverUrl
        return result
      }
    }

    // Method 2: Try title-based search for OpenLibrary ID
    const searchUrl = `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}&limit=1`
    const searchResponse = await fetch(searchUrl)
    
    if (searchResponse.ok) {
      const searchData = await searchResponse.json()
      
      if (searchData.docs && searchData.docs.length > 0) {
        const book = searchData.docs[0]
        
        // Try cover_i (cover ID)
        if (book.cover_i) {
          const coverUrl = `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg`
          result.coverUrl = coverUrl
          return result
        }
        
        // Try key-based cover
        if (book.key) {
          const olid = book.key.replace('/works/', '')
          const olidCoverUrl = `https://covers.openlibrary.org/w/olid/${olid}-L.jpg`
          result.coverUrl = olidCoverUrl
          return result
        }
      }
    }

    // Method 3: Fallback - generate a placeholder or return null
    return result
    
  } catch (error) {
    console.warn('Error fetching book cover:', error)
    return result
  }
}

/**
 * Create a cache for book covers to avoid repeated API calls
 */
class BookCoverCache {
  private cache = new Map<string, BookCoverData>()
  
  private getCacheKey(title: string, author: string): string {
    return `${title.toLowerCase().trim()}_${author.toLowerCase().trim()}`
  }
  
  async getCover(title: string, author: string): Promise<BookCoverData> {
    const key = this.getCacheKey(title, author)
    
    if (this.cache.has(key)) {
      return this.cache.get(key)!
    }
    
    const coverData = await getBookCover(title, author)
    this.cache.set(key, coverData)
    
    return coverData
  }
  
  clearCache(): void {
    this.cache.clear()
  }
}

export const bookCoverCache = new BookCoverCache()