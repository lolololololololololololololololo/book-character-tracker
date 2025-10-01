import { useRef, useEffect, useState } from 'react'
import cytoscape from 'cytoscape'
import edgehandles from 'cytoscape-edgehandles'
import fcose from 'cytoscape-fcose'
import { Character } from '../types'

// Register extensions
;(cytoscape as any).use(edgehandles)
;(cytoscape as any).use(fcose)

interface CytoscapeCharacterMapProps {
  characters: Character[]
  currentChapter: number
  onCharacterSelect: (character: Character) => void
  className?: string
}

// Apple-inspired minimalist color palette
const RELATIONSHIP_COLORS = {
  family: '#007AFF',      // Apple blue - family bonds
  romantic: '#FF3B30',    // Apple red - passion
  conflict: '#FF9500',    // Apple orange - tension
  professional: '#34C759', // Apple green - work/growth
  friendship: '#5AC8FA',  // Apple light blue - friendship
  other: '#8E8E93'        // Apple gray - neutral
}

const NODE_COLORS = {
  active: '#007AFF',      // Apple blue - primary
  recent: '#5856D6',      // Apple purple - secondary
  inactive: '#D1D1D6',    // Apple light gray - inactive
  new: '#30D158',         // Apple green - new/fresh
  dead: '#8E8E93'         // Apple gray - subdued
}



