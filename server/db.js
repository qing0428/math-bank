const Database = require('better-sqlite3')
const path = require('path')

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'mathbank.db')
const db = new Database(DB_PATH)

// WAL mode for better read concurrency
db.pragma('journal_mode = WAL')

// Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS questions (
    id              TEXT PRIMARY KEY,
    content         TEXT NOT NULL DEFAULT '',
    answer          TEXT NOT NULL DEFAULT '',
    solution        TEXT NOT NULL DEFAULT '',
    grade           TEXT NOT NULL DEFAULT '',
    semester        TEXT NOT NULL DEFAULT '',
    unit            TEXT NOT NULL DEFAULT '',
    topic           TEXT NOT NULL DEFAULT '',
    question_type   TEXT NOT NULL DEFAULT '',
    difficulty      INTEGER NOT NULL DEFAULT 3,
    tags            TEXT NOT NULL DEFAULT '[]',
    notes           TEXT NOT NULL DEFAULT '',
    exam_name       TEXT NOT NULL DEFAULT '',
    image_url       TEXT NOT NULL DEFAULT '',
    image_position  TEXT NOT NULL DEFAULT 'right',
    has_handwriting INTEGER NOT NULL DEFAULT 0,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_questions_grade ON questions(grade);
  CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(topic);
  CREATE INDEX IF NOT EXISTS idx_questions_type ON questions(question_type);
  CREATE INDEX IF NOT EXISTS idx_questions_created ON questions(created_at);
`)

// Migration: add image_position column if missing (for existing databases)
try { db.exec(`ALTER TABLE questions ADD COLUMN image_position TEXT NOT NULL DEFAULT 'right'`) } catch { /* column exists */ }
// Migration: add semester and unit columns if missing
try { db.exec(`ALTER TABLE questions ADD COLUMN semester TEXT NOT NULL DEFAULT ''`) } catch { /* column exists */ }
try { db.exec(`ALTER TABLE questions ADD COLUMN unit TEXT NOT NULL DEFAULT ''`) } catch { /* column exists */ }
try { db.exec(`ALTER TABLE questions ADD COLUMN has_handwriting INTEGER NOT NULL DEFAULT 0`) } catch { /* column exists */ }

// Field mapping: camelCase <-> snake_case
function toDb(q) {
  return {
    id: q.id,
    content: q.content || '',
    answer: q.answer || '',
    solution: q.solution || '',
    grade: q.grade || '',
    semester: q.semester || '',
    unit: q.unit || '',
    topic: q.topic || '',
    question_type: q.questionType || '',
    difficulty: q.difficulty ?? 3,
    tags: JSON.stringify(q.tags || []),
    notes: q.notes || '',
    exam_name: q.examName || '',
    image_url: q.imageUrl || '',
    image_position: q.imagePosition || 'right',
    has_handwriting: q.hasHandwriting ? 1 : 0,
    created_at: q.createdAt,
    updated_at: q.updatedAt,
  }
}

function fromDb(row) {
  return {
    id: row.id,
    content: row.content,
    answer: row.answer,
    solution: row.solution,
    grade: row.grade,
    semester: row.semester || '',
    unit: row.unit || '',
    topic: row.topic,
    questionType: row.question_type,
    difficulty: row.difficulty,
    tags: JSON.parse(row.tags),
    notes: row.notes,
    examName: row.exam_name,
    imageUrl: row.image_url,
    imagePosition: row.image_position || 'right',
    hasHandwriting: !!row.has_handwriting,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// Prepared statements
const stmts = {
  getAll: db.prepare('SELECT * FROM questions ORDER BY created_at DESC'),
  getById: db.prepare('SELECT * FROM questions WHERE id = ?'),
  upsert: db.prepare(`
    INSERT OR REPLACE INTO questions
      (id, content, answer, solution, grade, semester, unit, topic, question_type, difficulty,
       tags, notes, exam_name, image_url, image_position, has_handwriting, created_at, updated_at)
    VALUES (@id, @content, @answer, @solution, @grade, @semester, @unit, @topic, @question_type,
       @difficulty, @tags, @notes, @exam_name, @image_url, @image_position, @has_handwriting, @created_at, @updated_at)
  `),
  delete: db.prepare('DELETE FROM questions WHERE id = ?'),
  count: db.prepare('SELECT COUNT(*) as count FROM questions'),
  stats: db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN date(created_at/1000, 'unixepoch', 'localtime') = date('now', 'localtime') THEN 1 ELSE 0 END) as todayNew,
      SUM(CASE WHEN date(updated_at/1000, 'unixepoch', 'localtime') = date('now', 'localtime') THEN 1 ELSE 0 END) as todayModified,
      AVG(difficulty) as avgDifficulty
    FROM questions
  `),
  tagFreq: db.prepare(`
    SELECT tag, COUNT(*) as count FROM (
      SELECT json_each.value as tag FROM questions, json_each(questions.tags)
      WHERE questions.tags != '[]'
    ) GROUP BY tag ORDER BY count DESC LIMIT 15
  `),
}

// Batch upsert as a transaction
const upsertMany = db.transaction((questions) => {
  let count = 0
  for (const q of questions) {
    stmts.upsert.run(toDb(q))
    count++
  }
  return count
})

module.exports = { db, stmts, upsertMany, toDb, fromDb }
