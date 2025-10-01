import { Character, ExtractedCharacterData, GeminiResponse } from '../types'
import { characterService } from '../db/services'

const GEMINI_API_KEY = 'AIzaSyCSRMKrutHao_uOqRy_IgzmPURA68VR7Vs'
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

export class CharacterExtractionService {
  private normalizeCharacterName(name: string): string {
    // Remove titles and honorifics
    const cleanName = name.replace(/^(Mr|Mrs|Ms|Miss|Dr|Prof|Sir|Lady|Lord)\s+/i, '')
                         .replace(/\s+(Jr|Sr|III|IV)\s*$/i, '')
                         .trim()
    
    // Split into parts
    const parts = cleanName.split(/\s+/).filter(part => part.length > 1)
    
    // Return normalized format: "FirstName LastName" or just "Name" if single name
    return parts.join(' ')
  }

  private findSimilarCharacterNames(bookId: string, targetName: string, existingCharacters: Character[]): Character | null {
    const targetNormalized = this.normalizeCharacterName(targetName).toLowerCase()
    const targetParts = targetNormalized.split(' ')
    
    for (const character of existingCharacters) {
      if (character.bookId !== bookId) continue
      
      const existingNormalized = this.normalizeCharacterName(character.name).toLowerCase()
      const existingParts = existingNormalized.split(' ')
      
      // Check for exact match after normalization
      if (targetNormalized === existingNormalized) {
        return character
      }
      
      // Check if one name is a subset of another (e.g., "John" matches "John Smith")
      if (targetParts.length === 1 && existingParts.length > 1) {
        if (existingParts.includes(targetParts[0]) && targetParts[0].length > 2) {
          return character
        }
      }
      
      if (existingParts.length === 1 && targetParts.length > 1) {
        if (targetParts.includes(existingParts[0]) && existingParts[0].length > 2) {
          return character
        }
      }
      
      // Check for last name match (assuming last name is most significant)
      if (targetParts.length > 1 && existingParts.length > 1) {
        const targetLastName = targetParts[targetParts.length - 1]
        const existingLastName = existingParts[existingParts.length - 1]
        
        if (targetLastName === existingLastName && targetLastName.length > 2) {
          // Additional check: first letter of first name should match if available
          if (targetParts[0][0] === existingParts[0][0]) {
            return character
          }
        }
      }
      
      // Check for nickname/shortened name patterns
      const commonNicknames: { [key: string]: string[] } = {
        'william': ['bill', 'billy', 'will'],
        'robert': ['bob', 'bobby', 'rob'],
        'richard': ['rick', 'dick', 'rich'],
        'elizabeth': ['liz', 'beth', 'betty'],
        'margaret': ['meg', 'maggie', 'peggy'],
        'katherine': ['kate', 'katie', 'kathy'],
        'michael': ['mike', 'mick'],
        'christopher': ['chris'],
        'anthony': ['tony'],
        'benjamin': ['ben'],
        'samuel': ['sam'],
        'alexander': ['alex'],
        'nicholas': ['nick']
      }
      
      const checkNickname = (full: string, short: string): boolean => {
        const fullLower = full.toLowerCase()
        const shortLower = short.toLowerCase()
        
        if (commonNicknames[fullLower]?.includes(shortLower) || 
            commonNicknames[shortLower]?.includes(fullLower)) {
          return true
        }
        
        // Check if short name is prefix of full name (min 3 chars)
        if (shortLower.length >= 3 && fullLower.startsWith(shortLower)) {
          return true
        }
        
        return false
      }
      
      // Check nickname patterns between first names
      if (targetParts.length >= 1 && existingParts.length >= 1) {
        if (checkNickname(targetParts[0], existingParts[0]) || 
            checkNickname(existingParts[0], targetParts[0])) {
          
          // If we have matching nicknames, check last names if available
          if (targetParts.length > 1 && existingParts.length > 1) {
            if (targetParts[targetParts.length - 1] === existingParts[existingParts.length - 1]) {
              return character
            }
          } else {
            // Only first names available and they match as nicknames
            return character
          }
        }
      }
    }
    
    return null
  }

