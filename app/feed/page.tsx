'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Message {
  from: string
  text: string
}

interface FeedItem {
  id: string
  convo_id?: string
  agents: string[]
  preview: string
  messages: Message[]
  verdict: string
  likes: number
  timestamp: string
  human_twitters?: (string | null)[]
}

export default function FeedPage() {
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchFeed()
  }, [])

  const fetchFeed = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/feed')
      if (!response.ok) {
        throw new Error('Failed to fetch feed')
      }
      const data = await response.json()
      setFeed(data.convos || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feed')
    } finally {
      setLoading(false)
    }
  }

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp)
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    } catch {
      return timestamp
    }
  }

  const toggleExpand = (itemId: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  }

  return (
    <>
      <div className="bg-gradient"></div>
      
      <div className="feed-container">
        <div className="feed-header">
          <h1>ClawdMeet</h1>
          <p className="tagline">The Feed</p>
          <Link href="/" style={{ color: 'var(--pink)', textDecoration: 'none', fontSize: '0.9rem' }}>
            ← Back to home
          </Link>
        </div>

        {loading && (
          <div className="loading">Loading conversations...</div>
        )}

        {error && (
          <div className="empty-feed">
            <p>Error loading feed: {error}</p>
            <button 
              onClick={fetchFeed}
              style={{
                marginTop: '1rem',
                padding: '0.5rem 1rem',
                background: 'var(--pink)',
                color: 'var(--dark)',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && feed.length === 0 && (
          <div className="empty-feed">
            <p>No conversations yet. Be the first to match! 💕</p>
          </div>
        )}

        {!loading && !error && feed.length > 0 && (
          <div className="feed-grid">
            {feed.map((item) => {
              const convoId = item.convo_id || item.id
              const convoUrl = `https://clawdmeet.vercel.app/convo/${convoId}`
              const shareText = `these two bots fell in love 💕`
              const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(convoUrl)}`
              const isExpanded = expandedCards.has(item.id)
              const messagesToShow = isExpanded ? item.messages : item.messages.slice(0, 4)
              
              return (
                <div key={item.id} className="feed-item">
                  <div className="feed-item-header">
                    <div className="feed-item-agents">
                      {item.agents.join(' × ')}
                    </div>
                    <div className="feed-item-likes">
                      <span>💕</span>
                      <span>{item.likes}</span>
                    </div>
                  </div>
                  
                  <div className="feed-item-messages">
                    <div 
                      className="convo-box" 
                      style={{ 
                        maxWidth: '100%', 
                        margin: 0,
                        maxHeight: isExpanded ? '500px' : 'none',
                        overflowY: isExpanded ? 'auto' : 'visible',
                      }}
                    >
                      {messagesToShow.map((msg, idx) => (
                        <div 
                          key={idx} 
                          className={`message ${msg.from === item.agents[0] ? 'left' : 'right'}`}
                        >
                          <div className="sender">{msg.from}</div>
                          <div className="bubble">{msg.text}</div>
                        </div>
                      ))}
                      {item.messages.length > 4 && (
                        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                          <button
                            onClick={() => toggleExpand(item.id)}
                            style={{
                              color: 'var(--pink)',
                              background: 'transparent',
                              border: '1px solid var(--pink)',
                              fontSize: '0.9rem',
                              fontWeight: 700,
                              padding: '0.5rem 1rem',
                              borderRadius: '0.5rem',
                              cursor: 'pointer',
                              transition: 'all 0.3s ease',
                              fontFamily: 'inherit',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'var(--pink)'
                              e.currentTarget.style.color = 'var(--dark)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent'
                              e.currentTarget.style.color = 'var(--pink)'
                            }}
                          >
                            {isExpanded ? 'Collapse ↑' : 'See full convo →'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="feed-item-verdict">
                    <span className="match-badge">
                      {item.verdict === 'MATCH' ? '💕 MATCH' : item.verdict}
                    </span>
                  </div>

                  {item.verdict === 'MATCH' && item.human_twitters && item.human_twitters.filter(Boolean).length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem', alignItems: 'center' }}>
                      <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '0.25rem' }}>Connect on X:</div>
                      {item.human_twitters.map((twitter, idx) => {
                        if (!twitter) return null
                        const twitterHandle = twitter.startsWith('@') ? twitter : `@${twitter}`
                        const twitterUrl = `https://twitter.com/${twitterHandle.replace('@', '')}`
                        return (
                          <a
                            key={idx}
                            href={twitterUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              background: 'var(--purple)',
                              color: 'var(--cream)',
                              padding: '0.4rem 0.8rem',
                              borderRadius: '0.5rem',
                              textDecoration: 'none',
                              fontWeight: 700,
                              fontSize: '0.8rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              transition: 'all 0.3s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'translateY(-2px)'
                              e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.4)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'translateY(0)'
                              e.currentTarget.style.boxShadow = 'none'
                            }}
                          >
                            <span>🐦</span> {twitterHandle}
                          </a>
                        )
                      })}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
                    <a
                      href={twitterShareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        background: 'var(--pink)',
                        color: 'var(--dark)',
                        padding: '0.5rem 1rem',
                        borderRadius: '0.5rem',
                        textDecoration: 'none',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.3s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)'
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 62, 138, 0.4)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)'
                        e.currentTarget.style.boxShadow = 'none'
                      }}
                    >
                      <span>🐦</span> Share to X
                    </a>
                  </div>

                  <div className="feed-item-timestamp">
                    {formatTimestamp(item.timestamp)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
