import { useState, useEffect, useRef } from 'react'
import { callSage, getTutorialSystemPrompt } from '../lib/claude'
import { supabase, completeTutorial } from '../lib/supabase'
import './Tutorial.css'

export default function Tutorial({ user, onComplete }) {
  const [step, setStep] = useState(1) // 1-5
  const [loading, setLoading] = useState(false)
  const [conversation, setConversation] = useState([])
  const [userInput, setUserInput] = useState('')
  const [userName, setUserName] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)
  
  const chatEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    // Fetch user name
    const fetchUserName = async () => {
      const { data } = await supabase
        .from('users')
        .select('name')
        .eq('id', user.id)
        .single()
      
      if (data) {
        setUserName(data.name)
        // Start tutorial with Sage greeting
        addSageMessage(`Welcome to Roux, ${data.name}! I'm Sage, your planning assistant. Let's get you set up so you can start planning meals right away.

First, tell me about your household — who are you planning meals for?`)
      }
    }
    fetchUserName()
  }, [user.id])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation])

  useEffect(() => {
    if (showCustomInput && inputRef.current) {
      inputRef.current.focus()
    }
  }, [showCustomInput])

  const addSageMessage = (text) => {
    setConversation(prev => [...prev, { role: 'assistant', content: text }])
  }

  const addUserMessage = (text) => {
    setConversation(prev => [...prev, { role: 'user', content: text }])
  }

  const handleQuickResponse = async (message) => {
    addUserMessage(message)
    setLoading(true)

    try {
      const response = await callSage(
        [...conversation, { role: 'user', content: message }],
        getTutorialSystemPrompt(userName)
      )
      addSageMessage(response)
      
      // Auto-advance to step 2 after household size response
      if (step === 1) {
        setTimeout(() => setStep(2), 500)
      }
    } catch (error) {
      console.error('Tutorial error:', error)
      addSageMessage(`I'm having trouble connecting: ${error.message}\n\nPlease try again, or if this continues, let me know what error you're seeing.`)
    } finally {
      setLoading(false)
    }
  }

  const handleSend = async () => {
    if (!userInput.trim() || loading) return

    const message = userInput.trim()
    setUserInput('')
    setShowCustomInput(false)
    addUserMessage(message)
    setLoading(true)

    try {
      const response = await callSage(
        [...conversation, { role: 'user', content: message }],
        getTutorialSystemPrompt(userName)
      )
      
      addSageMessage(response)
      
      // Auto-advance based on which step we're on
      if (step === 1) {
        setTimeout(() => setStep(2), 500)
      }
    } catch (error) {
      console.error('Tutorial error:', error)
      addSageMessage(`I'm having trouble connecting: ${error.message}\n\nPlease try again, or if this continues, let me know what error you're seeing.`)
    } finally {
      setLoading(false)
    }
  }

  const handleSkip = async () => {
    await completeTutorial(user.id)
    onComplete()
  }

  const handleContinue = () => {
    if (step === 2) {
      setStep(3)
      addSageMessage("Perfect! Before we can plan meals, we need some recipes in your library. Would you like to add your first recipe now? I can help you import it from a photo, a website, or you can type it in.")
    } else if (step === 3) {
      setStep(4)
      addSageMessage("Excellent! You've got your first recipe. Now let me show you how day types work — they help shape your week before you assign any meals.")
    } else if (step === 4) {
      setStep(5)
      addSageMessage("Great! Now you're ready to start planning. Let's jump into your first week!")
    } else if (step === 5) {
      handleComplete()
    }
  }

  const handleComplete = async () => {
    await completeTutorial(user.id)
    onComplete()
  }

  return (
    <div className="tutorial-container">
      {/* Header */}
      <div className="tutorial-header">
        <div className="sage-avatar-large">🌿</div>
        <div className="tutorial-title">Welcome to Roux</div>
        <div className="tutorial-subtitle">Let Sage show you around</div>
        <div className="tutorial-progress">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${(step / 5) * 100}%` }} />
          </div>
          <div className="progress-label">Step {step} of 5</div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="tutorial-chat">
        {conversation.map((msg, idx) => (
          <div key={idx} className={`tutorial-message ${msg.role}`}>
            {msg.role === 'assistant' && (
              <div className="msg-avatar">🌿</div>
            )}
            <div className="msg-bubble">
              <div className="msg-content">{msg.content}</div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="tutorial-message assistant">
            <div className="msg-avatar">🌿</div>
            <div className="msg-bubble loading">
              <div className="spinner" />
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div className="tutorial-input">
        {/* Step 1: Household Size - Smart buttons + custom option */}
        {step === 1 && !showCustomInput && (
          <div className="quick-responses">
            <button className="quick-btn" onClick={() => handleQuickResponse("Just me")}>
              Just me
            </button>
            <button className="quick-btn" onClick={() => handleQuickResponse("Couple (2 people)")}>
              Couple (2 people)
            </button>
            <button className="quick-btn" onClick={() => handleQuickResponse("Small family (3-4 people)")}>
              Small family (3-4)
            </button>
            <button className="quick-btn" onClick={() => handleQuickResponse("Large family (5+ people)")}>
              Large family (5+)
            </button>
            <button className="quick-btn quick-btn-custom" onClick={() => setShowCustomInput(true)}>
              Something else...
            </button>
          </div>
        )}

        {/* Step 1: Custom input for household size */}
        {step === 1 && showCustomInput && (
          <div className="custom-input-container">
            <div className="input-row">
              <input
                ref={inputRef}
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Tell me about your household..."
                autoFocus
              />
              <button className="send-btn" onClick={handleSend} disabled={loading}>
                ↑
              </button>
            </div>
            <button className="btn-ghost" style={{ marginTop: '0.5rem' }} onClick={() => setShowCustomInput(false)}>
              ← Back to options
            </button>
          </div>
        )}

        {/* Step 2: Food preferences - text input */}
        {step === 2 && (
          <div className="input-row">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Type your answer..."
              autoFocus
            />
            <button className="send-btn" onClick={handleSend} disabled={loading}>
              ↑
            </button>
          </div>
        )}

        {/* Step 3: Recipe import placeholder */}
        {step === 3 && (
          <div className="action-buttons">
            <button className="btn btn-outline" onClick={() => addSageMessage("Recipe import feature is ready! You'll be able to add recipes in the main app.")}>
              Learn More
            </button>
            <button className="btn btn-sage" onClick={handleContinue}>
              Continue →
            </button>
          </div>
        )}

        {/* Step 4: Day types preview */}
        {step === 4 && (
          <div className="day-types-preview">
            <div className="dt-card">
              <div className="dt-icon">🍳</div>
              <div className="dt-info">
                <div className="dt-name">Cooking Day</div>
                <div className="dt-desc">Time for longer recipes</div>
              </div>
            </div>
            <div className="dt-card">
              <div className="dt-icon">⚡</div>
              <div className="dt-info">
                <div className="dt-name">Quick Meal</div>
                <div className="dt-desc">30 minutes or less</div>
              </div>
            </div>
            <div className="dt-card">
              <div className="dt-icon">🥘</div>
              <div className="dt-info">
                <div className="dt-name">Crock Pot Day</div>
                <div className="dt-desc">Set it and forget it</div>
              </div>
            </div>
            <button className="btn btn-sage btn-full" onClick={handleContinue} style={{ marginTop: '1rem' }}>
              Got it! Continue →
            </button>
          </div>
        )}

        {/* Step 5: Complete */}
        {step === 5 && (
          <div className="action-buttons">
            <button className="btn btn-sage btn-full" onClick={handleComplete}>
              Let's Start Planning! →
            </button>
          </div>
        )}
      </div>

      {/* Skip option */}
      {step < 5 && (
        <button className="btn-ghost skip-btn" onClick={handleSkip}>
          Skip tutorial
        </button>
      )}
    </div>
  )
}
