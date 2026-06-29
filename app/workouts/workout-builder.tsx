'use client'
import { useState } from 'react'
import {
  Plus, Trash2, Search, Copy, Check,
  Dumbbell, ChevronDown, ChevronUp, Link,
  Save, Users, X, Loader2, History, Clock,
  Sparkles, Tag,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────
interface Exercise {
  id: string; name: string; muscle_group: string | null; equipment: string | null
}
interface WorkoutItem {
  exercise_id: string; exercise_name: string; muscle_group: string | null
  sets: string; reps: string; weight: string; rest_seconds: string; notes: string
}
interface Member { id: string; full_name: string; initials: string }
interface SavedTemplate {
  id: string; title: string; goal: string | null; level: string | null
  created_at?: string; is_preset?: boolean; preset_category?: string | null
  workout_template_items: {
    id: string; position: number; sets: number | null; reps: string | null
    weight: string | null; rest_seconds: number | null; notes: string | null
    exercises: { id: string; name: string; muscle_group: string | null } | null
  }[]
}
interface Props {
  exercises: Exercise[]; members: Member[]
  savedTemplates: SavedTemplate[]
  presetTemplates: SavedTemplate[]
  trainerId: string
}

// ── Helpers ────────────────────────────────────────────────────────────────
const MUSCLE_GROUPS = ['All','Chest','Back','Legs','Shoulders','Arms','Core','Cardio']
const LEVEL_COLORS: Record<string, string> = {
  beginner: 'bg-green-50 text-green-700 border-green-200',
  intermediate: 'bg-blue-50 text-blue-700 border-blue-200',
  advanced: 'bg-red-50 text-red-600 border-red-200',
}
const CATEGORY_ICONS: Record<string, string> = {
  Strength: '🏋️', Cardio: '🏃', Core: '💪', Flexibility: '🧘', HIIT: '⚡',
}

function avatarColor(name: string) {
  const colors = ['#1D9E75','#378ADD','#5B53C6','#C2587A','#E08A3C','#0F6E56']
  let hash = 0; for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function timeAgo(d: string) {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
  if (days === 0) return 'Today'; if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`; if (days < 30) return `${Math.floor(days/7)}w ago`
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

type PanelType = 'presets' | 'saved' | null

// ── Component ──────────────────────────────────────────────────────────────
export default function WorkoutBuilder({ exercises, members, savedTemplates: initialTemplates, presetTemplates, trainerId }: Props) {
  const [title, setTitle] = useState('')
  const [goal, setGoal] = useState('')
  const [level, setLevel] = useState<'beginner'|'intermediate'|'advanced'>('intermediate')
  const [items, setItems] = useState<WorkoutItem[]>([])
  const [savedTemplateId, setSavedTemplateId] = useState<string | null>(null)
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>(initialTemplates)
  const [search, setSearch] = useState('')
  const [muscleFilter, setMuscleFilter] = useState('All')
  const [assignMemberId, setAssignMemberId] = useState(members[0]?.id ?? '')
  const [saving, setSaving] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [activePanel, setActivePanel] = useState<PanelType>(null)
  const [templateSearch, setTemplateSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')

  const filteredExercises = exercises.filter(e => {
    const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase())
    const matchMuscle = muscleFilter === 'All' || e.muscle_group === muscleFilter
    return matchSearch && matchMuscle
  })
  const grouped = filteredExercises.reduce<Record<string,Exercise[]>>((acc, e) => {
    const g = e.muscle_group ?? 'Other'; if (!acc[g]) acc[g] = []; acc[g].push(e); return acc
  }, {})

  const presetCategories = ['All', ...Array.from(new Set(presetTemplates.map(t => t.preset_category ?? 'Other')))]
  const filteredPresets = presetTemplates.filter(t => {
    const matchSearch = !templateSearch || t.title.toLowerCase().includes(templateSearch.toLowerCase())
    const matchCat = categoryFilter === 'All' || t.preset_category === categoryFilter
    return matchSearch && matchCat
  })
  const filteredSaved = savedTemplates.filter(t =>
    !templateSearch || t.title.toLowerCase().includes(templateSearch.toLowerCase())
  )

  function addExercise(exercise: Exercise) {
    if (items.find(i => i.exercise_id === exercise.id)) return
    setItems(prev => [...prev, { exercise_id: exercise.id, exercise_name: exercise.name, muscle_group: exercise.muscle_group, sets: '3', reps: '10', weight: '', rest_seconds: '60', notes: '' }])
  }
  function removeExercise(idx: number) { setItems(prev => prev.filter((_, i) => i !== idx)) }
  function updateItem(idx: number, field: keyof WorkoutItem, value: string) {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }
  function moveUp(idx: number) { if (idx === 0) return; setItems(prev => { const a = [...prev]; [a[idx-1],a[idx]] = [a[idx],a[idx-1]]; return a }) }
  function moveDown(idx: number) { if (idx === items.length-1) return; setItems(prev => { const a = [...prev]; [a[idx],a[idx+1]] = [a[idx+1],a[idx]]; return a }) }

  function loadTemplate(t: SavedTemplate) {
    setTitle(t.title)
    setGoal(t.goal ?? '')
    setLevel((t.level as any) ?? 'intermediate')
    setSavedTemplateId(t.is_preset ? null : t.id)
    setShareUrl(null); setSaveError('')
    const sorted = [...t.workout_template_items].sort((a, b) => a.position - b.position)
    setItems(sorted.map(item => ({
      exercise_id: item.exercises?.id ?? '',
      exercise_name: item.exercises?.name ?? 'Unknown',
      muscle_group: item.exercises?.muscle_group ?? null,
      sets: String(item.sets ?? 3),
      reps: item.reps ?? '10',
      weight: item.weight ?? '',
      rest_seconds: String(item.rest_seconds ?? 60),
      notes: item.notes ?? '',
    })))
    setActivePanel(null)
  }

  function clearBuilder() {
    setTitle(''); setGoal(''); setLevel('intermediate')
    setItems([]); setSavedTemplateId(null); setShareUrl(null); setSaveError('')
  }

  function togglePanel(panel: PanelType) {
    setActivePanel(prev => prev === panel ? null : panel)
    setTemplateSearch(''); setCategoryFilter('All')
  }

  async function handleSave() {
    if (!title.trim()) { setSaveError('Workout title is required'); return }
    if (items.length === 0) { setSaveError('Add at least one exercise'); return }
    setSaving(true); setSaveError('')
    const res = await fetch('/api/workouts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(), goal: goal.trim() || null, level,
        items: items.map((item, idx) => ({
          exercise_id: item.exercise_id, position: idx,
          sets: Number(item.sets) || null, reps: item.reps || null,
          weight: item.weight || null, rest_seconds: Number(item.rest_seconds) || null,
          notes: item.notes || null,
        })),
      }),
    })
    const json = await res.json()
    if (!res.ok) { setSaveError(json.error ?? 'Failed to save'); setSaving(false); return }
    setSavedTemplateId(json.template_id)
    setSavedTemplates(prev => [{
      id: json.template_id, title: title.trim(), goal: goal || null,
      level, created_at: new Date().toISOString(), is_preset: false, preset_category: null,
      workout_template_items: items.map((item, idx) => ({
        id: Date.now() + '' + idx, position: idx,
        sets: Number(item.sets) || null, reps: item.reps || null,
        weight: item.weight || null, rest_seconds: Number(item.rest_seconds) || null,
        notes: item.notes || null,
        exercises: { id: item.exercise_id, name: item.exercise_name, muscle_group: item.muscle_group },
      })),
    }, ...prev.filter(t => t.id !== json.template_id)])
    setSaving(false)
  }

  async function handleAssign() {
    if (!savedTemplateId) { setSaveError('Save the workout first'); return }
    if (!assignMemberId) return
    setAssigning(true)
    const res = await fetch('/api/workouts/assign', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_id: savedTemplateId, member_id: assignMemberId }),
    })
    const json = await res.json()
    if (!res.ok) { setSaveError(json.error ?? 'Failed to assign'); setAssigning(false); return }
    setShareUrl(`${window.location.origin}/w/${json.share_token}`)
    setAssigning(false)
  }

  async function copyLink() {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const selectedMember = members.find(m => m.id === assignMemberId)

  return (
    <main className="flex-1 overflow-hidden">
      <div className="flex h-screen flex-col">

        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-border bg-bg-card px-6 py-3 gap-3">
          <div>
            <h1 className="text-xl font-semibold text-ink">Workout builder</h1>
            <p className="text-xs text-ink-muted">Build from scratch, load a preset, or pick a saved workout</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => togglePanel('presets')}
              className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${activePanel === 'presets' ? 'border-brand bg-brand-muted text-brand' : 'border-border bg-bg-page text-ink-secondary hover:bg-bg-card'}`}>
              <Sparkles className="h-4 w-4" />
              Preset plans
              <span className="rounded-full bg-brand px-1.5 text-[10px] font-bold text-white">{presetTemplates.length}</span>
            </button>
            <button onClick={() => togglePanel('saved')}
              className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${activePanel === 'saved' ? 'border-brand bg-brand-muted text-brand' : 'border-border bg-bg-page text-ink-secondary hover:bg-bg-card'}`}>
              <History className="h-4 w-4" />
              Saved workouts
              {savedTemplates.length > 0 && (
                <span className="rounded-full bg-brand-muted px-1.5 text-xs font-bold text-brand">{savedTemplates.length}</span>
              )}
            </button>
            {savedTemplateId && <span className="flex items-center gap-1.5 text-xs text-green-700 font-medium"><Check className="h-3.5 w-3.5" /> Saved</span>}
            <button onClick={handleSave} disabled={saving || items.length === 0}
              className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Saving…' : savedTemplateId ? 'Update' : 'Save workout'}
            </button>
          </div>
        </div>

        {saveError && <div className="border-b border-red-200 bg-red-50 px-6 py-2 text-sm text-red-600">{saveError}</div>}

        {/* 3-panel layout */}
        <div className="flex flex-1 overflow-hidden">

          {/* LEFT: Exercise library */}
          <div className="flex w-64 shrink-0 flex-col border-r border-border bg-bg-card overflow-hidden">
            <div className="p-3 border-b border-border">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-2">Exercise library</p>
              <div className="relative mb-2">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
                  className="h-8 w-full rounded-lg border border-border-medium bg-bg-input pl-8 pr-3 text-xs text-ink focus:border-brand-light focus:outline-none" />
              </div>
              <div className="flex flex-wrap gap-1">
                {MUSCLE_GROUPS.map(g => (
                  <button key={g} onClick={() => setMuscleFilter(g)}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${muscleFilter === g ? 'bg-brand text-white' : 'bg-bg-page text-ink-muted hover:bg-border'}`}>
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-3">
              {Object.entries(grouped).map(([group, exs]) => (
                <div key={group}>
                  <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-ink-muted">{group}</p>
                  {exs.map(e => {
                    const added = items.some(i => i.exercise_id === e.id)
                    return (
                      <button key={e.id} onClick={() => addExercise(e)} disabled={added}
                        className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors ${added ? 'opacity-40 cursor-not-allowed' : 'hover:bg-brand-muted hover:text-brand'}`}>
                        <Dumbbell className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-ink">{e.name}</p>
                          {e.equipment && <p className="text-[10px] text-ink-muted">{e.equipment}</p>}
                        </div>
                        {!added && <Plus className="h-3.5 w-3.5 shrink-0 text-ink-muted ml-auto" />}
                      </button>
                    )
                  })}
                </div>
              ))}
              {filteredExercises.length === 0 && <p className="px-2 py-4 text-center text-xs text-ink-muted">No exercises found</p>}
            </div>
          </div>

          {/* CENTER: Builder */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="border-b border-border p-4 flex gap-3 items-center">
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Workout title (e.g. Push Day A)"
                className="h-9 flex-1 rounded-lg border border-border-medium bg-bg-input px-3 text-sm font-semibold text-ink placeholder:text-ink-muted focus:border-brand-light focus:outline-none" />
              <input value={goal} onChange={e => setGoal(e.target.value)} placeholder="Goal"
                className="h-9 w-36 rounded-lg border border-border-medium bg-bg-input px-3 text-sm text-ink placeholder:text-ink-muted focus:border-brand-light focus:outline-none" />
              <select value={level} onChange={e => setLevel(e.target.value as any)}
                className="h-9 w-32 rounded-lg border border-border-medium bg-bg-input px-3 text-sm text-ink focus:border-brand-light focus:outline-none">
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
              {(title || items.length > 0) && (
                <button onClick={clearBuilder} title="Clear builder"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-ink-muted hover:bg-red-50 hover:text-red-500">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <div className="flex gap-3 mb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-muted">
                      <Sparkles className="h-6 w-6 text-brand" />
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-bg-page border border-border">
                      <Dumbbell className="h-6 w-6 text-ink-muted" />
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-ink">Start your workout plan</p>
                  <p className="text-xs text-ink-muted mt-1 max-w-xs">
                    Pick a <button className="text-brand font-medium hover:underline" onClick={() => togglePanel('presets')}>preset plan</button> to start from, or add exercises from the library on the left
                  </p>
                </div>
              ) : (
                items.map((item, idx) => (
                  <div key={item.exercise_id} className="rounded-xl border border-border bg-bg-card p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-muted text-xs font-bold text-brand">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-ink">{item.exercise_name}</p>
                        {item.muscle_group && <p className="text-xs text-ink-muted">{item.muscle_group}</p>}
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => moveUp(idx)} disabled={idx === 0} title="Move up" className="rounded p-1 text-ink-muted hover:bg-bg-page disabled:opacity-30"><ChevronUp className="h-3.5 w-3.5" /></button>
                        <button onClick={() => moveDown(idx)} disabled={idx === items.length-1} title="Move down" className="rounded p-1 text-ink-muted hover:bg-bg-page disabled:opacity-30"><ChevronDown className="h-3.5 w-3.5" /></button>
                        <button onClick={() => removeExercise(idx)} title="Remove" className="rounded p-1 text-ink-muted hover:bg-red-50 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 mb-2">
                      {([
                        { label: 'Sets', field: 'sets' as const, placeholder: '3' },
                        { label: 'Reps', field: 'reps' as const, placeholder: '10' },
                        { label: 'Weight', field: 'weight' as const, placeholder: 'BW / 20kg' },
                        { label: 'Rest (s)', field: 'rest_seconds' as const, placeholder: '60' },
                      ]).map(({ label, field, placeholder }) => (
                        <div key={field}>
                          <label className="text-[10px] font-medium text-ink-muted">{label}</label>
                          <input value={item[field]} onChange={e => updateItem(idx, field, e.target.value)} placeholder={placeholder}
                            className="mt-0.5 h-8 w-full rounded-lg border border-border-medium bg-bg-input px-2 text-xs text-ink focus:border-brand-light focus:outline-none" />
                        </div>
                      ))}
                    </div>
                    <input value={item.notes} onChange={e => updateItem(idx, 'notes', e.target.value)} placeholder="Notes (optional)"
                      className="h-7 w-full rounded-lg border border-border bg-bg-page px-2 text-xs text-ink placeholder:text-ink-muted focus:border-brand-light focus:outline-none" />
                  </div>
                ))
              )}
            </div>
          </div>

          {/* RIGHT: Assign */}
          <div className="flex w-64 shrink-0 flex-col border-l border-border bg-bg-card overflow-hidden">
            <div className="p-4 border-b border-border">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-3">Assign to member</p>
              {members.length === 0 ? <p className="text-xs text-ink-muted">No active members.</p> : (
                <>
                  <select title="Select member" value={assignMemberId} onChange={e => setAssignMemberId(e.target.value)}
                    className="h-9 w-full rounded-lg border border-border-medium bg-bg-input px-3 text-sm text-ink focus:border-brand-light focus:outline-none mb-3">
                    {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                  </select>
                  {selectedMember && (
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: avatarColor(selectedMember.full_name) }}>{selectedMember.initials}</div>
                      <div><p className="text-xs font-medium text-ink">{selectedMember.full_name}</p><p className="text-[10px] text-ink-muted">Active member</p></div>
                    </div>
                  )}
                  <button onClick={handleAssign} disabled={assigning || !savedTemplateId}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-50">
                    {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                    {assigning ? 'Assigning…' : 'Assign & share'}
                  </button>
                  {!savedTemplateId && <p className="mt-2 text-center text-[10px] text-ink-muted">Save the workout first</p>}
                </>
              )}
            </div>

            {shareUrl && (
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-green-700"><Check className="h-3.5 w-3.5" /> Assigned!</div>
                <div className="rounded-lg border border-border bg-bg-page p-2">
                  <p className="text-[10px] text-ink-muted mb-1">Share link</p>
                  <p className="break-all text-[10px] text-ink font-mono">{shareUrl}</p>
                </div>
                <button onClick={copyLink} className="flex w-full items-center justify-center gap-2 rounded-lg border border-border py-2 text-xs font-medium text-ink-secondary hover:bg-bg-page">
                  {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}{copied ? 'Copied!' : 'Copy link'}
                </button>
                <a href={shareUrl} target="_blank" rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-brand bg-brand-muted py-2 text-xs font-medium text-brand hover:bg-brand-muted/80">
                  <Link className="h-3.5 w-3.5" /> Preview
                </a>
              </div>
            )}

            <div className="mt-auto border-t border-border p-4 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Summary</p>
              <div className="grid grid-cols-2 gap-2">
                {[{ label: 'Exercises', value: items.length }, { label: 'Total sets', value: items.reduce((s, i) => s + (Number(i.sets) || 0), 0) }].map(({ label, value }) => (
                  <div key={label} className="rounded-lg border border-border p-2 text-center">
                    <p className="text-lg font-bold text-ink">{value}</p>
                    <p className="text-[10px] text-ink-muted">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Slide-over panel */}
      {activePanel && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setActivePanel(null)} />
          <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-bg-card shadow-2xl">

            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                {activePanel === 'presets'
                  ? <><Sparkles className="h-4 w-4 text-brand" /><h2 className="text-base font-semibold text-ink">Preset plans</h2><span className="rounded-full bg-brand px-2 text-xs font-bold text-white">{presetTemplates.length}</span></>
                  : <><History className="h-4 w-4 text-brand" /><h2 className="text-base font-semibold text-ink">Saved workouts</h2><span className="rounded-full bg-brand-muted px-2 text-xs font-bold text-brand">{savedTemplates.length}</span></>
                }
              </div>
              <button onClick={() => setActivePanel(null)} className="rounded-lg p-1.5 text-ink-muted hover:bg-bg-page"><X className="h-4 w-4" /></button>
            </div>

            {/* Tab switcher */}
            <div className="flex gap-1 border-b border-border px-4 py-2">
              <button onClick={() => { setActivePanel('presets'); setTemplateSearch(''); setCategoryFilter('All') }}
                className={`flex-1 rounded-lg py-1.5 text-xs font-semibold ${activePanel === 'presets' ? 'bg-brand text-white' : 'text-ink-muted hover:bg-bg-page'}`}>
                Preset plans
              </button>
              <button onClick={() => { setActivePanel('saved'); setTemplateSearch('') }}
                className={`flex-1 rounded-lg py-1.5 text-xs font-semibold ${activePanel === 'saved' ? 'bg-brand text-white' : 'text-ink-muted hover:bg-bg-page'}`}>
                My saved workouts
              </button>
            </div>

            {/* Search */}
            <div className="p-3 border-b border-border">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
                <input value={templateSearch} onChange={e => setTemplateSearch(e.target.value)}
                  placeholder={activePanel === 'presets' ? 'Search preset plans…' : 'Search saved workouts…'}
                  className="h-9 w-full rounded-lg border border-border-medium bg-bg-input pl-8 pr-3 text-sm text-ink focus:border-brand-light focus:outline-none" />
              </div>
              {activePanel === 'presets' && (
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {presetCategories.map(cat => (
                    <button key={cat} onClick={() => setCategoryFilter(cat)}
                      className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${categoryFilter === cat ? 'bg-brand text-white' : 'bg-bg-page text-ink-muted hover:bg-border'}`}>
                      {cat !== 'All' && <span>{CATEGORY_ICONS[cat] ?? '💪'}</span>}
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {activePanel === 'presets' && (
                filteredPresets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Sparkles className="h-10 w-10 text-ink-muted mb-3" />
                    <p className="text-sm font-medium text-ink">No presets found</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-border">
                    {filteredPresets.map(t => (
                      <li key={t.id}>
                        <button onClick={() => loadTemplate(t)}
                          className="flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-bg-page transition-colors">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-muted text-xl">
                            {CATEGORY_ICONS[t.preset_category ?? ''] ?? '🏋️'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-ink">{t.title}</p>
                              {t.level && (
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border capitalize ${LEVEL_COLORS[t.level] ?? ''}`}>{t.level}</span>
                              )}
                            </div>
                            {t.goal && <p className="text-xs text-ink-muted mt-0.5">{t.goal}</p>}
                            <div className="flex items-center gap-3 mt-1.5">
                              <span className="flex items-center gap-1 text-[10px] text-ink-muted">
                                <Dumbbell className="h-3 w-3" /> {t.workout_template_items.length} exercises
                              </span>
                              {t.preset_category && (
                                <span className="flex items-center gap-1 text-[10px] text-ink-muted">
                                  <Tag className="h-3 w-3" /> {t.preset_category}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="shrink-0 rounded-lg border border-brand bg-brand-muted px-2.5 py-1 text-xs font-semibold text-brand">
                            Load
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )
              )}

              {activePanel === 'saved' && (
                filteredSaved.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <History className="h-10 w-10 text-ink-muted mb-3" />
                    <p className="text-sm font-medium text-ink">No saved workouts yet</p>
                    <p className="text-xs text-ink-muted mt-1">Build and save a workout to see it here</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-border">
                    {filteredSaved.map(t => {
                      const isLoaded = savedTemplateId === t.id
                      return (
                        <li key={t.id}>
                          <button onClick={() => loadTemplate(t)}
                            className={`flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-bg-page transition-colors ${isLoaded ? 'bg-brand-muted' : ''}`}>
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-bg-page border border-border">
                              <Dumbbell className="h-4 w-4 text-ink-muted" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-sm font-semibold text-ink">{t.title}</p>
                                {isLoaded && <span className="text-[10px] bg-brand text-white px-1.5 py-0.5 rounded-full shrink-0">Loaded</span>}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                {t.level && <span className="text-[10px] text-ink-muted capitalize">{t.level}</span>}
                                {t.goal && <span className="text-[10px] text-ink-muted">· {t.goal}</span>}
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="flex items-center gap-1 text-[10px] text-ink-muted">
                                  <Dumbbell className="h-2.5 w-2.5" /> {t.workout_template_items.length} exercises
                                </span>
                                {t.created_at && (
                                  <span className="flex items-center gap-1 text-[10px] text-ink-muted">
                                    <Clock className="h-2.5 w-2.5" /> {timeAgo(t.created_at)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )
              )}
            </div>

            <div className="border-t border-border px-5 py-3">
              <button onClick={() => { clearBuilder(); setActivePanel(null) }}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-border py-2 text-sm font-medium text-ink-secondary hover:bg-bg-page">
                <Plus className="h-4 w-4" /> Start from scratch
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  )
}