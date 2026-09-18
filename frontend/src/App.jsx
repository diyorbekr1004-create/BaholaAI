import { useEffect, useMemo, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, Link } from 'react-router-dom'
import './App.css'

const API_BASE = 'http://127.0.0.1:8000'
const defaultCriteria = [{ name: '', max_score: 10 }]

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
  const [isLoggedIn, setIsLoggedIn] = useState(true)
  const [assignments, setAssignments] = useState([])
  const [rubrics, setRubrics] = useState({})
  const [submissions, setSubmissions] = useState([])
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(null)
  const [newAssignment, setNewAssignment] = useState({ title: '', description: '' })
  const [criteriaDraft, setCriteriaDraft] = useState(defaultCriteria)
  const [studentName, setStudentName] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')

  const loadAssignments = async () => {
    try {
      const data = await fetchJson(`${API_BASE}/assignments`)
      setAssignments(data)
      if (!selectedAssignmentId && data.length) {
        setSelectedAssignmentId(data[0].id)
      }
    } catch (err) {
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

  const selectedAssignment = useMemo(
    () => assignments.find((item) => item.id === selectedAssignmentId) ?? assignments[0] ?? null,
    [assignments, selectedAssignmentId],
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
        }),
      })

      setAssignments((previous) => [created, ...previous])
      setSelectedAssignmentId(created.id)
      setNewAssignment({ title: '', description: '' })
      setErrorMessage('')
    } catch (err) {
      setErrorMessage(err.message)
    }
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

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            isLoggedIn ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <LoginScreen onLogin={() => setIsLoggedIn(true)} />
            )
          }
        />
        <Route
          path="/dashboard"
          element={
            isLoggedIn ? (
              <Dashboard
                assignments={assignments}
                selectedAssignment={selectedAssignment}
                setSelectedAssignmentId={setSelectedAssignmentId}
                newAssignment={newAssignment}
                setNewAssignment={setNewAssignment}
                handleCreateAssignment={handleCreateAssignment}
                criteriaDraft={criteriaDraft}
                handleCriteriaChange={handleCriteriaChange}
                handleAddCriteria={handleAddCriteria}
                handleSaveRubric={handleSaveRubric}
                selectedRubric={selectedRubric}
                studentName={studentName}
                setStudentName={setStudentName}
                selectedFile={selectedFile}
                setSelectedFile={setSelectedFile}
                handleSubmissionUpload={handleSubmissionUpload}
                assignmentSubmissions={assignmentSubmissions}
                handleApproveSubmission={handleApproveSubmission}
                handleExportReport={handleExportReport}
                averageScore={averageScore}
                onLogout={() => setIsLoggedIn(false)}
                errorMessage={errorMessage}
              />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

function LoginScreen({ onLogin }) {
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <span className="eyebrow">BaholaAI</span>
        <h1>O'qituvchi kabineti</h1>
        <p>
          Topshiriq, rubrika, javob va baholash jarayonini bitta dashboarddan boshqaring.
        </p>
        <button type="button" className="primary-button" onClick={onLogin}>
          Kirish
        </button>
      </div>
    </div>
  )
}

function Dashboard({
  assignments,
  selectedAssignment,
  setSelectedAssignmentId,
  newAssignment,
  setNewAssignment,
  handleCreateAssignment,
  criteriaDraft,
  handleCriteriaChange,
  handleAddCriteria,
  handleSaveRubric,
  selectedRubric,
  studentName,
  setStudentName,
  selectedFile,
  setSelectedFile,
  handleSubmissionUpload,
  assignmentSubmissions,
  handleApproveSubmission,
  handleExportReport,
  averageScore,
  onLogout,
  errorMessage,
}) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <span className="eyebrow">BaholaAI</span>
          <h2>Tekshirish paneli</h2>
        </div>
        <nav className="topbar-nav" aria-label="Asosiy navigatsiya">
          <Link to="/dashboard">Topshiriqlar</Link>
          <Link to="/dashboard">Javoblar</Link>
          <Link to="/dashboard">Statistika</Link>
        </nav>
        <button type="button" onClick={onLogout} className="secondary-button">
          Chiqish
        </button>
      </header>

      <main className="dashboard-grid">
        <aside className="sidebar">
          <div className="panel">
            <div className="panel-header">
              <h3>Topshiriqlar</h3>
              <span>{assignments.length}</span>
            </div>
            <div className="assignment-list">
              {assignments.map((assignment) => (
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
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="content">
          {selectedAssignment && (
            <div className="panel spotlight">
              <div>
                <span className="eyebrow">Tanlangan topshiriq</span>
                <h3>{selectedAssignment.title}</h3>
              </div>
              <p>{selectedAssignment.description}</p>
            </div>
          )}

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
              <button type="submit" className="primary-button">
                Saqlash
              </button>
            </form>
          </div>

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

          {selectedAssignment && (
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

          {errorMessage && <div className="error-banner">{errorMessage}</div>}
        </section>
      </main>
    </div>
  )
}

export default App
