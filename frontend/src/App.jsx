import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import './App.css'

const API_BASE = 'http://127.0.0.1:8001'
const defaultCriteria = [{ name: '', max_score: 10 }]
const starterAssignments = []

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
    ...options,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || 'Request failed')
  }

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return response.json()
  }

  return null
}

function App() {
  const fileInputRef = useRef(null)
  const [isLoggedIn, setIsLoggedIn] = useState(true)
  const [activeTab, setActiveTab] = useState('assignments')
  const [assignments, setAssignments] = useState(starterAssignments)
  const [rubrics, setRubrics] = useState({})
  const [submissions, setSubmissions] = useState([])
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(null)
  const [assignmentSearch, setAssignmentSearch] = useState('')
  const [newAssignment, setNewAssignment] = useState({
    title: '',
    description: '',
    deadline: '',
    attachment: null,
  })
  const [criteriaDraft, setCriteriaDraft] = useState(defaultCriteria)
  const [studentName, setStudentName] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState([
    {
      role: 'ai',
      text: 'Assalomu alaykum! Men BaholaAI yordamchisiman. Talaba javobi, topshiriq yoki oquv materiallari haqida biror masalada yordam bera olaman.',
    },
  ])
  const [chatLoading, setChatLoading] = useState(false)

  const loadAssignments = async () => {
    try {
      const data = await fetchJson(`${API_BASE}/assignments`)
      const nextAssignments = Array.isArray(data) ? data : []

      setAssignments(nextAssignments)
      if (!selectedAssignmentId && nextAssignments.length) {
        setSelectedAssignmentId(nextAssignments[0].id)
      }
    } catch (err) {
      setAssignments([])
      setErrorMessage(err.message)
    }
  }

  const loadSubmissions = async (assignmentId) => {
    if (!assignmentId) return

    try {
      const data = await fetchJson(`${API_BASE}/assignments/${assignmentId}/submissions`)
      setSubmissions(data)
    } catch (err) {
      setSubmissions([])
      setErrorMessage(err.message)
    }
  }

  useEffect(() => {
    loadAssignments()
  }, [])

  useEffect(() => {
    if (selectedAssignmentId) {
      loadSubmissions(selectedAssignmentId)
    }
  }, [selectedAssignmentId])

  const loadRubric = async (assignmentId) => {
    if (!assignmentId) return

    try {
      const rubric = await fetchJson(`${API_BASE}/assignments/${assignmentId}/rubric`)
      setRubrics((previous) => ({ ...previous, [assignmentId]: rubric }))
      setCriteriaDraft(
        rubric.criteria.map((criterion) => ({
          name: criterion.name,
          max_score: criterion.max_score,
        })),
      )
    } catch {
      setRubrics((previous) => ({ ...previous, [assignmentId]: { version: 'v1', criteria: [] } }))
      setCriteriaDraft(defaultCriteria)
    }
  }

  useEffect(() => {
    if (selectedAssignmentId) {
      loadRubric(selectedAssignmentId)
    }
  }, [selectedAssignmentId])

  const filteredAssignments = useMemo(() => {
    if (!assignmentSearch.trim()) return assignments
    const query = assignmentSearch.toLowerCase()
    return assignments.filter(
      (assignment) =>
        assignment.title.toLowerCase().includes(query) ||
        assignment.description.toLowerCase().includes(query),
    )
  }, [assignments, assignmentSearch])

  const selectedAssignment = useMemo(
    () =>
      assignments.find((item) => item.id === selectedAssignmentId) ??
      filteredAssignments[0] ??
      null,
    [assignments, filteredAssignments, selectedAssignmentId],
  )

  const selectedRubric = useMemo(
    () =>
      (selectedAssignment && rubrics[selectedAssignment.id]) || {
        version: 'v1',
        criteria: [],
      },
    [rubrics, selectedAssignment],
  )

  const assignmentSubmissions = useMemo(
    () =>
      selectedAssignment
        ? submissions.filter((submission) => submission.assignment_id === selectedAssignment.id)
        : [],
    [submissions, selectedAssignment],
  )

  const averageScore = useMemo(() => {
    if (!assignmentSubmissions.length) return 0
    const approved = assignmentSubmissions.filter((item) => item.final_score != null)
    if (!approved.length) return 0
    return approved.reduce((total, item) => total + Number(item.final_score || 0), 0) / approved.length
  }, [assignmentSubmissions])

  const handleCreateAssignment = async (event) => {
    event.preventDefault()
    if (!newAssignment.title.trim()) return

    try {
      const created = await fetchJson(`${API_BASE}/assignments`, {
        method: 'POST',
        body: JSON.stringify({
          teacher_id: 1,
          subject_id: 1,
          title: newAssignment.title.trim(),
          description: newAssignment.description.trim() || 'Yangi topshiriq tayyorlandi.',
          deadline: newAssignment.deadline || null,
        }),
      })

      setAssignments((previous) => [created, ...previous])
      setSelectedAssignmentId(created.id)
      setNewAssignment({ title: '', description: '', deadline: '', attachment: null })
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      setErrorMessage('')
    } catch (err) {
      setErrorMessage(err.message)
    }
  }

  const handleAttachmentChange = (event) => {
    const file = event.target.files?.[0] || null
    setNewAssignment((previous) => ({ ...previous, attachment: file }))
  }

  const handleCriteriaChange = (index, field, value) => {
    setCriteriaDraft((previous) =>
      previous.map((criterion, currentIndex) => {
        if (currentIndex !== index) return criterion
        return {
          ...criterion,
          [field]: field === 'max_score' ? Number(value || 0) : value,
        }
      }),
    )
  }

  const handleAddCriteria = () => {
    setCriteriaDraft((previous) => [...previous, { name: '', max_score: 10 }])
  }

  const handleSaveRubric = async () => {
    if (!selectedAssignment) return

    const cleanedCriteria = criteriaDraft
      .filter((criterion) => criterion.name.trim())
      .map((criterion) => ({
        name: criterion.name.trim(),
        max_score: Number(criterion.max_score) || 10,
      }))

    if (!cleanedCriteria.length) {
      setErrorMessage('Rubrikada kamida bitta valid mezon bo’lishi kerak.')
      return
    }

    try {
      const rubric = await fetchJson(`${API_BASE}/assignments/${selectedAssignment.id}/rubric`, {
        method: 'POST',
        body: JSON.stringify({
          version: 'v1',
          criteria: cleanedCriteria,
        }),
      })

      setRubrics((previous) => ({
        ...previous,
        [selectedAssignment.id]: rubric,
      }))
      setCriteriaDraft(
        rubric.criteria.map((criterion) => ({
          name: criterion.name,
          max_score: criterion.max_score,
        })),
      )
      setErrorMessage('')
    } catch (err) {
      setErrorMessage(err.message)
    }
  }

  const startGrading = async (submissionId) => {
    try {
      await fetchJson(`${API_BASE}/submissions/${submissionId}/grade`, {
        method: 'POST',
      })

      const pollStatus = async () => {
        const status = await fetchJson(`${API_BASE}/submissions/${submissionId}/status`)
        setSubmissions((previous) =>
          previous.map((item) =>
            item.id === submissionId
              ? {
                  ...item,
                  status: status.status,
                  suggested_score: status.suggested_score,
                  confidence: status.confidence,
                  feedback: status.feedback,
                  final_score: status.final_score,
                  needs_teacher_review: status.needs_teacher_review,
                }
              : item,
          ),
        )

        if (status.status === 'done' || status.status === 'approved' || status.status === 'pending') {
          if (status.status === 'done' || status.status === 'approved') {
            return
          }
          setTimeout(() => pollStatus(), 1200)
        }
      }

      setTimeout(() => pollStatus(), 1200)
    } catch (err) {
      setErrorMessage(err.message)
    }
  }

  const handleSubmissionUpload = async (event) => {
    event.preventDefault()
    if (!selectedAssignment || !selectedFile || !studentName.trim()) {
      setErrorMessage('Talaba ismi va faylni tanlang.')
      return
    }

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('student_name', studentName.trim())

      const createdSubmission = await fetchJson(`${API_BASE}/assignments/${selectedAssignment.id}/submissions`, {
        method: 'POST',
        body: formData,
      })

      setSubmissions((previous) => [
        {
          ...createdSubmission,
          status: 'uploaded',
          suggested_score: null,
          final_score: null,
          confidence: null,
          feedback: '',
        },
        ...previous,
      ])

      setStudentName('')
      setSelectedFile(null)
      setErrorMessage('')
      startGrading(createdSubmission.id)
    } catch (err) {
      setErrorMessage(err.message)
    }
  }

  const handleApproveSubmission = async (submissionId) => {
    const targetSubmission = submissions.find((submission) => submission.id === submissionId)
    if (!targetSubmission) return

    try {
      const payload = {
        final_score: Number(targetSubmission.suggested_score ?? targetSubmission.final_score ?? 0),
        teacher_note: 'O\'qituvchi tasdiqladi.',
      }

      const approved = await fetchJson(`${API_BASE}/submissions/${submissionId}/approve`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      setSubmissions((previous) =>
        previous.map((submission) =>
          submission.id === submissionId
            ? {
                ...submission,
                status: approved.status,
                final_score: approved.final_score,
              }
            : submission,
        ),
      )
      setErrorMessage('')
    } catch (err) {
      setErrorMessage(err.message)
    }
  }

  const handleExportReport = () => {
    if (!selectedAssignment) return

    const report = {
      assignment: selectedAssignment,
      generated_at: new Date().toISOString(),
      submissions: assignmentSubmissions,
      average_score: Number(averageScore.toFixed(2)),
    }

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${selectedAssignment.title.toLowerCase().replace(/\s+/g, '-')}-report.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleSendChat = async () => {
    const message = chatInput.trim()
    if (!message) return

    setChatMessages((previous) => [...previous, { role: 'user', text: message }])
    setChatInput('')
    setChatLoading(true)

    try {
      const context = selectedAssignment
        ? `Topshiriq: ${selectedAssignment.title}. ${selectedAssignment.description || ''}`
        : 'Umumiy akademik yordam'

      const data = await fetchJson(`${API_BASE}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          context,
        }),
      })

      const replyText = data?.reply || 'AI javobi bo’sh qaytdi.'
      setChatMessages((previous) => [...previous, { role: 'ai', text: replyText }])
    } catch (err) {
      setChatMessages((previous) => [
        ...previous,
        {
          role: 'ai',
          text: 'AI server bilan aloqa uzildi. Backend ishlayotganini tekshiring yoki keyinroq qayta urinib ko’ring.',
        },
      ])
    } finally {
      setChatLoading(false)
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <span className="eyebrow">BaholaAI</span>
          <h2>Tekshirish paneli</h2>
        </div>
        <nav className="topbar-nav" aria-label="Asosiy navigatsiya">
          {[
            { id: 'assignments', label: 'Topshiriqlar' },
            { id: 'submissions', label: 'Javoblar' },
            { id: 'reports', label: 'Statistika' },
            { id: 'subscriptions', label: 'Obunalar' },
            { id: 'ai', label: 'AI Yordamchi' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? 'nav-button active' : 'nav-button'}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <button type="button" onClick={() => setIsLoggedIn(false)} className="secondary-button">
          Chiqish
        </button>
      </header>

      <main className="dashboard-grid">
        {activeTab !== 'ai' && activeTab !== 'subscriptions' && (
          <aside className="sidebar">
            <div className="panel">
              <div className="panel-header">
                <h3>Topshiriqlar</h3>
                <span>{assignments.length}</span>
              </div>

              <div className="flex flex-col gap-3 mb-4">
                <button
                  type="button"
                  className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                  onClick={() => setActiveTab('assignments')}
                >
                  + Yangi topshiriq
                </button>

                <div className="search-box mb-0">
                  <input
                    type="search"
                    value={assignmentSearch}
                    onChange={(event) => setAssignmentSearch(event.target.value)}
                    placeholder="Topshiriqni qidiring..."
                  />
                </div>
              </div>

              <div className="assignment-list">
                {filteredAssignments.map((assignment) => (
                  <button
                    key={assignment.id}
                    type="button"
                    className={
                      selectedAssignment && assignment.id === selectedAssignment.id
                        ? 'assignment-card active'
                        : 'assignment-card'
                    }
                    onClick={() => setSelectedAssignmentId(assignment.id)}
                  >
                    <strong>{assignment.title}</strong>
                    <small>{assignment.description}</small>
                    {assignment.deadline && (
                      <span className="assignment-meta">
                        Muddat: {new Date(assignment.deadline).toLocaleString('uz-UZ')}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </aside>
        )}

        <section className="content w-full flex-1 p-6">
          {selectedAssignment && activeTab !== 'ai' && (
            <div className="panel spotlight">
              <div>
                <span className="eyebrow">Tanlangan topshiriq</span>
                <h3>{selectedAssignment.title}</h3>
              </div>

              <div className="assignment-action-group">
                <button type="button" className="ghost-button">
                  ✎ Tahrirlash
                </button>
                <button type="button" className="danger-button">
                  🗑 O'chirish
                </button>
              </div>
            </div>
          )}

          {activeTab === 'assignments' && (
            <>
              <div className="panel">
                <div className="panel-header">
                  <h3>Topshiriq yaratish</h3>
                </div>
                <form className="stacked-form" onSubmit={handleCreateAssignment}>
                  <label>
                    Nomi
                    <input
                      type="text"
                      value={newAssignment.title}
                      onChange={(event) =>
                        setNewAssignment((previous) => ({ ...previous, title: event.target.value }))
                      }
                      placeholder="Masalan: Oliy matematika - limitlar"
                    />
                  </label>

                  <label>
                    Tavsif
                    <textarea
                      rows="3"
                      value={newAssignment.description}
                      onChange={(event) =>
                        setNewAssignment((previous) => ({ ...previous, description: event.target.value }))
                      }
                      placeholder="Topshiriq maqsadi va talablarini yozing"
                    />
                  </label>

                  <div className="two-column-fields">
                    <label>
                      Oxirgi muddat
                      <input
                        type="datetime-local"
                        value={newAssignment.deadline}
                        onChange={(event) =>
                          setNewAssignment((previous) => ({ ...previous, deadline: event.target.value }))
                        }
                      />
                    </label>

                    <label className="file-upload-field">
                      Fayl biriktirish
                      <div className="file-upload-button">
                        <input
                          ref={fileInputRef}
                          type="file"
                          onChange={handleAttachmentChange}
                        />
                        <span>
                          {newAssignment.attachment ? newAssignment.attachment.name : 'Fayl tanlash'}
                        </span>
                      </div>
                    </label>
                  </div>

                  <div className="inline-actions">
                    <button type="button" className="secondary-button">
                      Bekor qilish
                    </button>
                    <button type="submit" className="primary-button">
                      Topshiriq yaratish
                    </button>
                  </div>
                </form>
              </div>

              {selectedAssignment && (
                <div className="panel assignment-detail-panel">
                  <div className="detail-header">
                    <div className="detail-copy">
                      <p className="label">Nomi</p>
                      <h4>{selectedAssignment.title}</h4>
                    </div>
                    <div className="detail-copy">
                      <p className="label">Muddat</p>
                      <h4>
                        {selectedAssignment.deadline
                          ? new Date(selectedAssignment.deadline).toLocaleString('uz-UZ')
                          : 'Muddat belgilanmagan'}
                      </h4>
                    </div>
                  </div>

                  <div className="detail-copy">
                    <p className="label">Tavsif</p>
                    <p className="description-text">{selectedAssignment.description}</p>
                  </div>

                  <div className="attachment-box">
                    <span className="label">Biriktirilgan fayl</span>
                    <div className="attachment-pill">
                      {selectedAssignment.attachmentName || 'Fayl yo\'q'}
                    </div>
                  </div>
                </div>
              )}

              {selectedAssignment && (
                <div className="panel">
                  <div className="panel-header">
                    <h3>Rubrikani sozlash</h3>
                    <span>{selectedRubric.criteria.length} mezon</span>
                  </div>
                  <div className="criteria-list">
                    {criteriaDraft.map((criterion, index) => (
                      <div key={`${criterion.name || 'criterion'}-${index}`} className="criterion-row">
                        <input
                          type="text"
                          value={criterion.name}
                          placeholder="Kriteriya nomi"
                          onChange={(event) => handleCriteriaChange(index, 'name', event.target.value)}
                        />
                        <input
                          type="number"
                          min="1"
                          value={criterion.max_score}
                          onChange={(event) => handleCriteriaChange(index, 'max_score', event.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="inline-actions">
                    <button type="button" className="secondary-button" onClick={handleAddCriteria}>
                      Yana qo'shish
                    </button>
                    <button type="button" className="primary-button" onClick={handleSaveRubric}>
                      Rubrikani saqlash
                    </button>
                  </div>
                </div>
              )}

              {selectedAssignment && (
                <div className="panel">
                  <div className="panel-header">
                    <h3>Talaba javobini yuklash</h3>
                  </div>
                  <form className="stacked-form" onSubmit={handleSubmissionUpload}>
                    <label>
                      Talaba ismi
                      <input
                        type="text"
                        value={studentName}
                        onChange={(event) => setStudentName(event.target.value)}
                        placeholder="Masalan: Bobur Karimov"
                      />
                    </label>
                    <label>
                      Fayl tanlash
                      <input
                        type="file"
                        onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                      />
                    </label>
                    <button type="submit" className="primary-button">
                      AI bilan tekshirish
                    </button>
                  </form>
                </div>
              )}
            </>
          )}

          {activeTab === 'submissions' && selectedAssignment && (
            <div className="panel">
              <div className="panel-header">
                <h3>Javoblar va baholash</h3>
                <button type="button" className="secondary-button" onClick={handleExportReport}>
                  Qaydnoma yuklab olish
                </button>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Talaba</th>
                      <th>Fayl</th>
                      <th>Holat</th>
                      <th>Taxminiy ball</th>
                      <th>Harakat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignmentSubmissions.map((submission) => (
                      <tr key={submission.id}>
                        <td>{submission.student_name}</td>
                        <td>{submission.file_name || submission.file_path?.split('/').pop() || '-'}</td>
                        <td>
                          <span className={`status status-${submission.status || 'pending'}`}>
                            {submission.status === 'approved'
                              ? 'Tasdiqlandi'
                              : submission.status === 'done'
                                ? 'Baholandi'
                                : 'Kutilmoqda'}
                          </span>
                        </td>
                        <td>{submission.suggested_score ?? submission.final_score ?? '-'}</td>
                        <td>
                          <button
                            type="button"
                            className="table-action"
                            onClick={() => handleApproveSubmission(submission.id)}
                          >
                            Tasdiqlash
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="stats-grid">
              <div className="panel metric-card">
                <span>Jami javoblar</span>
                <strong>{assignmentSubmissions.length}</strong>
              </div>
              <div className="panel metric-card">
                <span>O'rtacha ball</span>
                <strong>{Number(averageScore || 0).toFixed(2)}</strong>
              </div>
              <div className="panel metric-card">
                <span>Ko'p uchraydigan xato</span>
                <strong>{selectedRubric.criteria[0]?.name || 'Yuklanmoqda'}</strong>
              </div>
            </div>
          )}

          {activeTab === 'subscriptions' && (
            <div className="subscriptions-section panel w-full max-w-5xl mx-auto">
              <div className="panel-header subscriptions-header">
                <div>
                  <span className="eyebrow">Obunalar</span>
                  <h3>Bahola AI tariflari</h3>
                </div>
              </div>

              <div className="pricing-grid grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl mx-auto">
                <div className="pricing-card">
                  <div className="plan-label">Free</div>
                  <h4>Bahola AI Free</h4>
                  <div className="price-row">
                    <span className="price">$0</span>
                  </div>
                  <p className="plan-description">Bepul</p>
                  <ul>
                    <li>Oyiga 60 ta AI tekshirish</li>
                    <li>Asosiy baholash imkoniyati</li>
                    <li>Minimal ishlash limitlari</li>
                  </ul>
                  <button type="button" className="secondary-button full-width">
                    Hozir boshlash
                  </button>
                </div>

                <div className="pricing-card featured">
                  <div className="featured-badge">Eng mashhur</div>
                  <div className="plan-label">Plus</div>
                  <h4>Bahola AI Plus</h4>
                  <div className="price-row">
                    <span className="old-price">$10</span>
                    <span className="price">$7</span>
                  </div>
                  <p className="plan-description">Chegirmali narx</p>
                  <ul>
                    <li>Oyiga 500 ta AI tekshirish</li>
                    <li>Kengaytirilgan rubricalar</li>
                    <li>Tezkor revisiya va xulosa</li>
                  </ul>
                  <button type="button" className="primary-button full-width">
                    Tanlash
                  </button>
                </div>

                <div className="pricing-card">
                  <div className="plan-label">Pro</div>
                  <h4>Bahola AI Pro</h4>
                  <div className="price-row">
                    <span className="price">$22</span>
                    <span className="period">/ oy</span>
                  </div>
                  <p className="plan-description">Professional</p>
                  <ul>
                    <li>Oyiga 1500 ta AI tekshirish</li>
                    <li>Ko'proq talabalar va guruhlar</li>
                    <li>Yuqori quvvatli ishlash</li>
                  </ul>
                  <button type="button" className="secondary-button full-width">
                    Pro uchun tanlash
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="chat-panel panel w-full max-w-4xl mx-auto">
              <div className="panel-header">
                <h3>AI Yordamchi</h3>
              </div>
              <div className="chat-messages w-full">
                {chatMessages.map((message, index) => (
                  <div key={`${message.role}-${index}`} className={message.role === 'user' ? 'chat-row user' : 'chat-row ai'}>
                    <div className="chat-bubble">
                      {message.role === 'user' ? (
                        message.text
                      ) : (
                        <ReactMarkdown>{message.text}</ReactMarkdown>
                      )}
                    </div>
                  </div>
                ))}
                {chatLoading && <div className="chat-row ai"><div className="chat-bubble typing">Yozilmoqda...</div></div>}
              </div>
              <div className="chat-input-row w-full max-w-4xl mx-auto">
                <textarea
                  rows="3"
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  placeholder="Topshiriq, talaba javobi yoki o'quv materiali haqida savol bering..."
                />
                <button type="button" className="primary-button" onClick={handleSendChat} disabled={chatLoading}>
                  {chatLoading ? 'Yuborilmoqda...' : 'Yuborish'}
                </button>
              </div>
            </div>
          )}

          {errorMessage && <div className="error-banner">{errorMessage}</div>}
        </section>
      </main>
    </div>
  )
}

export default App
