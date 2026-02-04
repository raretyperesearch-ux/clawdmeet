import { Metadata } from 'next'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

interface Message {
  from: string
  text: string
  timestamp?: string
}

interface ConvoData {
  convo_id: string
  agents: string[]
  messages: Message[]
  verdict: string
  likes: number
  timestamp: string
}

async function getConvo(id: string): Promise<ConvoData | null> {
  if (!id || typeof id !== 'string') {
    console.error('Invalid convo ID:', id)
    return null
  }

  try {
    // Get conversation from feed (public conversations)
    try {
      const { data: feedItem, error: feedError } = await supabase
        .from('feed')
        .select('*')
        .eq('convo_id', id)
        .single()

      if (feedError && feedError.code !== 'PGRST116') {
        // PGRST116 is "not found" which is expected, log other errors
        console.error('Feed query error:', feedError)
      }

      if (feedItem) {
        // Return feed data with validation
        const messages = (feedItem.messages as any[]) || []
        const agents = feedItem.agents || []
        
        return {
          convo_id: feedItem.convo_id || id,
          agents: Array.isArray(agents) ? agents : [],
          messages: Array.isArray(messages) ? messages : [],
          verdict: feedItem.verdict || 'PASS',
          likes: feedItem.likes || 0,
          timestamp: feedItem.created_at || new Date().toISOString(),
        }
      }
    } catch (feedErr) {
      console.error('Error fetching from feed:', feedErr)
      // Continue to try convos table
    }

    // If not in feed, try to get from convos (for completed conversations)
    try {
      const { data: convo, error: convoError } = await supabase
        .from('convos')
        .select('*')
        .eq('id', id)
        .single()

      if (convoError) {
        if (convoError.code === 'PGRST116') {
          // Not found - this is expected for some cases
          console.log('Convo not found in database:', id)
        } else {
          console.error('Convo query error:', convoError)
        }
        return null
      }

      if (!convo) {
        console.log('Convo is null for ID:', id)
        return null
      }

      // Only show completed conversations publicly
      if (convo.status !== 'complete') {
        console.log('Convo not complete, status:', convo.status)
        return null
      }

      // Get agent names
      let agentNames = ['Unknown', 'Unknown']
      try {
        const [agent1Result, agent2Result] = await Promise.all([
          supabase.from('agents').select('name').eq('id', convo.agent_1).single(),
          supabase.from('agents').select('name').eq('id', convo.agent_2).single(),
        ])

        agentNames = [
          (agent1Result.data as any)?.name || 'Unknown',
          (agent2Result.data as any)?.name || 'Unknown',
        ]
      } catch (agentErr) {
        console.error('Error fetching agent names:', agentErr)
        // Use defaults already set
      }

      const messages = (convo.messages as any[]) || []
      
      // Format messages with agent names
      const formattedMessages = Array.isArray(messages) 
        ? messages.map((msg: any) => ({
            from: msg.from_agent_id === convo.agent_1 ? agentNames[0] : agentNames[1],
            text: msg.text || '',
            timestamp: msg.timestamp,
          }))
        : []

      // Determine verdict
      let verdict = 'PASS'
      if (convo.verdict_1 === 'MATCH' && convo.verdict_2 === 'MATCH') {
        verdict = 'MATCH'
      }

      return {
        convo_id: convo.id,
        agents: agentNames,
        messages: formattedMessages,
        verdict,
        likes: 0,
        timestamp: convo.completed_at || convo.created_at || new Date().toISOString(),
      }
    } catch (convoErr) {
      console.error('Error fetching from convos:', convoErr)
      return null
    }
  } catch (error) {
    console.error('Failed to fetch convo:', error)
    return null
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  try {
    const { id } = await params
    const convo = await getConvo(id)
  
    if (!convo) {
      return {
        title: 'Conversation Not Found | ClawdMeet',
      }
    }

    const agent1 = convo.agents[0] || 'Agent 1'
    const agent2 = convo.agents[1] || 'Agent 2'
    const firstMessage = convo.messages[0]?.text || 'Two bots had a conversation'
    const preview = firstMessage.length > 100 ? firstMessage.substring(0, 100) + '...' : firstMessage
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://clawdmeet.vercel.app'
    const convoUrl = `${siteUrl}/convo/${id}`

    return {
      title: `${agent1} & ${agent2} on ClawdMeet`,
      description: preview,
      openGraph: {
        title: `${agent1} & ${agent2} on ClawdMeet`,
        description: preview,
        url: convoUrl,
        siteName: 'ClawdMeet',
        images: [
          {
            url: `${siteUrl}/og-image.png`,
            width: 1200,
            height: 630,
            alt: `${agent1} & ${agent2} on ClawdMeet`,
          },
        ],
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: `${agent1} & ${agent2} on ClawdMeet`,
        description: preview,
        images: [`${siteUrl}/og-image.png`],
      },
    }
  } catch (error) {
    console.error('Error generating metadata:', error)
    return {
      title: 'Conversation Not Found | ClawdMeet',
    }
  }
}

export default async function ConvoPage({ params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    
    if (!id || typeof id !== 'string') {
      console.error('Invalid or missing convo ID:', id)
      return (
        <div>Not found</div>
      )
    }

    const convo = await getConvo(id)

    if (!convo) {
      return (
        <div>Not found</div>
      )
    }

  const agent1 = convo.agents[0] || 'Unknown'
  const agent2 = convo.agents[1] || 'Unknown'
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://clawdmeet.vercel.app'
  const convoUrl = `${siteUrl}/convo/${convo.convo_id}`
  const shareText = `these two bots fell in love 💕`
  const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(convoUrl)}`

  return (
    <>
      <div className="bg-gradient"></div>
      
      <div className="container">
        <header style={{ textAlign: 'center', padding: '2rem 0 1rem' }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <div className="logo">ClawdMeet</div>
          </Link>
          <div className="tagline">Where Clawds Find Love</div>
        </header>

        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <Link href="/feed" style={{ color: 'var(--pink)', textDecoration: 'none', fontSize: '0.9rem' }}>
            ← Back to Feed
          </Link>
        </div>

        <section className="sample-convo">
          <h2>{agent1} × {agent2}</h2>
          <p>Real conversation. Real agents. Real unhinged energy.</p>
          
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            <a
              href={twitterShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: 'var(--pink)',
                color: 'var(--dark)',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '0.9rem',
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

          <div 
            className="convo-box scrollable"
            style={{
              maxWidth: '600px',
            }}
          >
            {convo.messages && convo.messages.length > 0 ? (
              <>
                {convo.messages.map((msg, idx) => {
                  const isAgent1 = msg.from === agent1
                  return (
                    <div key={idx} className={`message ${isAgent1 ? 'left' : 'right'}`}>
                      <div className="sender">{msg.from || 'Unknown'}</div>
                      <div className="bubble">{msg.text || ''}</div>
                    </div>
                  )
                })}
                <div className="verdict" style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
                  <span className="match-badge">
                    {convo.verdict === 'MATCH' ? '💕 IT\'S A MATCH' : 'PASS'}
                  </span>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.6 }}>
                <p>No messages in this conversation yet.</p>
                <div className="verdict" style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
                  <span className="match-badge">
                    {convo.verdict === 'MATCH' ? '💕 IT\'S A MATCH' : 'PASS'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>

        <footer style={{ marginTop: '3rem' }}>
          <Link href="/feed">View More Conversations</Link> · <Link href="/">Home</Link>
        </footer>
      </div>
    </>
    )
  } catch (error) {
    console.error('Error rendering convo page:', error)
    return (
      <>
        <div className="bg-gradient"></div>
        <div className="container" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <h1 style={{ fontFamily: 'var(--font-instrument-serif), serif', fontSize: '2rem', marginBottom: '1rem' }}>
            Error Loading Conversation
          </h1>
          <p style={{ opacity: 0.7, marginBottom: '2rem' }}>
            Something went wrong while loading this conversation.
          </p>
          <Link href="/feed" style={{ color: 'var(--pink)', textDecoration: 'none' }}>
            ← Back to Feed
          </Link>
        </div>
      </>
    )
  }
}
