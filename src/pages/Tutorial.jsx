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
  
  const chatEndRef = useRef(null)

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

First, tell me about your household — is this just for you, or are you planning meals for a family?`)
      }
    }
    fetchUserName()
  }, [user.id])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation])

  const addSageMessage = (text) => {
    setConversation(prev => [...prev, { role: 'assistant', content: text }])
  }

  const addUserMessage = (text) => {
    setConversation(prev => [...prev, { role: 'user', content: text }])
  }

  const handleSend = async () => {
    if (!userInput.trim() || loading) return

    const message = userInput.trim()
    setUserInput('')
    addUserMessage(message)
    setLoading(true)

    try {
      const response = await callSage(
        [...conversation, { role: 'user', content: message }],
        getTutorialSystemPrompt(userName)
      )
      
      addSageMessage(response)
    } catch (error) {
      console.error('Tutorial error:', error)
      // Show the actual error message to the user
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
    if (step === 1) {
      // Moving from intro to preferences
      setStep(2)
      addSageMessage("Great! Now let's learn about your food preferences. What are some cuisines or dishes your family loves?")
    } else if (step === 2) {
      // Moving to recipe import
      setStep(3)
      addSageMessage("Perfect! Before we can plan meals, we need some recipes in your library. Would you like to add your first recipe now? I can help you import it from a photo, a website, or you can type it in.")
    } else if (step === 3) {
      // Moving to day types
      setStep(4)
      addSageMessage("Excellent! You've got your first recipe. Now let me show you how day types work — they help shape your week before you assign any meals. Tap 'Learn About Day Types' to continue.")
    } else if (step === 4) {
      // Moving to first week setup
      setStep(5)
      addSageMessage("Great! Now let's set up your first week. I'll walk you through it step by step. Tap 'Set Up My First Week' when you're ready.")
    } else if (step === 5) {
      // Complete tutorial
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
        {step === 1 && (
          <div className="quick-responses">
            <button className="quick-btn" onClick={async () => { 
              addUserMessage("Just me")
              setLoading(true)
              try {
                const response = await callSage(
                  [...conversation, { role: 'user', content: "Just me" }],
                  getTutorialSystemPrompt(userName)
                )
                addSageMessage(response)
              } catch (error) {
                console.error('Quick response error:', error)
                addSageMessage(`I'm having trouble connecting: ${error.message}\n\nPlease try again, or if this continues, let me know what error you're seeing.`)
              } finally {
                setLoading(false)
              }
            }}>
              Just me
            </button>
            <button className="quick-btn" onClick={async () => { 
              addUserMessage("Family of 2")
              setLoading(true)
              try {
                const response = await callSage(
                  [...conversation, { role: 'user', content: "Family of 2" }],
                  getTutorialSystemPrompt(userName)
                )
                addSageMessage(response)
              } catch (error) {
                console.error('Quick response error:', error)
                addSageMessage(`I'm having trouble connecting: ${error.message}\n\nPlease try again, or if this continues, let me know what error you're seeing.`)
              } finally {
                setLoading(false)
              }
            }}>
              Family of 2
            </button>
            <button className="quick-btn" onClick={async () => { 
              addUserMessage("Family of 7 - 2 adults and 5 kids")
              setLoading(true)
              try {
                const response = await callSage(
                  [...conversation, { role: 'user', content: "Family of 7 - 2 adults and 5 kids" }],
                  getTutorialSystemPrompt(userName)
                )
                addSageMessage(response)
              } catch (error) {
                console.error('Quick response error:', error)
                addSageMessage(`I'm having trouble connecting: ${error.message}\n\nPlease try again, or if this continues, let me know what error you're seeing.`)
              } finally {
                setLoading(false)
              }
            }}>
              Family of 7
            </button>
          </div>
        )}

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

        {step === 3 && (
          <div className="action-buttons">
            <button className="btn btn-outline" onClick={() => addSageMessage("Recipe import feature coming in Session 3! For now, let's continue.")}>
              Add Recipe
            </button>
            <button className="btn btn-sage" onClick={handleContinue}>
              Continue
            </button>
          </div>
        )}

        {step === 4 && (
          <div className="day-types-preview">
            <div className="dt-card">
              <div className="dt-icon">🍳</div>
              <div className="dt-name">Cooking Day</div>
              <div className="dt-desc">Time for longer recipes</div>
            </div>
            <div className="dt-card">
              <div className="dt-icon">⚡</div>
              <div className="dt-name">Quick Meal</div>
              <div className="dt-desc">30 minutes or less</div>
            </div>
            <div className="dt-card">
              <div className="dt-icon">🥘</div>
              <div className="dt-name">Crock Pot Day</div>
              <div className="dt-desc">Set it and forget it</div>
            </div>
            <button className="btn btn-sage btn-full" onClick={handleContinue} style={{ marginTop: '1rem' }}>
              Got it! Continue →
            </button>
          </div>
        )}

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
