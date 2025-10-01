export interface Book {
  id: string
  title: string
  author: string
  fileName: string
  pdfBlob: Blob
  totalChapters: number
  currentChapter: number
  chapterBoundaries: ChapterBoundary[]
  uploadDate: string
}

export interface ChapterBoundary {
  chapter: number
  startPage: number
  endPage: number
}

export interface Character {
  id: string
  bookId: string
  name: string
  occupation?: string
  age?: string
  location?: string
  status: 'Alive' | 'Dead' | 'Unknown'
  relevance: 'Major' | 'Supporting' | 'Minor'
  relationships: Relationship[]
  firstAppearance: number
  lastMentioned: number
  briefDescription?: string
  chapterHistory: ChapterHistory[]
  mentionCount: number
  aliases?: string[]
}

export interface Relationship {
  targetCharacterId: string
  type: 'family' | 'romantic' | 'conflict' | 'professional' | 'friendship' | 'other'
  description: string
  establishedInChapter: number
}

export interface ChapterHistory {
  chapter: number
  updates: string[]
}

export interface Settings {
  id: string
  currentBookId?: string
  theme: 'light' | 'dark'
}

export interface CharacterNode extends d3.SimulationNodeDatum {
  id: string
  character: Character
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
}

export interface CharacterLink extends d3.SimulationLinkDatum<CharacterNode> {
  source: CharacterNode
  target: CharacterNode
  relationship: Relationship
}

export interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string
      }>
    }
  }>
}

export interface Chapter {
  index: number
  title: string
  startPage?: number
  endPage?: number
  isComplete: boolean
}

export interface ExtractedCharacterData {
  name: string
  occupation?: string
  age?: string
  location?: string
  status: 'Alive' | 'Dead' | 'Unknown'
  relevance: 'Major' | 'Supporting' | 'Minor'
  briefDescription?: string
  relationships: Array<{
    targetName: string
    type: 'family' | 'romantic' | 'conflict' | 'professional' | 'friendship' | 'other'
    description: string
  }>
}