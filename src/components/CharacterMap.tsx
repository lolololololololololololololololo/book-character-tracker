import { useRef, useEffect, useState } from 'react'
import * as d3 from 'd3'
import { Character, CharacterNode, CharacterLink } from '../types'

interface CharacterMapProps {
  characters: Character[]
  currentChapter: number
  onCharacterSelect: (character: Character) => void
  containerWidth: number
  containerHeight: number
}

const RELATIONSHIP_COLORS = {
  family: '#6366f1',      // Modern indigo
  romantic: '#ec4899',    // Modern pink
  conflict: '#dc2626',    // Modern red
  professional: '#059669', // Modern emerald
  friendship: '#f59e0b',   // Modern amber
  other: '#6b7280'        // Modern gray
}

const MIN_NODE_SIZE = 40
const MAX_NODE_SIZE = 80

// Modern color palette for nodes
const NODE_COLORS = {
  active: '#3b82f6',      // Blue
  recent: '#8b5cf6',      // Purple
  inactive: '#9ca3af',    // Gray
  new: '#10b981',         // Green
  dead: '#ef4444'         // Red
}

export default function CharacterMap({ 
  characters, 
  currentChapter, 
  onCharacterSelect, 
  containerWidth, 
  containerHeight 
}: CharacterMapProps) {
  const svgRef = useRef<SVGSVGElement>(null)


  const [animatedNodes, setAnimatedNodes] = useState(new Set<string>())
  const [lastChapter, setLastChapter] = useState<number>(0)

  const calculateNodeDimensions = (character: Character, maxMentions: number, isTimedOut: boolean) => {
    if (maxMentions === 0) return { width: MIN_NODE_SIZE * 2, height: MIN_NODE_SIZE }
    
    const normalized = Math.log(character.mentionCount + 1) / Math.log(maxMentions + 1)
    let baseHeight = MIN_NODE_SIZE + normalized * (MAX_NODE_SIZE - MIN_NODE_SIZE)
    
    // Adjust size based on relevance
    const relevanceMultiplier = character.relevance === 'Major' ? 1.2 : 
                               character.relevance === 'Supporting' ? 1.0 : 0.7
    baseHeight *= relevanceMultiplier
    
    // Calculate width based on name length
    const nameLength = character.name.length
    let baseWidth = Math.max(nameLength * 8 + 20, baseHeight * 1.5) // Ensure width fits name
    baseWidth *= relevanceMultiplier
    
    // Reduce size for timed-out characters
    const height = isTimedOut ? baseHeight * 0.7 : baseHeight
    const width = isTimedOut ? baseWidth * 0.7 : baseWidth
    
    return { width, height }
  }

  const isNewInChapter = (character: Character): boolean => {
    return character.firstAppearance === currentChapter
  }

  const isCharacterTimedOut = (character: Character): boolean => {
    // Consider character timed out if not mentioned in last 3 chapters
    return currentChapter - character.lastMentioned > 3
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

  const getNodeColor = (character: Character): string => {
    if (character.status === 'Dead') return NODE_COLORS.dead
    if (isNewInChapter(character)) return NODE_COLORS.new
    if (isCharacterTimedOut(character)) return NODE_COLORS.inactive
    if (currentChapter - character.lastMentioned <= 1) return NODE_COLORS.active
    return NODE_COLORS.recent
  }

  const prepareGraphData = () => {
    // Filter characters that have appeared up to current chapter
    const visibleCharacters = characters.filter(
      char => char.firstAppearance <= currentChapter
    )

    // Calculate max mentions for node sizing
    const maxMentions = Math.max(...visibleCharacters.map(char => char.mentionCount), 1)

    // Create nodes
    const nodes: CharacterNode[] = visibleCharacters.map(character => ({
      id: character.id,
      character,
      x: Math.random() * containerWidth,
      y: Math.random() * containerHeight
    }))

    // Create links from relationships
    const links: CharacterLink[] = []
    const nodeMap = new Map(nodes.map(node => [node.id, node]))

    visibleCharacters.forEach(character => {
      character.relationships.forEach(relationship => {
        // Only show relationships established up to current chapter
        if (relationship.establishedInChapter <= currentChapter) {
          const targetNode = nodeMap.get(relationship.targetCharacterId)
          const sourceNode = nodeMap.get(character.id)
          
          if (sourceNode && targetNode) {
            links.push({
              source: sourceNode,
              target: targetNode,
              relationship
            })
          }
        }
      })
    })

    return { nodes, links, maxMentions }
  }

  useEffect(() => {
    if (!svgRef.current || characters.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove() // Clear previous render

    const { nodes, links, maxMentions } = prepareGraphData()

    if (nodes.length === 0) return

    // Detect new nodes for entrance animations
    const newNodeIds = new Set<string>()
    const chapterChanged = currentChapter !== lastChapter
    
    nodes.forEach(node => {
      if (!animatedNodes.has(node.id) || (isNewInChapter(node.character) && chapterChanged)) {
        newNodeIds.add(node.id)
      }
    })

    // Update state
    if (chapterChanged) {
      setLastChapter(currentChapter)
    }
    
    setAnimatedNodes(prev => {
      const newSet = new Set(prev)
      nodes.forEach(node => newSet.add(node.id))
      return newSet
    })

    // Create character clusters based on relationships and importance
    const clusters = new Map<string, { x: number; y: number; characters: CharacterNode[] }>()
    
    // Define cluster positions in a circular layout
    const mainCharacters = nodes.filter(n => n.character.mentionCount > maxMentions * 0.3)
    const supportingCharacters = nodes.filter(n => n.character.mentionCount <= maxMentions * 0.3 && n.character.mentionCount > maxMentions * 0.1)
    const minorCharacters = nodes.filter(n => n.character.mentionCount <= maxMentions * 0.1)
    
    // Center cluster for main characters
    clusters.set('main', {
      x: containerWidth / 2,
      y: containerHeight / 2,
      characters: mainCharacters
    })
    
    // Surrounding clusters for supporting characters
    const supportingRadius = Math.min(containerWidth, containerHeight) * 0.3
    const supportingAngleStep = (2 * Math.PI) / Math.max(1, Math.ceil(supportingCharacters.length / 3))
    
    for (let i = 0; i < Math.ceil(supportingCharacters.length / 3); i++) {
      const angle = i * supportingAngleStep
      const clusterX = containerWidth / 2 + Math.cos(angle) * supportingRadius
      const clusterY = containerHeight / 2 + Math.sin(angle) * supportingRadius
      
      clusters.set(`supporting-${i}`, {
        x: clusterX,
        y: clusterY,
        characters: supportingCharacters.slice(i * 3, (i + 1) * 3)
      })
    }
    
    // Outer ring for minor characters
    const minorRadius = Math.min(containerWidth, containerHeight) * 0.4
    const minorAngleStep = (2 * Math.PI) / Math.max(1, minorCharacters.length)
    
    minorCharacters.forEach((char, i) => {
      const angle = i * minorAngleStep
      const clusterX = containerWidth / 2 + Math.cos(angle) * minorRadius
      const clusterY = containerHeight / 2 + Math.sin(angle) * minorRadius
      
      clusters.set(`minor-${i}`, {
        x: clusterX,
        y: clusterY,
        characters: [char]
      })
    })

    // Create simulation with static positioning (no continuous movement)
    const newSimulation = d3.forceSimulation<CharacterNode, CharacterLink>(nodes)
      .force('link', d3.forceLink<CharacterNode, CharacterLink>(links)
        .id(d => d.id)
        .distance(d => {
          // Shorter links for stronger relationships
          const relationshipStrengths = { family: 80, romantic: 70, friendship: 90, professional: 100, conflict: 110, other: 120 }
          return relationshipStrengths[d.relationship.type] || 100
        })
        .strength(0.4) // Reduced strength to prevent excessive movement
      )
      .force('charge', d3.forceManyBody().strength(-200)) // Reduced and constant repulsion
      .force('center', d3.forceCenter(containerWidth / 2, containerHeight / 2))
      .force('collision', d3.forceCollide().radius(d => {
        const isTimedOut = isCharacterTimedOut((d as CharacterNode).character)
        const dimensions = calculateNodeDimensions((d as CharacterNode).character, maxMentions, isTimedOut)
        return Math.max(dimensions.width, dimensions.height) / 2 + 15
      }))
      .alphaDecay(0.05) // Faster decay to settle quickly
      .velocityDecay(0.8) // High velocity decay to reduce movement
      .alpha(0.3) // Lower initial alpha
      .stop() // Stop after initial positioning

    // Create container group with CSS backdrop filter for modern look
    const g = svg.append('g')

    // Add subtle gradient background
    const defs = svg.append('defs')
    
    const bgGradient = defs.append('radialGradient')
      .attr('id', 'bg-gradient')
      .attr('cx', '50%')
      .attr('cy', '50%')
      .attr('r', '50%')
    
    bgGradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#f8fafc')
      .attr('stop-opacity', 1)
    
    bgGradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#e2e8f0')
      .attr('stop-opacity', 1)

    // Apply background
    svg.insert('rect', ':first-child')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('fill', 'url(#bg-gradient)')

    // Add zoom behavior with smooth transitions
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        g.transition()
          .duration(100)
          .attr('transform', event.transform)
      })

    svg.call(zoom)

    // Create modern links with gradients
    const linkGradients = defs.selectAll('.link-gradient')
      .data(links)
      .join('linearGradient')
      .attr('class', 'link-gradient')
      .attr('id', (_d, i) => `link-gradient-${i}`)
      .attr('gradientUnits', 'userSpaceOnUse')
      .each(function(d) {
        d3.select(this).selectAll('stop').remove()
        d3.select(this).append('stop')
          .attr('offset', '0%')
          .attr('stop-color', RELATIONSHIP_COLORS[d.relationship.type])
          .attr('stop-opacity', 0.8)
        d3.select(this).append('stop')
          .attr('offset', '100%')
          .attr('stop-color', RELATIONSHIP_COLORS[d.relationship.type])
          .attr('stop-opacity', 0.3)
      })

    const link = g.append('g')
      .selectAll<SVGLineElement, CharacterLink>('.character-link')
      .data(links)
      .join('line')
      .attr('class', 'character-link')
      .attr('stroke', (_d, i) => `url(#link-gradient-${i})`)
      .attr('stroke-width', 5) // Thicker base width
      .attr('opacity', 0.8) // More visible
      .style('filter', 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))')
      .on('mouseover', function(event, d) {
        // Smooth hover animation
        d3.select(this)
          .transition()
          .duration(200)
          .attr('opacity', 1)
          .attr('stroke-width', 8) // Even thicker on hover
        
        // Modern tooltip
        const tooltip = d3.select('body').append('div')
          .attr('class', 'character-tooltip')
          .style('position', 'absolute')
          .style('background', 'rgba(15, 23, 42, 0.95)')
          .style('color', 'white')
          .style('padding', '12px 16px')
          .style('border-radius', '12px')
          .style('font-size', '14px')
          .style('font-weight', '500')
          .style('box-shadow', '0 10px 25px rgba(0, 0, 0, 0.2)')
          .style('backdrop-filter', 'blur(8px)')
          .style('border', '1px solid rgba(255, 255, 255, 0.1)')
          .style('pointer-events', 'none')
          .style('opacity', 0)
          .style('transform', 'translateY(5px)')

        tooltip.transition()
          .duration(200)
          .style('opacity', 1)
          .style('transform', 'translateY(0)')

        tooltip.html(`
          <div class="font-semibold text-${RELATIONSHIP_COLORS[d.relationship.type].replace('#', '')}">${d.relationship.type.toUpperCase()}</div>
          <div class="text-sm opacity-90">${d.relationship.description}</div>
        `)
          .style('left', (event.pageX + 15) + 'px')
          .style('top', (event.pageY - 10) + 'px')
      })
      .on('mouseout', function() {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('opacity', 0.8)
          .attr('stroke-width', 5)
        
        d3.selectAll('.character-tooltip')
          .transition()
          .duration(150)
          .style('opacity', 0)
          .remove()
      })

    // Create modern nodes with gradients and shadows
    defs.selectAll('.node-gradient')
      .data(nodes)
      .join('radialGradient')
      .attr('class', 'node-gradient')
      .attr('id', (_d, i) => `node-gradient-${i}`)
      .attr('cx', '30%')
      .attr('cy', '30%')
      .attr('r', '70%')
      .each(function(d) {
        const color = getNodeColor(d.character)
        d3.select(this).selectAll('stop').remove()
        d3.select(this).append('stop')
          .attr('offset', '0%')
          .attr('stop-color', d3.color(color)?.brighter(0.5)?.toString() || color)
        d3.select(this).append('stop')
          .attr('offset', '100%')
          .attr('stop-color', color)
      })

    const node = g.append('g')
      .selectAll<SVGRectElement, CharacterNode>('.character-node')
      .data(nodes)
      .join('rect')
      .attr('class', 'character-node')
      .attr('width', d => {
        const isTimedOut = isCharacterTimedOut(d.character)
        const dimensions = calculateNodeDimensions(d.character, maxMentions, isTimedOut)
        // Start new nodes at 0 width for entrance animation
        return newNodeIds.has(d.id) ? 0 : dimensions.width
      })
      .attr('height', d => {
        const isTimedOut = isCharacterTimedOut(d.character)
        const dimensions = calculateNodeDimensions(d.character, maxMentions, isTimedOut)
        // Start new nodes at 0 height for entrance animation
        return newNodeIds.has(d.id) ? 0 : dimensions.height
      })
      .attr('x', d => {
        const isTimedOut = isCharacterTimedOut(d.character)
        const dimensions = calculateNodeDimensions(d.character, maxMentions, isTimedOut)
        return -dimensions.width / 2
      })
      .attr('y', d => {
        const isTimedOut = isCharacterTimedOut(d.character)
        const dimensions = calculateNodeDimensions(d.character, maxMentions, isTimedOut)
        return -dimensions.height / 2
      })
      .attr('rx', 12) // Rounded corners
      .attr('ry', 12)
      .attr('fill', (_d, i) => `url(#node-gradient-${i})`)
      .attr('stroke', d => {
        if (d.character.status === 'Dead') return '#ef4444'
        if (isNewInChapter(d.character)) return '#10b981'
        return 'rgba(255, 255, 255, 0.8)'
      })
      .attr('stroke-width', d => isNewInChapter(d.character) ? 3 : 2)
      .style('cursor', 'pointer')
      .style('opacity', d => {
        const baseOpacity = getCharacterOpacity(d.character)
        // Start new nodes invisible for fade-in effect
        return newNodeIds.has(d.id) ? 0 : baseOpacity
      })
      .style('filter', d => {
        if (d.character.status === 'Dead') {
          return 'drop-shadow(0 4px 8px rgba(239, 68, 68, 0.3)) grayscale(30%)'
        }
        return 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.15))'
      })
      .call(d3.drag<SVGRectElement, CharacterNode>()
        .on('start', (event, d) => {
          if (!event.active) newSimulation.alphaTarget(0.1).restart()
          d.fx = d.x
          d.fy = d.y
          
          // Subtle scale animation on drag start
          d3.select(event.sourceEvent.target as SVGRectElement)
            .transition()
            .duration(150)
            .attr('transform', 'scale(1.05)')
        })
        .on('drag', (event, d) => {
          d.fx = event.x
          d.fy = event.y
        })
        .on('end', (event, d) => {
          if (!event.active) newSimulation.alphaTarget(0)
          d.fx = null
          d.fy = null
          
          // Return to normal size
          d3.select(event.sourceEvent.target as SVGRectElement)
            .transition()
            .duration(150)
            .attr('transform', 'scale(1)')
        })
      )
      .on('click', (event, d) => {
        event.stopPropagation()
        
        // Smooth click animation
        d3.select(event.target as SVGRectElement)
          .transition()
          .duration(150)
          .attr('transform', 'scale(1.1)')
          .transition()
          .duration(150)
          .attr('transform', 'scale(1)')
        
        onCharacterSelect(d.character)
      })

    // Animate new nodes entrance
    node.filter(d => newNodeIds.has(d.id))
      .transition()
      .duration(800)
      .ease(d3.easeCubicOut)
      .attr('width', d => {
        const isTimedOut = isCharacterTimedOut(d.character)
        const dimensions = calculateNodeDimensions(d.character, maxMentions, isTimedOut)
        return dimensions.width
      })
      .attr('height', d => {
        const isTimedOut = isCharacterTimedOut(d.character)
        const dimensions = calculateNodeDimensions(d.character, maxMentions, isTimedOut)
        return dimensions.height
      })
      .style('opacity', d => getCharacterOpacity(d.character))

    // Add modern character names with better typography
    const text = g.append('g')
      .selectAll<SVGTextElement, CharacterNode>('.character-text')
      .data(nodes)
      .join('text')
      .attr('class', 'character-text')
      .text(d => {
        // Truncate long names
        const name = d.character.name
        return name.length > 12 ? name.substring(0, 10) + '...' : name
      })
      .attr('text-anchor', 'middle')
      .attr('dy', '.35em')
      .attr('font-size', d => {
        const isTimedOut = isCharacterTimedOut(d.character)
        return isTimedOut ? '10px' : '12px'
      })
      .attr('font-weight', '600')
      .attr('fill', 'white')
      .attr('pointer-events', 'none')
      .style('text-shadow', '0 2px 4px rgba(0,0,0,0.8)')
      .style('font-family', '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif')
      .style('opacity', d => newNodeIds.has(d.id) ? 0 : 1)

    // Animate new text labels
    text.filter(d => newNodeIds.has(d.id))
      .transition()
      .delay(400)
      .duration(600)
      .ease(d3.easeCubicOut)
      .style('opacity', 1)

    // Add modern status indicators (only for dead characters)
    const statusIndicator = g.append('g')
      .selectAll<SVGTextElement, CharacterNode>('.status-indicator')
      .data(nodes.filter(d => d.character.status === 'Dead'))
      .join('text')
      .attr('class', 'status-indicator')
      .text('💀')
      .attr('text-anchor', 'middle')
      .attr('dy', d => {
        const isTimedOut = isCharacterTimedOut(d.character)
        const dimensions = calculateNodeDimensions(d.character, maxMentions, isTimedOut)
        return -dimensions.height / 2 - 8
      })
      .attr('font-size', '14px')
      .attr('pointer-events', 'none')
      .style('filter', 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))')

    // Run simulation briefly for initial positioning only
    newSimulation.restart()
    
    // Stop simulation after initial layout is established
    setTimeout(() => {
      newSimulation.stop()
    }, 1000) // Stop after 1 second
    
    // Update positions on simulation tick with smooth interpolation
    newSimulation.on('tick', () => {
      // Update link gradients
      linkGradients.each(function(d) {
        const source = d.source as CharacterNode
        const target = d.target as CharacterNode
        d3.select(this)
          .attr('x1', source.x!)
          .attr('y1', source.y!)
          .attr('x2', target.x!)
          .attr('y2', target.y!)
      })

      link
        .attr('x1', d => (d.source as CharacterNode).x!)
        .attr('y1', d => (d.source as CharacterNode).y!)
        .attr('x2', d => (d.target as CharacterNode).x!)
        .attr('y2', d => (d.target as CharacterNode).y!)

      node
        .attr('transform', d => `translate(${d.x!}, ${d.y!})`)

      text
        .attr('x', d => d.x!)
        .attr('y', d => d.y!)

      statusIndicator
        .attr('x', d => d.x!)
        .attr('y', d => {
          const isTimedOut = isCharacterTimedOut(d.character)
          const dimensions = calculateNodeDimensions(d.character, maxMentions, isTimedOut)
          return d.y! - dimensions.height / 2 - 8
        })
    })



    // Cleanup function
    return () => {
      newSimulation.stop()
      d3.selectAll('.tooltip').remove()
    }
  }, [characters, currentChapter, containerWidth, containerHeight, onCharacterSelect])

  return (
    <svg
      ref={svgRef}
      width={containerWidth}
      height={containerHeight}
      className="character-map bg-white border rounded-lg"
      style={{ maxWidth: '100%', height: 'auto' }}
    >
      {characters.length === 0 && (
        <text
          x={containerWidth / 2}
          y={containerHeight / 2}
          textAnchor="middle"
          className="text-gray-400 text-lg"
        >
          No characters found yet. Analyze a chapter to get started.
        </text>
      )}
    </svg>
  )
}