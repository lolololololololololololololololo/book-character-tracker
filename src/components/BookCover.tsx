import { useState, useEffect } from 'react'
import { bookCoverCache } from '../services/bookCoverService'

interface BookCoverProps {
  title: string
  author: string
  className?: string
}

export default function BookCover({ title, author, className = '' }: BookCoverProps) {
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let isMounted = true

    const fetchCover = async () => {
      try {
        setLoading(true)
        setError(false)
        
        const coverData = await bookCoverCache.getCover(title, author)
        
        if (isMounted) {
          if (coverData.coverUrl) {
            // Test if the image actually loads
            const img = new Image()
            img.onload = () => {
              if (isMounted) {
                setCoverUrl(coverData.coverUrl)
                setLoading(false)
              }
            }
            img.onerror = () => {
              if (isMounted) {
                setError(true)
                setLoading(false)
              }
            }
            img.src = coverData.coverUrl
          } else {
            setError(true)
            setLoading(false)
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(true)
          setLoading(false)
        }
      }
    }

    fetchCover()

    return () => {
      isMounted = false
    }
  }, [title, author])

  const getInitials = () => {
    const words = title.split(' ')
    if (words.length === 1) {
      return words[0].charAt(0).toUpperCase()
    }
    return words.slice(0, 2).map(word => word.charAt(0).toUpperCase()).join('')
  }

  if (loading) {
    return (
      <div className={`book-cover-placeholder ${className}`}>
        <div className="animate-pulse">
          <div className="w-6 h-6 bg-white bg-opacity-30 rounded"></div>
        </div>
      </div>
    )
  }

  if (error || !coverUrl) {
    return (
      <div className={`book-cover-placeholder ${className}`}>
        {getInitials()}
      </div>
    )
  }

  return (
    <img
      src={coverUrl}
      alt={`Cover of ${title}`}
      className={`book-cover ${className}`}
      loading="lazy"
      onError={() => setError(true)}
    />
  )
}