  private createCharacterExtractionPrompt(chapterText: string): string {
    return `Analyze the following book chapter and extract character information. ONLY include characters that meet these relevance criteria:

RELEVANCE CRITERIA (character must meet at least ONE):
- Mentioned 3 or more times in this chapter
- Has dialogue or speaks in the chapter
- Performs significant actions or drives the plot
- Has detailed description (physical appearance, personality, background)
- Interacts meaningfully with other important characters
- Is central to a scene or event in the chapter

DO NOT INCLUDE:
- Background characters mentioned only in passing
- Crowd members or unnamed individuals
- Characters mentioned only once without detail
- Historical figures mentioned in conversation but not present
- Generic roles (like "the waiter", "a guard") unless they have names and importance

For each RELEVANT character, provide:
1. Full name (as it appears in the text)
2. Occupation (if mentioned, otherwise "Unknown")
3. Age or age range (if mentioned, otherwise "Unknown")  
4. Location/residence (if mentioned, otherwise "Unknown")
5. Current status (Alive/Dead/Unknown)
6. Relevance level (Major/Supporting/Minor) based on their importance in this chapter
7. Brief description (one sentence summarizing who they are and why they're relevant)
8. Relationships with other characters in this chapter

Relevance Levels:
- Major: Central to the chapter, drives plot, has extensive dialogue/action
- Supporting: Important to scenes, meaningful interactions, some dialogue
- Minor: Relevant but limited role, few mentions but significant context

Relationships should include:
- Family relations (parent, child, sibling, married to)
- Romantic relationships (lovers, engaged to, dating)
- Conflicts (enemies, killed by, attacked by, fighting with)
- Professional connections (works with, servant of, mentor to, boss of)
- Friendships (friends with, allied with, companions)

Return ONLY valid JSON in this exact format with no additional text or markdown:
{
  "characters": [
    {
      "name": "Character Name",
      "occupation": "Their job or role",
      "age": "Age or age range",
      "location": "Where they live or are located",
      "status": "Alive",
      "relevance": "Major",
      "briefDescription": "One sentence description including why they're relevant",
      "relationships": [
        {
          "targetName": "Other Character Name",
          "type": "family",
          "description": "father of"
        }
      ]
    }
  ]
}

Relationship types must be exactly one of: family, romantic, conflict, professional, friendship, other
Relevance levels must be exactly one of: Major, Supporting, Minor

Chapter text:
${chapterText}`
  }

