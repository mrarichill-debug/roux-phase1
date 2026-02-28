import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { callSage } from '../lib/claude'
import './ThisWeek.css'

const DAY_TYPES = [
  { id: 'cooking', name: 'Cooking Day', icon: '🍳', desc: 'Time and energy available for longer recipes, new dishes, or batch cooking.' },
  { id: 'quick', name: 'Quick Meal Day', icon: '⚡', desc: '30 minutes or less. Limited time but still cooking.' },
  { id: 'crockpot', name: 'Crock Pot Day', icon: '🥘', desc: 'Put it in the slow cooker and forget about it until dinner.' },
  { id: 'nocook', name: 'No Cook Day', icon: '🍱', desc: 'Takeout, eating out, or leftovers. No cooking tonight.' },
  { id: 'prep', name: 'Prep Day', icon: '🧊', desc: 'Cooking ahead for later in the week. Make-ahead meals for busy days.' },
  { id: 'flex', name: 'Flex Day', icon: '🔄', desc: 'Undecided. Decide closer to the day.' }
]

// Get upcoming week (Sunday - Saturday)
function getUpcomingWeek() {
  const today = new Date()
  const dayOfWeek = today.getDay()
  
  // Find next Sunday (or today if it's Sunday)
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek
  const sunday = new Date(today)
  sunday.setDate(today.getDate() + daysUntilSunday)
  sunday.setHours(0, 0, 0, 0)
  
  const days = []
  for (let i = 0; i < 7; i++) {
    const day = new Date(sunday)
    day.setDate(sunday.getDate() + i)
    days.push({
      date: day,
      dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][i],
      dayShort: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][i],
      dateNum: day.getDate()
    })
  }
  
  return { sunday, days }
}

