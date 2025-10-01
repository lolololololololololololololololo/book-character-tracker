import Dexie, { Table } from 'dexie'
import { Book, Character, Settings } from '../types'

export class BookCharacterDB extends Dexie {
  books!: Table<Book>
  characters!: Table<Character>
  settings!: Table<Settings>

  constructor() {
    super('BookCharacterDatabase')
    
    // Safari-compatible: Simpler schema without complex indexes
    this.version(1).stores({
      books: 'id, fileName',
      characters: 'id, bookId',
      settings: 'id'
    })

    // Safari-compatible: Handle ready event
    this.on('ready', () => {
      if (console && console.log) {
        console.log('Database ready')
      }
      return Promise.resolve()
    })
  }
}

export const db = new BookCharacterDB()