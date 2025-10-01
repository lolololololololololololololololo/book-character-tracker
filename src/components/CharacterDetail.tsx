import { Character } from '../types'

interface CharacterDetailProps {
  character: Character
  characters: Character[]
  currentChapter: number
  onClose: () => void
}

const RELATIONSHIP_COLORS = {
  family: '#3B82F6',      // Blue
  romantic: '#EF4444',    // Red
  conflict: '#991B1B',    // Dark Red
  professional: '#10B981', // Green
  friendship: '#F59E0B',   // Yellow/Amber
  other: '#6B7280'        // Gray
}

const RELATIONSHIP_LABELS = {
  family: 'Family',
  romantic: 'Romance',
  conflict: 'Conflict',
  professional: 'Professional',
  friendship: 'Friendship',
  other: 'Other'
}

export default function CharacterDetail({ 
  character, 
  characters, 
  currentChapter, 
  onClose 
}: CharacterDetailProps) {
  
  const getRelatedCharacter = (targetId: string): Character | undefined => {
    return characters.find(char => char.id === targetId)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Dead':
        return <span className="text-red-600">💀</span>
      case 'Alive':
        return <span className="text-green-600">✓</span>
      default:
        return <span className="text-gray-400">❓</span>
    }
  }

  const relevantRelationships = character.relationships.filter(
    rel => rel.establishedInChapter <= currentChapter
  )

  const relevantHistory = character.chapterHistory.filter(
    hist => hist.chapter <= currentChapter
  )

  return (
    <div className="bg-white rounded-lg shadow-sm border h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-2 sm:p-4 border-b flex-shrink-0">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">{character.name}</h2>
              {getStatusIcon(character.status)}
            </div>
            <div className="flex gap-2 text-xs sm:text-sm text-gray-600">
              <span className={`px-2 py-1 rounded-full text-xs ${
                character.relevance === 'Major' ? 'bg-blue-100 text-blue-800' :
                character.relevance === 'Supporting' ? 'bg-green-100 text-green-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {character.relevance}
              </span>
              <span>First appeared: Ch. {character.firstAppearance}</span>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
            title="Close character details"
          >
            <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-2 sm:p-4 space-y-4 sm:space-y-6 overflow-y-auto">
        {/* Basic Information */}
        <div>
          <h3 className="font-medium text-gray-900 mb-3">Information</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Occupation:</span>
              <span className="text-gray-900">{character.occupation || 'Unknown'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Age:</span>
              <span className="text-gray-900">{character.age || 'Unknown'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Location:</span>
              <span className="text-gray-900">{character.location || 'Unknown'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Status:</span>
              <span className={`font-medium ${
                character.status === 'Alive' ? 'text-green-600' : 
                character.status === 'Dead' ? 'text-red-600' : 'text-gray-500'
              }`}>
                {character.status}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">First Appearance:</span>
              <span className="text-gray-900">Chapter {character.firstAppearance}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Last Mentioned:</span>
              <span className="text-gray-900">Chapter {character.lastMentioned}</span>
            </div>
          </div>
        </div>

        {/* Relationships */}
        {relevantRelationships.length > 0 && (
          <div>
            <h3 className="font-medium text-gray-900 mb-3">Relationships</h3>
            <div className="space-y-2">
              {relevantRelationships.map((relationship, index) => {
                const relatedChar = getRelatedCharacter(relationship.targetCharacterId)
                if (!relatedChar) return null

                return (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded-md text-sm"
                  >
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: RELATIONSHIP_COLORS[relationship.type] }}
                      />
                      <span className="font-medium">{relatedChar.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-gray-700">
                        {relationship.description}
                      </div>
                      <div className="text-xs text-gray-500">
                        {RELATIONSHIP_LABELS[relationship.type]}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Chapter History */}
        {relevantHistory.length > 0 && (
          <div>
            <h3 className="font-medium text-gray-900 mb-3">Chapter History</h3>
            <div className="space-y-3">
              {relevantHistory.map((history, index) => (
                <div key={index} className="border-l-2 border-blue-200 pl-3">
                  <div className="font-medium text-sm text-blue-600 mb-1">
                    Chapter {history.chapter}
                  </div>
                  <ul className="space-y-1">
                    {history.updates.map((update, updateIndex) => (
                      <li key={updateIndex} className="text-sm text-gray-600">
                        • {update}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="bg-gray-50 rounded-md p-3">
          <h3 className="font-medium text-gray-900 mb-2 text-sm">Statistics</h3>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="text-center">
              <div className="font-semibold text-blue-600">{character.mentionCount}</div>
              <div className="text-gray-600">Total Mentions</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-green-600">{relevantRelationships.length}</div>
              <div className="text-gray-600">Relationships</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}