export default function ThisWeek() {
  const [step, setStep] = useState(1) // 1: intro, 2: day types, 3: constraints, 4: preview
  const [weekData, setWeekData] = useState(null)
  const [dayTypes, setDayTypes] = useState({})
  const [constraints, setConstraints] = useState([])
  const [customConstraint, setCustomConstraint] = useState('')
  const [breakfastLunchNotes, setBreakfastLunchNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [sageResponse, setSageResponse] = useState('')
  const [showDayTypePicker, setShowDayTypePicker] = useState(null)

  useEffect(() => {
    const { days } = getUpcomingWeek()
    setWeekData(days)
  }, [])

  const handleSetDayType = (dayIndex, typeId) => {
    setDayTypes(prev => ({
      ...prev,
      [dayIndex]: typeId
    }))
    setShowDayTypePicker(null)
  }

  const handleAddConstraint = (constraint) => {
    if (!constraints.includes(constraint)) {
      setConstraints(prev => [...prev, constraint])
    }
  }

  const handleRemoveConstraint = (constraint) => {
    setConstraints(prev => prev.filter(c => c !== constraint))
  }

  const handleAddCustomConstraint = () => {
    if (customConstraint.trim() && !constraints.includes(customConstraint.trim())) {
      setConstraints(prev => [...prev, customConstraint.trim()])
      setCustomConstraint('')
    }
  }

  const handleGetSageInsights = async () => {
    if (Object.keys(dayTypes).length < 7) {
      alert('Please set day types for all 7 days first!')
      return
    }

    setLoading(true)
    try {
      const weekSummary = weekData.map((day, idx) => {
        const typeId = dayTypes[idx]
        const typeName = DAY_TYPES.find(t => t.id === typeId)?.name || 'Not set'
        return `${day.dayName}: ${typeName}`
      }).join(', ')

      const constraintsList = constraints.length > 0 ? constraints.join(', ') : 'None'

      const prompt = `I'm planning my week: ${weekSummary}. My constraints are: ${constraintsList}. What batch cooking or meal prep opportunities do you see? Keep it brief (2-3 sentences).`

      const response = await callSage([
        { role: 'user', content: prompt }
      ], null)

      setSageResponse(response)
    } catch (error) {
      setSageResponse("I'm having trouble connecting right now. You can still continue with your planning!")
    } finally {
      setLoading(false)
    }
  }

  const handleContinueToPlanner = async () => {
    // Save week plan to database
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: userData } = await supabase
        .from('users')
        .select('household_id')
        .eq('id', user.id)
        .single()

      const { sunday, days } = getUpcomingWeek()
      const saturday = new Date(sunday)
      saturday.setDate(sunday.getDate() + 6)

      // Create week plan
      const { data: weekPlan, error: weekError } = await supabase
        .from('week_plans')
        .insert({
          household_id: userData.household_id,
          week_start_date: sunday.toISOString().split('T')[0],
          week_end_date: saturday.toISOString().split('T')[0],
          constraints: constraints,
          breakfast_lunch_notes: breakfastLunchNotes
        })
        .select()
        .single()

      if (weekError) throw weekError

      // Save day types
      const dayTypeInserts = days.map((day, idx) => ({
        week_plan_id: weekPlan.id,
        day_date: day.date.toISOString().split('T')[0],
        day_type: dayTypes[idx] || 'flex'
      }))

      const { error: dayTypeError } = await supabase
        .from('day_types')
        .insert(dayTypeInserts)

      if (dayTypeError) throw dayTypeError

      // Navigate to planner
      window.location.href = '/planner'
    } catch (error) {
      console.error('Error saving week plan:', error)
      alert('Error saving week plan. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!weekData) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
  }

  // Step 1: Intro
  if (step === 1) {
    return (
      <div className="this-week-container">
        <div className="this-week-header">
          <h1 className="tw-title">This Week</h1>
          <p className="tw-subtitle">Let's set up your week with Sage</p>
        </div>

        <div className="tw-content">
          <div className="sage-card">
            <div className="sage-icon">🌿</div>
            <div className="sage-message">
              <p>Good morning! It's time to plan your week. I'll help you shape your week before we assign any specific meals.</p>
              <p>First, we'll set "day types" for each day — they help me understand your schedule and energy levels.</p>
            </div>
          </div>

          <div className="week-preview">
            <div className="week-header">Week of {weekData[0].date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</div>
            <div className="days-grid">
              {weekData.map((day, idx) => (
                <div key={idx} className="day-preview">
                  <div className="day-name">{day.dayShort}</div>
                  <div className="day-date">{day.dateNum}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="tw-footer">
          <button className="btn btn-sage btn-full" onClick={() => setStep(2)}>
            Set Day Types →
          </button>
        </div>
      </div>
    )
  }

  // Step 2: Day Types
  if (step === 2) {
    const allDaysSet = Object.keys(dayTypes).length === 7

    return (
      <div className="this-week-container">
        <div className="this-week-header">
          <h1 className="tw-title">Set Day Types</h1>
          <p className="tw-subtitle">Tap each day to choose its type</p>
        </div>

        <div className="tw-content">
          <div className="days-list">
            {weekData.map((day, idx) => {
              const selectedType = DAY_TYPES.find(t => t.id === dayTypes[idx])
              return (
                <div key={idx} className="day-item" onClick={() => setShowDayTypePicker(idx)}>
                  <div className="day-item-left">
                    <div className="day-item-name">{day.dayName}</div>
                    <div className="day-item-date">{day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                  </div>
                  <div className="day-item-right">
                    {selectedType ? (
                      <>
                        <span className="day-type-icon">{selectedType.icon}</span>
                        <span className="day-type-name">{selectedType.name}</span>
                      </>
                    ) : (
                      <span className="day-type-placeholder">Tap to set</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="tw-footer">
          <button className="btn btn-outline" onClick={() => setStep(1)}>
            ← Back
          </button>
          <button 
            className="btn btn-sage" 
            onClick={() => setStep(3)}
            disabled={!allDaysSet}
          >
            Continue →
          </button>
        </div>

        {/* Day Type Picker Modal */}
        {showDayTypePicker !== null && (
          <div className="modal-overlay" onClick={() => setShowDayTypePicker(null)}>
            <div className="modal-content day-type-picker" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>{weekData[showDayTypePicker].dayName}, {weekData[showDayTypePicker].date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</h3>
                <p>Choose a day type</p>
              </div>
              <div className="day-type-options">
                {DAY_TYPES.map(type => (
                  <div 
                    key={type.id} 
                    className={`day-type-option ${dayTypes[showDayTypePicker] === type.id ? 'selected' : ''}`}
                    onClick={() => handleSetDayType(showDayTypePicker, type.id)}
                  >
                    <div className="dt-top">
                      <div className="dt-icon-box">{type.icon}</div>
                      <div className="dt-info-box">
                        <div className="dt-name-box">{type.name}</div>
                      </div>
                      <div className="dt-check">{dayTypes[showDayTypePicker] === type.id ? '✓' : ''}</div>
                    </div>
                    <div className="dt-desc-box">{type.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Step 3: Constraints & Breakfast/Lunch
  if (step === 3) {
    const commonConstraints = [
      'Budget week',
      'Soccer practice',
      'More vegetables',
      'Guest coming',
      'Busy week'
    ]

    return (
      <div className="this-week-container">
        <div className="this-week-header">
          <h1 className="tw-title">Any Constraints?</h1>
          <p className="tw-subtitle">Help Sage understand what's happening this week</p>
        </div>

        <div className="tw-content">
          <div className="sage-card-small">
            <div className="sage-icon-small">🌿</div>
            <p>Is there anything I should know about this week? Busy schedule? Budget constraints? Special events?</p>
          </div>

          <div className="constraints-section">
            <div className="section-label">Quick picks:</div>
            <div className="constraints-chips">
              {commonConstraints.map(c => (
                <button
                  key={c}
                  className={`chip ${constraints.includes(c) ? 'chip-active' : ''}`}
                  onClick={() => constraints.includes(c) ? handleRemoveConstraint(c) : handleAddConstraint(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="custom-constraint">
            <div className="section-label">Or add your own:</div>
            <div className="input-row">
              <input
                type="text"
                value={customConstraint}
                onChange={(e) => setCustomConstraint(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCustomConstraint()}
                placeholder="Type anything..."
              />
              <button className="btn btn-sm btn-sage" onClick={handleAddCustomConstraint}>
                Add
              </button>
            </div>
          </div>

          {constraints.length > 0 && (
            <div className="selected-constraints">
              <div className="section-label">Selected:</div>
              <div className="constraints-chips">
                {constraints.map(c => (
                  <div key={c} className="chip chip-active chip-removable" onClick={() => handleRemoveConstraint(c)}>
                    {c} <span className="chip-remove">×</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="breakfast-lunch-section">
            <div className="section-label">Breakfast & Lunch Needs:</div>
            <textarea
              value={breakfastLunchNotes}
              onChange={(e) => setBreakfastLunchNotes(e.target.value)}
              placeholder="Anything specific needed for breakfasts or kids' lunches this week?"
              rows={3}
            />
          </div>
        </div>

        <div className="tw-footer">
          <button className="btn btn-outline" onClick={() => setStep(2)}>
            ← Back
          </button>
          <button className="btn btn-sage" onClick={() => setStep(4)}>
            Continue →
          </button>
        </div>
      </div>
    )
  }

  // Step 4: Preview & Sage Insights
  if (step === 4) {
    return (
      <div className="this-week-container">
        <div className="this-week-header">
          <h1 className="tw-title">Week Preview</h1>
          <p className="tw-subtitle">Here's your week at a glance</p>
        </div>

        <div className="tw-content">
          <div className="week-skeleton">
            {weekData.map((day, idx) => {
              const type = DAY_TYPES.find(t => t.id === dayTypes[idx])
              return (
                <div key={idx} className="skeleton-day">
                  <div className="skeleton-day-header">
                    <span className="skeleton-icon">{type?.icon}</span>
                    <span className="skeleton-name">{day.dayShort} {day.dateNum}</span>
                  </div>
                  <div className="skeleton-type">{type?.name}</div>
                </div>
              )
            })}
          </div>

          {constraints.length > 0 && (
            <div className="preview-section">
              <div className="preview-label">Constraints:</div>
              <div className="preview-value">{constraints.join(', ')}</div>
            </div>
          )}

          {breakfastLunchNotes && (
            <div className="preview-section">
              <div className="preview-label">Breakfast & Lunch:</div>
              <div className="preview-value">{breakfastLunchNotes}</div>
            </div>
          )}

          {!sageResponse && !loading && (
            <button 
              className="btn btn-outline btn-full" 
              onClick={handleGetSageInsights}
              style={{ marginTop: '1rem' }}
            >
              💡 Get Sage's Insights
            </button>
          )}

          {loading && (
            <div className="sage-card-small" style={{ marginTop: '1rem' }}>
              <div className="spinner" />
              <p>Sage is analyzing your week...</p>
            </div>
          )}

          {sageResponse && (
            <div className="sage-card" style={{ marginTop: '1rem' }}>
              <div className="sage-icon">🌿</div>
              <div className="sage-message">
                <p>{sageResponse}</p>
              </div>
            </div>
          )}
        </div>

        <div className="tw-footer">
          <button className="btn btn-outline" onClick={() => setStep(3)}>
            ← Back
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleContinueToPlanner}
            disabled={loading}
          >
            {loading ? <span className="spinner" /> : 'Start Planning →'}
          </button>
        </div>
      </div>
    )
  }
}
