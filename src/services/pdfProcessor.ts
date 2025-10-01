import * as pdfjsLib from 'pdfjs-dist'
import { ChapterBoundary } from '../types'

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

export class PDFProcessor {
  private pdfDocument: pdfjsLib.PDFDocumentProxy | null = null

  async loadPDF(file: File): Promise<void> {
    const arrayBuffer = await file.arrayBuffer()
    this.pdfDocument = await pdfjsLib.getDocument(arrayBuffer).promise
  }

  async extractTextFromPage(pageNumber: number): Promise<{ text: string; fontSize: number[] }> {
    if (!this.pdfDocument) {
      throw new Error('PDF not loaded')
    }

    const page = await this.pdfDocument.getPage(pageNumber)
    const textContent = await page.getTextContent()
    
    let text = ''
    const fontSizes: number[] = []

    textContent.items.forEach((item) => {
      if ('str' in item) {
        text += item.str + ' '
        if ('height' in item) {
          fontSizes.push(item.height)
        }
      }
    })

    return { text: text.trim(), fontSize: fontSizes }
  }

  async extractChapterText(chapterBoundary: ChapterBoundary): Promise<string> {
    let chapterText = ''
    
    for (let page = chapterBoundary.startPage; page <= chapterBoundary.endPage; page++) {
      const { text } = await this.extractTextFromPage(page)
      chapterText += text + '\n'
    }
    
    return chapterText
  }

  async detectChapters(): Promise<ChapterBoundary[]> {
    if (!this.pdfDocument) {
      throw new Error('PDF not loaded')
    }

    const totalPages = this.pdfDocument.numPages

    
    // Method 1: Look for explicit chapter markers
    const explicitChapters = await this.findExplicitChapterMarkers(totalPages)
    if (explicitChapters.length > 0) {
      return this.createChapterBoundaries(explicitChapters, totalPages)
    }

    // Method 2: Analyze font sizes
    const fontSizeChapters = await this.findChaptersByFontSize(totalPages)
    if (fontSizeChapters.length > 0) {
      return this.createChapterBoundaries(fontSizeChapters, totalPages)
    }

    // Method 3: Manual fallback - return single chapter
    return [{
      chapter: 1,
      startPage: 1,
      endPage: totalPages
    }]
  }

  private async findExplicitChapterMarkers(totalPages: number): Promise<number[]> {
    const chapterPages: number[] = []
    const chapterPatterns = [
      /chapter\s+(\d+)/i,
      /chapter\s+([ivxlcdm]+)/i,
      /ch\.\s*(\d+)/i,
      /^(\d+)\.\s*[A-Z]/,
      /^[A-Z\s]+$/  // All caps lines (potential chapter titles)
    ]

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      try {
        const { text } = await this.extractTextFromPage(pageNum)
        const lines = text.split('\n').map(line => line.trim())

        for (const line of lines) {
          for (const pattern of chapterPatterns) {
            if (pattern.test(line)) {
              chapterPages.push(pageNum)
              break
            }
          }
        }
      } catch (error) {
        console.warn(`Error processing page ${pageNum}:`, error)
      }
    }

    return this.deduplicateChapterPages(chapterPages)
  }

  private async findChaptersByFontSize(totalPages: number): Promise<number[]> {
    const chapterPages: number[] = []
    const fontSizeData: { page: number; maxFontSize: number; avgFontSize: number }[] = []

    // Collect font size data for all pages
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      try {
        const { fontSize } = await this.extractTextFromPage(pageNum)
        if (fontSize.length > 0) {
          const maxFontSize = Math.max(...fontSize)
          const avgFontSize = fontSize.reduce((sum, size) => sum + size, 0) / fontSize.length
          fontSizeData.push({ page: pageNum, maxFontSize, avgFontSize })
        }
      } catch (error) {
        console.warn(`Error processing page ${pageNum}:`, error)
      }
    }

    if (fontSizeData.length === 0) return []

    // Find pages with significantly larger fonts (potential chapter starts)
    const avgMaxFontSize = fontSizeData.reduce((sum, data) => sum + data.maxFontSize, 0) / fontSizeData.length
    const fontSizeThreshold = avgMaxFontSize * 1.2 // 20% larger than average

    fontSizeData.forEach(data => {
      if (data.maxFontSize > fontSizeThreshold) {
        chapterPages.push(data.page)
      }
    })

    return this.deduplicateChapterPages(chapterPages)
  }

  private deduplicateChapterPages(pages: number[]): number[] {
    // Remove duplicates and ensure minimum distance between chapters
    const uniquePages = [...new Set(pages)].sort((a, b) => a - b)
    const filteredPages: number[] = []

    uniquePages.forEach(page => {
      if (filteredPages.length === 0 || page - filteredPages[filteredPages.length - 1] > 3) {
        filteredPages.push(page)
      }
    })

    return filteredPages
  }

  private createChapterBoundaries(chapterPages: number[], totalPages: number): ChapterBoundary[] {
    const boundaries: ChapterBoundary[] = []
    
    // Ensure we start from page 1
    if (chapterPages[0] !== 1) {
      chapterPages.unshift(1)
    }

    for (let i = 0; i < chapterPages.length; i++) {
      const startPage = chapterPages[i]
      const endPage = i < chapterPages.length - 1 ? chapterPages[i + 1] - 1 : totalPages
      
      boundaries.push({
        chapter: i + 1,
        startPage,
        endPage
      })
    }

    return boundaries
  }

  getTotalPages(): number {
    return this.pdfDocument?.numPages || 0
  }

  cleanup(): void {
    if (this.pdfDocument) {
      this.pdfDocument.destroy()
      this.pdfDocument = null
    }
  }
}