export default function CytoscapeCharacterMap({ 
  characters, 
  currentChapter, 
  onCharacterSelect,
  className = '' 
}: CytoscapeCharacterMapProps) {
  const cyRef = useRef<HTMLDivElement>(null)
  const cyInstanceRef = useRef<any | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [nodePositions, setNodePositions] = useState<Map<string, {x: number, y: number}>>(new Map())
  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 })

  // Responsive resize handler
  useEffect(() => {
    const updateDimensions = () => {
      if (cyRef.current) {
        const rect = cyRef.current.getBoundingClientRect()
        const newDimensions = {
          width: rect.width || window.innerWidth - 100,
          height: rect.height || Math.max(400, window.innerHeight - 300)
        }
        setContainerDimensions(newDimensions)
        
        // Resize cytoscape instance if it exists
        if (cyInstanceRef.current) {
          cyInstanceRef.current.resize()
        }
      }
    }

    // Initial size
    updateDimensions()
    
    // Handle window resize
    window.addEventListener('resize', updateDimensions)
    
    // Handle orientation change on mobile
    window.addEventListener('orientationchange', () => {
      setTimeout(updateDimensions, 100)
    })
    
    return () => {
      window.removeEventListener('resize', updateDimensions)
      window.removeEventListener('orientationchange', updateDimensions)
    }
  }, [])

  const isNewInChapter = (character: Character): boolean => {
    return character.firstAppearance === currentChapter
  }

  const isCharacterTimedOut = (character: Character): boolean => {
    // Consider character timed out if not mentioned in last 3 chapters
    return currentChapter - character.lastMentioned > 3
  }

  const getNodeColor = (character: Character): string => {
    if (character.status === 'Dead') return NODE_COLORS.dead
    if (isNewInChapter(character)) return NODE_COLORS.new
    if (isCharacterTimedOut(character)) return NODE_COLORS.inactive
    if (currentChapter - character.lastMentioned <= 1) return NODE_COLORS.active
    return NODE_COLORS.recent
  }

  const getCharacterOpacity = (character: Character): number => {
    if (character.status === 'Dead') return 0.4
    if (isCharacterTimedOut(character)) return 0.6
    
    // Adjust opacity based on relevance
    switch (character.relevance) {
      case 'Major': return 1.0
      case 'Supporting': return 0.9
      case 'Minor': return 0.7
      default: return 1.0
    }
  }

  const getNodeDimensions = (character: Character, maxMentions: number): { width: number, height: number } => {
    if (maxMentions === 0) return { width: 100, height: 35 }
    
    // Check if mobile/touch device
    const isMobile = window.innerWidth < 768 || ('ontouchstart' in window)
    
    // Calculate base size from mention count
    const normalized = Math.log(character.mentionCount + 1) / Math.log(maxMentions + 1)
    let baseSize = isMobile ? 25 + normalized * 30 : 30 + normalized * 40 // Smaller on mobile
    
    // Adjust size based on relevance
    const relevanceMultiplier = character.relevance === 'Major' ? 1.2 : 
                               character.relevance === 'Supporting' ? 1.0 : 0.8
    baseSize *= relevanceMultiplier
    
    // Reduce size for timed-out characters
    if (isCharacterTimedOut(character)) {
      baseSize *= 0.7
    }
    
    // Calculate width based on text length with proper padding - adjusted for mobile
    const textLength = character.name.length
    const charWidth = isMobile ? 6 : 8 // Smaller char width on mobile
    const padding = isMobile ? 16 : 24 // Less padding on mobile
    const minWidth = textLength * charWidth + padding
    const calculatedWidth = Math.max(minWidth, baseSize * 1.8)
    
    // Height should be proportional but allow for text
    const height = Math.max(baseSize * 0.7, 32) // Minimum height for text
    
    return {
      width: Math.max(calculatedWidth, 80), // Minimum width
      height: Math.max(height, 32) // Minimum height
    }
  }

  const prepareGraphData = () => {
    // Filter characters that have appeared up to current chapter
    const visibleCharacters = characters.filter(
      char => char.firstAppearance <= currentChapter
    )

    // Calculate max mentions for node sizing
    const maxMentions = Math.max(...visibleCharacters.map(char => char.mentionCount), 1)

    // Create nodes in Cytoscape format
    const nodes: any[] = visibleCharacters.map(character => {
      const nodeDimensions = getNodeDimensions(character, maxMentions)
      const nodeColor = getNodeColor(character)
      const opacity = getCharacterOpacity(character)
      
      return {
        data: { 
          id: character.id, 
          label: character.name,
          character: character,
          width: nodeDimensions.width,
          height: nodeDimensions.height,
          color: nodeColor,
          opacity: opacity
        }
      }
    })

    // Create edges from relationships - merge bidirectional relationships
    const edges: any[] = []
    const nodeMap = new Map(visibleCharacters.map(char => [char.id, char]))
    const processedPairs = new Set<string>()

    visibleCharacters.forEach(character => {
      character.relationships.forEach(relationship => {
        // Only show relationships established up to current chapter
        if (relationship.establishedInChapter <= currentChapter) {
          const targetCharacter = nodeMap.get(relationship.targetCharacterId)
          
          if (targetCharacter) {
            // Create a consistent pair key (smaller ID first)
            const pairKey = character.id < relationship.targetCharacterId 
              ? `${character.id}-${relationship.targetCharacterId}` 
              : `${relationship.targetCharacterId}-${character.id}`
            
            // Skip if we've already processed this pair
            if (processedPairs.has(pairKey)) {
              return
            }
            
            edges.push({
              data: {
                id: pairKey,
                source: character.id,
                target: relationship.targetCharacterId,
                relationship: relationship,
                color: RELATIONSHIP_COLORS[relationship.type],
                label: '' // No labels for cleaner look
              }
            })
            
            processedPairs.add(pairKey)
          }
        }
      })
    })

    return { nodes, edges }
  }

  const initializeCytoscape = () => {
    if (!cyRef.current || isInitialized) return

    const { nodes, edges } = prepareGraphData()

    if (nodes.length === 0) return

    const cy = (cytoscape as any)({
      container: cyRef.current,
      
      elements: [...nodes, ...edges],
      
      style: [
        // Modern minimalist node styles
        {
          selector: 'node',
          style: {
            'width': 'data(width)',
            'height': 'data(height)',
            'background-color': 'data(color)',
            'border-width': 0, // Remove borders for cleaner look
            'label': 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            'color': (ele: any) => {
              // Dynamic text color based on background
              const character = ele.data('character')
              if (!character) return '#000000'
              if (character.status === 'Dead' || isCharacterTimedOut(character)) {
                return '#000000' // Dark text on light backgrounds
              }
              return '#FFFFFF' // White text on colored backgrounds
            },
            'font-family': '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif',
            'font-size': (ele: any) => {
              const height = ele.data('height')
              return Math.max(Math.min(height * 0.4, 14), 10) // Better font scaling
            },
            'font-weight': '600', // Medium weight like Apple
            'text-wrap': 'wrap',
            'text-max-width': (ele: any) => ele.data('width') - 16,
            'opacity': (ele: any) => ele.data('opacity'),
            'shape': 'round-rectangle',
            'border-radius': '12px', // Apple's standard radius
            'overlay-padding': '8px',
            // Subtle shadow for depth
            'shadow-blur': '8',
            'shadow-color': '#000000',
            'shadow-opacity': 0.1,
            'shadow-offset-x': '0',
            'shadow-offset-y': '2'
          }
        },
        
        // New character indicator - subtle accent
        {
          selector: 'node[character.firstAppearance = ' + currentChapter + ']',
          style: {
            'shadow-blur': '12',
            'shadow-color': '#30D158',
            'shadow-opacity': 0.4,
            'shadow-offset-x': '0',
            'shadow-offset-y': '0'
          }
        },
        
        // Dead character styling - muted appearance
        {
          selector: 'node[character.status = "Dead"]',
          style: {
            'background-color': '#F2F2F7',
            'color': '#8E8E93',
            'shadow-opacity': 0.05
          }
        },
        
        // Clean minimalist edge styles - undirected connections
        {
          selector: 'edge',
          style: {
            'width': 4, // Thicker for better visibility without arrows
            'line-color': 'data(color)',
            // Remove all arrow styling for undirected appearance
            'target-arrow-shape': 'none',
            'source-arrow-shape': 'none',
            'curve-style': 'straight', // Straight lines to minimize crossings
            'opacity': 0.85,
            // Remove all text/labels from edges for cleaner look
            'label': '', // No labels
            'text-opacity': 0 // Ensure no text is visible
          }
        },
        
        // Modern hover effects
        {
          selector: 'node:hover',
          style: {
            'shadow-blur': '16',
            'shadow-color': '#000000',
            'shadow-opacity': 0.2,
            'shadow-offset-y': '4',
            'z-index': 10,
            'transform': 'scale(1.05)' // Subtle scale on hover
          }
        },
        
        {
          selector: 'edge:hover',
          style: {
            'width': 3,
            'opacity': 1,
            'z-index': 10,
            'font-weight': '600' // Bold text on hover
          }
        },
        
        // Clean selection state
        {
          selector: 'node:selected',
          style: {
            'shadow-blur': '20',
            'shadow-color': '#007AFF',
            'shadow-opacity': 0.5,
            'shadow-offset-x': '0',
            'shadow-offset-y': '0',
            'z-index': 999,
            'transform': 'scale(1.1)'
          }
        },
        
        // Merge selection state - distinctive orange glow
        {
          selector: 'node.merge-selected',
          style: {
            'shadow-blur': '25',
            'shadow-color': '#FF9500',
            'shadow-opacity': 0.8,
            'shadow-offset-x': '0',
            'shadow-offset-y': '0',
            'z-index': 998,
            'transform': 'scale(1.15)',
            'border-width': '3px',
            'border-color': '#FF9500',
            'border-opacity': 0.9
          }
        },
        
        // Active edge when node is selected
        {
          selector: 'edge:selected, edge.highlighted',
          style: {
            'width': 3,
            'opacity': 1,
            'font-weight': '600'
          }
        }
      ],
      
      layout: {
        name: 'fcose',
        animate: false,
        // Quality vs Performance
        quality: 'proof',
        randomize: true, // Randomize for better initial layout
        // Fcose-specific parameters - much better node separation
        nodeRepulsion: (_node: any) => 20000, // Strong repulsion between nodes
        idealEdgeLength: (_edge: any) => 300, // Longer ideal edge length
        edgeElasticity: (_edge: any) => 0.3,
        // Prevent overlaps with large margins
        nodeSeparation: 150, // Minimum separation between nodes
        // Layout bounds and fitting
        fit: true,
        padding: 50,
        // Advanced fcose settings
        samplingType: true,
        sampleSize: 25,
        uniformNodeDimensions: false,
        // Iteration settings for better convergence
        numIter: 3000,
        tile: false,
        tilingPaddingVertical: 20,
        tilingPaddingHorizontal: 20,
        // Gravity and other forces
        gravity: 0.1,
        gravityRangeCompound: 1.5,
        gravityCompound: 1.0,
        gravityRange: 3.8,
        // Step size for iterations
        initialEnergyOnIncremental: 0.3
      },
      
      // Modern interaction options
      minZoom: 0.3,
      maxZoom: 2.5,
      zoomingEnabled: true,
      userZoomingEnabled: true,
      panningEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false,
      selectionType: 'single',
      touchTapThreshold: 6, // More responsive touch
      desktopTapThreshold: 3, // More responsive clicks
      autolock: false,
      autoungrabify: false,
      autounselectify: false,
      // Smooth wheel sensitivity like Apple trackpads
      wheelSensitivity: 0.2
    })

    // Restore saved positions before layout
    cy.nodes().forEach((node: any) => {
      const savedPos = nodePositions.get(node.id())
      if (savedPos) {
        node.position(savedPos)
      }
    })

    // Add event listeners
    cy.on('tap', 'node', (event: any) => {
      const node = event.target
      const character = node.data('character')
      if (character) {
        onCharacterSelect(character)
      }
    })

    // Touch-friendly character merge functionality
    let lastTapTime = 0
    let lastTappedNode: any = null
    let selectedForMerge: any = null

    // Double-tap to select for merge, then tap another to merge
    cy.on('tap', 'node', (event: any) => {
      const currentTime = new Date().getTime()
      const node = event.target
      const timeDiff = currentTime - lastTapTime

      // Double-tap detection (within 300ms)
      if (timeDiff < 300 && lastTappedNode && lastTappedNode.id() === node.id()) {
        // Double-tap: select/deselect for merge
        if (selectedForMerge && selectedForMerge.id() === node.id()) {
          // Deselect
          selectedForMerge.removeClass('merge-selected')
          selectedForMerge = null
          showMergeTooltip('Merge selection cancelled', 'info')
        } else {
          // Clear previous selection
          if (selectedForMerge) {
            selectedForMerge.removeClass('merge-selected')
          }
          // Select this node for merge
          selectedForMerge = node
          node.addClass('merge-selected')
          showMergeTooltip(`"${node.data('character').name}" selected for merge. Tap another character to merge with.`, 'merge')
        }
      } else if (selectedForMerge && selectedForMerge.id() !== node.id()) {
        // Single tap on different node while one is selected = merge
        handleCharacterMerge(selectedForMerge.data('character'), node.data('character'))
        selectedForMerge.removeClass('merge-selected')
        selectedForMerge = null
      } else {
        // Regular single tap - show character details
        const character = node.data('character')
        if (character) {
          onCharacterSelect(character)
        }
      }

      lastTapTime = currentTime
      lastTappedNode = node
    })

    // Save positions when nodes are moved
    cy.on('free', 'node', (event: any) => {
      const pos = event.target.position()
      setNodePositions(prev => new Map(prev.set(event.target.id(), pos)))
    })

    // Save positions after layout completes
    cy.on('layoutstop', () => {
      const positions = new Map()
      cy.nodes().forEach((node: any) => {
        positions.set(node.id(), node.position())
      })
      setNodePositions(positions)
    })

    // Add tooltip functionality
    cy.on('mouseover', 'node', (event: any) => {
      const node = event.target
      const character = node.data('character')
      
      if (character) {
        // Create modern Apple-style tooltip
        const tooltip = document.createElement('div')
        tooltip.className = 'character-tooltip'
        tooltip.style.cssText = `
          position: absolute;
          background: rgba(28, 28, 30, 0.98);
          color: #FFFFFF;
          padding: 16px 20px;
          border-radius: 14px;
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif;
          font-size: 15px;
          font-weight: 400;
          line-height: 1.4;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3), 0 0 0 0.5px rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(20px);
          border: 0.5px solid rgba(255, 255, 255, 0.15);
          pointer-events: none;
          z-index: 9999;
          max-width: 220px;
          transform: translateY(-8px);
        `
        
        tooltip.innerHTML = `
          <div style="font-weight: 600; font-size: 16px; margin-bottom: 8px; color: #FFFFFF;">${character.name}</div>
          <div style="font-size: 13px; color: #E5E5E7; line-height: 1.5;">
            <div style="margin-bottom: 3px;">Status: <span style="color: #FFFFFF;">${character.status}</span></div>
            <div style="margin-bottom: 3px;">Mentions: <span style="color: #FFFFFF;">${character.mentionCount}</span></div>
            <div>Relevance: <span style="color: #FFFFFF;">${character.relevance}</span></div>
          </div>
        `
        
        document.body.appendChild(tooltip)
        
        // Position tooltip near cursor
        const updateTooltipPosition = (e: MouseEvent) => {
          tooltip.style.left = (e.clientX + 15) + 'px'
          tooltip.style.top = (e.clientY - 10) + 'px'
        }
        
        document.addEventListener('mousemove', updateTooltipPosition)
        
        // Store cleanup function
        ;(tooltip as any).cleanup = () => {
          document.removeEventListener('mousemove', updateTooltipPosition)
          document.body.removeChild(tooltip)
        }
      }
    })

    cy.on('mouseout', 'node', () => {
      // Remove all tooltips
      document.querySelectorAll('.character-tooltip').forEach(tooltip => {
        if ((tooltip as any).cleanup) {
          ;(tooltip as any).cleanup()
        } else {
          tooltip.remove()
        }
      })
    })

    // Store the cytoscape instance
    cyInstanceRef.current = cy
    setIsInitialized(true)
  }

  const updateGraph = () => {
    if (!cyInstanceRef.current || !isInitialized) return

    const { nodes, edges } = prepareGraphData()
    const cy = cyInstanceRef.current

    // Remove all existing elements
    ;(cy as any).elements().remove()

    // Add new elements
    ;(cy as any).add([...nodes, ...edges])

    // Apply fcose layout for updates with reduced movement
    ;(cy as any).layout({
      name: 'fcose',
      animate: false,
      randomize: false, // Preserve existing positions
      fit: true,
      padding: 50,
      nodeRepulsion: 15000,
      idealEdgeLength: 250,
      numIter: 1000 // Fewer iterations for updates
    }).run()
  }

  useEffect(() => {
    if (!isInitialized) {
      initializeCytoscape()
    } else {
      updateGraph()
    }
  }, [characters, currentChapter, containerDimensions, isInitialized])

  // Auto-refresh when characters change significantly (e.g., after AI analysis)
  useEffect(() => {
    if (isInitialized && characters.length > 0) {
      // Auto-refresh with a slight delay to ensure UI is ready
      const timer = setTimeout(() => {
        randomizeAndReorder()
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [characters.length]) // Trigger when character count changes

  const handleCharacterMerge = async (sourceChar: Character, targetChar: Character) => {
    const confirmMessage = `Merge "${sourceChar.name}" into "${targetChar.name}"?\n\nThis will:\n• Combine their relationships and chapter history\n• Add "${sourceChar.name}" as an alias for "${targetChar.name}"\n• Delete the "${sourceChar.name}" character\n\nThis action cannot be undone.`
    
    if (window.confirm(confirmMessage)) {
      try {
        const { characterService } = await import('../db/services')
        await characterService.mergeCharacters(sourceChar.id, targetChar.id)
        
        // Force refresh the component by triggering a re-render
        if (cyInstanceRef.current) {
          cyInstanceRef.current.destroy()
          setIsInitialized(false)
        }
        
        // Show success message
        showMergeTooltip(`Successfully merged "${sourceChar.name}" into "${targetChar.name}"`, 'success')
      } catch (error) {
        console.error('Character merge failed:', error)
        showMergeTooltip(`Failed to merge characters: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
      }
    }
  }

  const showMergeTooltip = (message: string, type: 'merge' | 'success' | 'error' | 'info') => {
    // Remove existing merge tooltips
    document.querySelectorAll('.merge-tooltip').forEach(tooltip => tooltip.remove())

    const tooltip = document.createElement('div')
    tooltip.className = 'merge-tooltip'
    
    const colors = {
      merge: { bg: 'rgba(255, 149, 0, 0.95)', border: '#FF9500' },
      success: { bg: 'rgba(52, 199, 89, 0.95)', border: '#34C759' },
      error: { bg: 'rgba(255, 59, 48, 0.95)', border: '#FF3B30' },
      info: { bg: 'rgba(0, 122, 255, 0.95)', border: '#007AFF' }
    }
    
    tooltip.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: ${colors[type].bg};
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif;
      font-size: 15px;
      font-weight: 500;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      border: 2px solid ${colors[type].border};
      z-index: 10000;
      max-width: 90vw;
      text-align: center;
      backdrop-filter: blur(10px);
    `
    
    tooltip.textContent = message
    document.body.appendChild(tooltip)
    
    // Auto-remove after delay
    setTimeout(() => {
      if (tooltip.parentNode) {
        tooltip.style.opacity = '0'
        tooltip.style.transform = 'translateX(-50%) translateY(-20px)'
        setTimeout(() => tooltip.remove(), 300)
      }
    }, type === 'merge' ? 4000 : 2500)
  }



  const reorderNodes = () => {
    if (!cyInstanceRef.current) return

    const cy = cyInstanceRef.current
    showMergeTooltip('Reordering nodes...', 'info')

    // Clear any previous merge selections
    cy.nodes().removeClass('merge-selected')

    // Apply fcose layout with animation for visual feedback
    const layout = cy.layout({
      name: 'fcose',
      animate: true,
      animationDuration: 1000,
      animationEasing: 'ease-out-cubic',
      // High-quality fcose parameters for optimal spacing
      quality: 'proof',
      randomize: false, // Don't randomize, improve current positions
      // Strong node separation
      nodeRepulsion: (_node: any) => 25000, // Even stronger repulsion
      idealEdgeLength: (_edge: any) => 350, // Longer ideal edges
      edgeElasticity: (_edge: any) => 0.2, // Less elastic edges
      // Advanced spacing control
      nodeSeparation: 200, // Minimum 200px between nodes
      // Layout bounds
      fit: true,
      padding: 60, // Consistent padding matching UI elements
      // Sampling for better performance on large graphs
      samplingType: true,
      sampleSize: 30,
      // Iteration control for quality
      numIter: 4000, // More iterations for better convergence
      // Gravity settings
      gravity: 0.05, // Lower gravity to spread nodes more
      gravityRangeCompound: 2.0,
      gravityCompound: 0.8,
      gravityRange: 4.5,
      // Energy and convergence
      initialEnergyOnIncremental: 0.2,
      // Tiling (for disconnected components)
      tile: true,
      tilingPaddingVertical: 50,
      tilingPaddingHorizontal: 50
    })

    // Run the layout
    layout.run()

    // Save new positions after layout completes
    layout.one('layoutstop', () => {
      const newPositions = new Map()
      cy.nodes().forEach((node: any) => {
        const pos = node.position()
        newPositions.set(node.id(), pos)
      })
      setNodePositions(newPositions)
      showMergeTooltip('Nodes reordered successfully!', 'success')
    })
  }

  const randomizeAndReorder = () => {
    if (!cyInstanceRef.current) return

    const cy = cyInstanceRef.current
    showMergeTooltip('Randomizing and reordering...', 'info')

    // Clear any previous merge selections
    cy.nodes().removeClass('merge-selected')

    // First randomize positions, then apply fcose layout
    const layout = cy.layout({
      name: 'fcose',
      animate: true,
      animationDuration: 1200,
      animationEasing: 'ease-out-cubic',
      // High-quality fcose parameters
      quality: 'proof',
      randomize: true, // Randomize initial positions
      // Even stronger node separation for fresh layout
      nodeRepulsion: (_node: any) => 30000,
      idealEdgeLength: (_edge: any) => 400,
      edgeElasticity: (_edge: any) => 0.15,
      // Advanced spacing control
      nodeSeparation: 250,
      // Layout bounds
      fit: true,
      padding: 60, // Consistent padding matching UI elements
      // High-quality sampling
      samplingType: true,
      sampleSize: 35,
      // More iterations for perfect convergence
      numIter: 5000,
      // Low gravity for maximum spread
      gravity: 0.02,
      gravityRangeCompound: 2.5,
      gravityCompound: 0.6,
      gravityRange: 5.0,
      // Energy settings
      initialEnergyOnIncremental: 0.1,
      // Tiling settings
      tile: true,
      tilingPaddingVertical: 75,
      tilingPaddingHorizontal: 75
    })

    layout.run()

    // Save new positions after layout completes
    layout.one('layoutstop', () => {
      const newPositions = new Map()
      cy.nodes().forEach((node: any) => {
        const pos = node.position()
        newPositions.set(node.id(), pos)
      })
      setNodePositions(newPositions)
      showMergeTooltip('Nodes randomized and reordered successfully!', 'success')
    })
  }

  // Cleanup on unmount

  useEffect(() => {
    return () => {
      if (cyInstanceRef.current) {
        ;(cyInstanceRef.current as any).destroy()
      }
      // Clean up any remaining tooltips
      document.querySelectorAll('.character-tooltip').forEach(tooltip => {
        tooltip.remove()
      })
    }
  }, [])

  return (
    <div className={`character-map-container relative w-full h-full ${className}`}>
      <div
        ref={cyRef}
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '16px', // Larger Apple-style radius
          background: '#FFFFFF', // Clean white background
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)', // Subtle depth shadow
          border: '1px solid rgba(0, 0, 0, 0.06)', // Very subtle border
          overflow: 'hidden'
        }}
      />
      
      {/* Control Panel - Bottom Right */}
      <div className="absolute bottom-4 right-4 flex flex-col space-y-2 z-20">
        <button
          onClick={reorderNodes}
          title="Reorganize nodes using fCoSE algorithm for better spacing"
          className="px-3 py-2 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white text-xs font-medium rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95"
          style={{ 
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif'
          }}
        >
          � Reorder
        </button>
        
        <button
          onClick={randomizeAndReorder}
          title="Randomize positions and apply fCoSE layout for fresh arrangement"
          className="px-4 py-2.5 bg-purple-500 hover:bg-purple-600 active:bg-purple-700 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95"
          style={{ 
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif',
            minWidth: '100px'
          }}
        >
          🎲 Randomize
        </button>
      </div>

      {/* Color Legend */}
      <div className="absolute bottom-6 left-6 bg-white bg-opacity-95 backdrop-blur-sm rounded-lg shadow-lg p-4 z-20"
           style={{ 
             fontSize: '12px',
             fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif',
             minWidth: '160px'
           }}>
        <h4 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Relationship Types</h4>
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-0.5" style={{ backgroundColor: RELATIONSHIP_COLORS.family, borderRadius: '2px' }}></div>
            <span className="text-xs text-gray-600">Family</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-0.5" style={{ backgroundColor: RELATIONSHIP_COLORS.friendship, borderRadius: '2px' }}></div>
            <span className="text-xs text-gray-600">Friendship</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-0.5" style={{ backgroundColor: RELATIONSHIP_COLORS.conflict, borderRadius: '2px' }}></div>
            <span className="text-xs text-gray-600">Conflict</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-0.5" style={{ backgroundColor: RELATIONSHIP_COLORS.romantic, borderRadius: '2px' }}></div>
            <span className="text-xs text-gray-600">Romantic</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-0.5" style={{ backgroundColor: RELATIONSHIP_COLORS.professional, borderRadius: '2px' }}></div>
            <span className="text-xs text-gray-600">Professional</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-0.5" style={{ backgroundColor: RELATIONSHIP_COLORS.other, borderRadius: '2px' }}></div>
            <span className="text-xs text-gray-600">Other</span>
          </div>
        </div>
      </div>
      
      {characters.length === 0 && (
        <div 
          className="absolute inset-0 flex items-center justify-center"
          style={{ 
            width: containerDimensions.width || '100%', 
            height: containerDimensions.height || 400,
            color: '#8E8E93', // Apple gray
            fontSize: '17px', // Apple's body text size
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif',
            fontWeight: '400'
          }}
        >
          No characters found yet. Analyze a chapter to get started.
        </div>
      )}
    </div>
  )
}