  async extractCharacters(
    bookId: string,
    chapterNumber: number,
    chapterText: string
  ): Promise<Character[]> {
    try {
      const prompt = this.createCharacterExtractionPrompt(chapterText)
      
      const response = await fetch(GEMINI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        })
      })

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`)
      }

      const data: GeminiResponse = await response.json()
      
      if (!data.candidates || data.candidates.length === 0) {
        throw new Error('No candidates returned from Gemini API')
      }

      const responseText = data.candidates[0].content.parts[0].text
      return await this.processGeminiResponse(bookId, chapterNumber, responseText)
      
    } catch (error) {
      console.error('Error extracting characters:', error)
      throw error
    }
  }

  private async processGeminiResponse(
    bookId: string,
    chapterNumber: number,
    responseText: string
  ): Promise<Character[]> {
    try {
      // Clean the response text to extract JSON
      const jsonStart = responseText.indexOf('{')
      const jsonEnd = responseText.lastIndexOf('}') + 1
      
      if (jsonStart === -1 || jsonEnd === 0) {
        throw new Error('No valid JSON found in response')
      }

      const jsonString = responseText.substring(jsonStart, jsonEnd)
      const parsed = JSON.parse(jsonString)
      
      if (!parsed.characters || !Array.isArray(parsed.characters)) {
        throw new Error('Invalid response format: missing characters array')
      }

      const characters: Character[] = []
      
      for (const extractedChar of parsed.characters as ExtractedCharacterData[]) {
        if (!extractedChar.name || extractedChar.name.trim() === '') {
          continue // Skip characters without names
        }

        // First get all existing characters for this book for name matching
        const allBookCharacters = await characterService.getCharactersForBook(bookId)
        
        // Check if character already exists (exact match)
        let existingCharacter = await characterService.findCharacterByName(bookId, extractedChar.name)
        
        // If no exact match, try fuzzy name matching
        if (!existingCharacter) {
          const fuzzyMatch = this.findSimilarCharacterNames(bookId, extractedChar.name, allBookCharacters)
          existingCharacter = fuzzyMatch || undefined
          
          // If we found a match through fuzzy matching, update the character name to be more complete
          if (existingCharacter) {
            const currentName = existingCharacter.name
            const newName = extractedChar.name
            
            // Keep the more complete name (longer or more formal)
            if (newName.length > currentName.length || 
                (newName.includes(' ') && !currentName.includes(' '))) {
              existingCharacter.name = newName
            }
          }
        }
        
        if (existingCharacter) {
          // Update existing character
          existingCharacter = await this.updateExistingCharacter(
            existingCharacter,
            extractedChar,
            chapterNumber
          )
          characters.push(existingCharacter)
        } else {
          // Create new character
          const newCharacter = await this.createNewCharacter(
            bookId,
            extractedChar,
            chapterNumber
          )
          characters.push(newCharacter)
        }
      }

      // Process relationships between characters
      await this.processRelationships(characters, parsed.characters as ExtractedCharacterData[], chapterNumber)
      
      return characters
      
    } catch (error) {
      console.error('Error processing Gemini response:', error)
      throw new Error('Failed to parse character data from AI response')
    }
  }

  private async updateExistingCharacter(
    existingCharacter: Character,
    extractedData: ExtractedCharacterData,
    chapterNumber: number
  ): Promise<Character> {
    // Update fields if new information is provided
    const updatedCharacter: Character = {
      ...existingCharacter,
      lastMentioned: chapterNumber,
      mentionCount: existingCharacter.mentionCount + 1
    }

    // Add new information (additive updates)
    if (extractedData.occupation && extractedData.occupation !== 'Unknown') {
      updatedCharacter.occupation = extractedData.occupation
    }
    
    if (extractedData.age && extractedData.age !== 'Unknown') {
      updatedCharacter.age = extractedData.age
    }
    
    if (extractedData.location && extractedData.location !== 'Unknown') {
      updatedCharacter.location = extractedData.location
    }
    
    if (extractedData.status && extractedData.status !== 'Unknown') {
      updatedCharacter.status = extractedData.status
    }
    
    if (extractedData.relevance) {
      // Upgrade relevance if it's higher importance
      const relevanceOrder = { 'Minor': 1, 'Supporting': 2, 'Major': 3 }
      if (relevanceOrder[extractedData.relevance] > relevanceOrder[updatedCharacter.relevance]) {
        updatedCharacter.relevance = extractedData.relevance
      }
    }
    
    if (extractedData.briefDescription) {
      updatedCharacter.briefDescription = extractedData.briefDescription
    }

    // Add chapter history entry
    const updates: string[] = []
    if (extractedData.occupation && extractedData.occupation !== 'Unknown') {
      updates.push(`Occupation: ${extractedData.occupation}`)
    }
    if (extractedData.briefDescription) {
      updates.push(extractedData.briefDescription)
    }
    
    if (updates.length > 0) {
      updatedCharacter.chapterHistory.push({
        chapter: chapterNumber,
        updates
      })
    }

    return updatedCharacter
  }

  private async createNewCharacter(
    bookId: string,
    extractedData: ExtractedCharacterData,
    chapterNumber: number
  ): Promise<Character> {
    const character: Character = {
      id: crypto.randomUUID(),
      bookId,
      name: extractedData.name,
      occupation: extractedData.occupation || 'Unknown',
      age: extractedData.age || 'Unknown',
      location: extractedData.location || 'Unknown',
      status: extractedData.status || 'Unknown',
      relevance: extractedData.relevance || 'Minor',
      relationships: [],
      firstAppearance: chapterNumber,
      lastMentioned: chapterNumber,
      briefDescription: extractedData.briefDescription,
      chapterHistory: [{
        chapter: chapterNumber,
        updates: [
          extractedData.briefDescription || 'First appearance',
          ...(extractedData.occupation && extractedData.occupation !== 'Unknown' ? [`Occupation: ${extractedData.occupation}`] : [])
        ]
      }],
      mentionCount: 1
    }

    return character
  }

  private async processRelationships(
    characters: Character[],
    extractedData: ExtractedCharacterData[],
    chapterNumber: number
  ): Promise<void> {
    // Create a map for quick character lookup
    const characterMap = new Map<string, Character>()
    characters.forEach(char => {
      characterMap.set(char.name.toLowerCase(), char)
    })

    // Process relationships for each character
    for (const extractedChar of extractedData) {
      const character = characterMap.get(extractedChar.name.toLowerCase())
      if (!character || !extractedChar.relationships) continue

      for (const rel of extractedChar.relationships) {
        const targetCharacter = characterMap.get(rel.targetName.toLowerCase())
        if (!targetCharacter) continue // Skip if target character not found

        // Check if relationship already exists
        const existingRel = character.relationships.find(
          r => r.targetCharacterId === targetCharacter.id && r.type === rel.type
        )

        if (!existingRel) {
          // Add new relationship
          character.relationships.push({
            targetCharacterId: targetCharacter.id,
            type: rel.type,
            description: rel.description,
            establishedInChapter: chapterNumber
          })
        }
      }
    }
  }
}

export const characterExtractionService = new CharacterExtractionService()