# Character Merge Feature Documentation

## Overview
The Character Merge feature allows users to combine duplicate characters that may be created when the AI misinterprets nicknames, alternative names, or character references.

## How to Use

### Merging Characters
1. **Drag and Drop**: Click and drag one character node onto another character node in the character map
2. **Confirmation Dialog**: A confirmation dialog will appear asking if you want to merge the characters
3. **Review**: The dialog shows what will happen:
   - Relationships and chapter history will be combined
   - The source character's name will be added as an alias
   - The source character will be deleted

### What Happens During Merge
- **Mention Counts**: Combined from both characters
- **First Appearance**: Uses the earliest chapter appearance
- **Relationships**: Merged together (duplicates removed automatically)
- **Chapter History**: Combined and sorted by chapter number
- **Aliases**: Source character name is preserved as an alias
- **References**: All relationship references to the source character are updated to point to the target character

### Layout Improvements
- **Stable Positioning**: Node positions are preserved between chapters
- **fcose Layout**: Advanced force-directed layout minimizes edge crossings
- **No Overlap**: Characters are positioned to avoid overlapping
- **Minimal Movement**: When new characters are added, existing characters move only slightly

## Technical Details

### Layout Engine
- Uses `cytoscape-fcose` for optimal node placement
- Prevents edge crossings through advanced algorithms
- Maintains stable positions with `randomize: false`
- Saves and restores node positions between renders

### Database Operations
- Atomic merge operations ensure data consistency
- Automatic cleanup of orphaned relationships
- Preserves data integrity through proper foreign key updates
- Supports rollback in case of merge failures

### Performance
- Lazy loading of merge functionality
- Efficient position caching
- Minimal re-renders during merge operations

## Best Practices

### When to Merge Characters
- AI created duplicate characters for the same person
- Character has multiple names/nicknames that confused the AI
- Similar character names led to separate character entries

### Merge Direction
- Always merge FROM the less complete character TO the more complete character
- Keep the character with more relationships and chapter history as the target
- Consider which name is more commonly used in the story

## Troubleshooting

### Merge Failed
- Ensure both characters are from the same book
- Check that characters exist in the database
- Verify sufficient disk space for database operations

### Layout Issues  
- Refresh the graph if nodes appear overlapped
- Clear browser cache if positions seem corrupted
- Restart the application if layout becomes unstable

## Future Enhancements
- Undo merge functionality
- Batch merge operations
- Advanced merge conflict resolution
- Character similarity detection