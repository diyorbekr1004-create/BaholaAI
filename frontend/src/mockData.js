export const mockAssignments = [
  {
    id: 1,
    title: 'Oliy matematika - Differensial tenglamalar',
    description: 'Tenglamalarni yeching va javobni tushuntiring.',
    subject_id: 1,
    teacher_id: 1,
  },
  {
    id: 2,
    title: 'Ingliz tili - Academic writing',
    description: 'Berilgan mavzu bo\'yicha akademik esse yozing.',
    subject_id: 2,
    teacher_id: 1,
  },
];

export const mockRubrics = {
  1: {
    version: 'v1',
    criteria: [
      { name: 'Aniqlik', max_score: 30 },
      { name: 'Hisoblash', max_score: 35 },
      { name: 'Tushuntirish', max_score: 35 },
    ],
  },
  2: {
    version: 'v1',
    criteria: [
      { name: 'Mavzu tushunishi', max_score: 30 },
      { name: 'Grammatik to\'g\'rilig', max_score: 35 },
      { name: 'Argumentatsiya', max_score: 35 },
    ],
  },
};

export const mockSubmissions = [
  {
    id: 101,
    assignment_id: 1,
    student_name: 'Ali Valiyev',
    file_name: 'ans.pdf',
    status: 'approved',
    final_score: 88,
    suggested_score: 88,
    confidence: 0.82,
    feedback: 'Javob asosli va dalillarga boy.',
  },
  {
    id: 102,
    assignment_id: 2,
    student_name: 'Zarina Nematova',
    file_name: 'essay.docx',
    status: 'pending',
    final_score: null,
    suggested_score: 76,
    confidence: 0.74,
    feedback: 'Asosiy g\'oyalar mavjud, lekin xulosa yanada aniq bo\'lishi kerak.',
  },
];

export const mockStats = {
  totalSubmissions: 2,
  averageScore: 82,
  mostCommonIssue: 'Tushuntirish yetarli emas',
};
