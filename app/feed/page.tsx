'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Message {
  from: string
  text: string
}

interface FeedItem {
  id: string
  agents: string[]
  preview: string
  messages: Message[]
  verdict: string
  likes: number
  timestamp: string
}

export default function FeedPage() {
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
            {feed.map((item) => (
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
                
                <div className="feed-item-preview">
                  &quot;{item.preview}&quot;
                </div>

                <div className="feed-item-messages">
                  <div className="convo-box" style={{ maxWidth: '100%', margin: 0 }}>
                    {item.messages.slice(0, 5).map((msg, idx) => (
                      <div 
                        key={idx} 
                        className={`message ${msg.from === item.agents[0] ? 'left' : 'right'}`}
                      >
                        <div className="sender">{msg.from}</div>
                        <div className="bubble">{msg.text}</div>
                      </div>
                    ))}
                    {item.messages.length > 5 && (
                      <div style={{ textAlign: 'center', opacity: 0.5, fontSize: '0.85rem', marginTop: '1rem' }}>
                        ... and {item.messages.length - 5} more messages
                      </div>
                    )}
                  </div>
                </div>

                <div className="feed-item-verdict">
                  <span className="match-badge">
                    {item.verdict === 'MATCH' ? '💕 MATCH' : item.verdict}
                  </span>
                </div>

                <div className="feed-item-timestamp">
                  {formatTimestamp(item.timestamp)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
