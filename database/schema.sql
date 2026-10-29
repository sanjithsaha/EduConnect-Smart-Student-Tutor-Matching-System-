-- EduConnect relational schema (matches diagrams/source/erd.puml).
-- Portable SQL: tested with SQLite (tests/test_schema.py); for PostgreSQL use
-- GENERATED ALWAYS AS IDENTITY on the *_id keys, for MySQL use AUTO_INCREMENT.
PRAGMA foreign_keys = ON;

CREATE TABLE users (
  user_id       INTEGER PRIMARY KEY,
  full_name     VARCHAR(100) NOT NULL,
  email         VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(10)  NOT NULL CHECK (role IN ('student','tutor','admin')),
  phone         VARCHAR(20),
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE students (
  student_id     INTEGER PRIMARY KEY,
  user_id        INTEGER NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
  department     VARCHAR(80),
  academic_level VARCHAR(30)
);

CREATE TABLE tutors (
  tutor_id         INTEGER PRIMARY KEY,
  user_id          INTEGER NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
  bio              TEXT,
  hourly_rate      DECIMAL(8,2) NOT NULL CHECK (hourly_rate > 0),
  experience_years SMALLINT NOT NULL DEFAULT 0 CHECK (experience_years >= 0),
  avg_rating       DECIMAL(2,1) CHECK (avg_rating BETWEEN 0 AND 5),
  teaching_mode    VARCHAR(10) NOT NULL CHECK (teaching_mode IN ('online','in_person','both')),
  is_verified      BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE subjects (
  subject_id INTEGER PRIMARY KEY,
  name       VARCHAR(80) NOT NULL UNIQUE,
  category   VARCHAR(50)
);

CREATE TABLE tutor_subjects (
  tutor_id    INTEGER NOT NULL REFERENCES tutors(tutor_id)   ON DELETE CASCADE,
  subject_id  INTEGER NOT NULL REFERENCES subjects(subject_id) ON DELETE CASCADE,
  proficiency SMALLINT NOT NULL CHECK (proficiency BETWEEN 1 AND 5),
  PRIMARY KEY (tutor_id, subject_id)
);

CREATE TABLE availability_slots (
  slot_id     INTEGER PRIMARY KEY,
  tutor_id    INTEGER NOT NULL REFERENCES tutors(tutor_id) ON DELETE CASCADE,
  day_of_week VARCHAR(3) NOT NULL CHECK (day_of_week IN ('Sat','Sun','Mon','Tue','Wed','Thu','Fri')),
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  is_booked   BOOLEAN NOT NULL DEFAULT FALSE,
  CHECK (start_time < end_time)
);

CREATE TABLE match_requests (
  request_id     INTEGER PRIMARY KEY,
  student_id     INTEGER NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  subject_id     INTEGER NOT NULL REFERENCES subjects(subject_id),
  max_budget     DECIMAL(8,2) NOT NULL CHECK (max_budget > 0),
  preferred_mode VARCHAR(10) NOT NULL DEFAULT 'any' CHECK (preferred_mode IN ('any','online','in_person')),
  preferred_days VARCHAR(30),
  window_start   TIME,
  window_end     TIME,
  min_rating     DECIMAL(2,1) DEFAULT 0 CHECK (min_rating BETWEEN 0 AND 5),
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bookings (
  booking_id INTEGER PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(student_id),
  tutor_id   INTEGER NOT NULL REFERENCES tutors(tutor_id),
  slot_id    INTEGER NOT NULL REFERENCES availability_slots(slot_id),
  subject_id INTEGER NOT NULL REFERENCES subjects(subject_id),
  request_id INTEGER REFERENCES match_requests(request_id),
  status     VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','completed','cancelled')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Business rule: at most ONE active booking per slot (server-side double-booking guard).
CREATE UNIQUE INDEX uq_active_booking_per_slot ON bookings(slot_id) WHERE status IN ('pending','confirmed');
CREATE INDEX idx_slots_tutor_day ON availability_slots(tutor_id, day_of_week);
CREATE INDEX idx_bookings_student ON bookings(student_id, status);
