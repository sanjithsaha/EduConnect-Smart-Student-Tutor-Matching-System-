/**
 * EduConnect prototype - domain model classes.
 * Mirrors diagrams/source/class.puml (User, Student, Tutor, Subject,
 * AvailabilitySlot, StudentRequirement, BookingStatus).
 * Loaded as a classic script (no modules) so index.html works from file://.
 */
'use strict';

const BookingStatus = Object.freeze({
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
});

/** Bangladesh working week: Saturday to Thursday (Friday is the weekly holiday). */
const DAYS = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

/** "HH:MM" -> minutes since midnight. */
function toMinutes(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + m;
}

class User {
  constructor(id, name, email) {
    this.id = id;
    this.name = name;
    this.email = email;
  }
  get displayName() {
    return this.name;
  }
}

class Student extends User {
  constructor({ id, name, email, department, academicLevel }) {
    super(id, name, email);
    this.department = department;
    this.academicLevel = academicLevel;
  }
  createRequirement(params) {
    return new StudentRequirement({ ...params, studentId: this.id });
  }
}

class Subject {
  constructor({ id, name, category }) {
    this.id = id;
    this.name = name;
    this.category = category;
  }
}

class AvailabilitySlot {
  constructor({ id, tutorId, day, start, end, isBooked = false }) {
    this.id = id;
    this.tutorId = tutorId;
    this.day = day;
    this.start = start;
    this.end = end;
    this.isBooked = isBooked;
  }
  get durationMinutes() {
    return toMinutes(this.end) - toMinutes(this.start);
  }
  /** Minutes of overlap between this slot and a time range on the same day. */
  overlapMinutes(start, end) {
    const lo = Math.max(toMinutes(this.start), toMinutes(start));
    const hi = Math.min(toMinutes(this.end), toMinutes(end));
    return Math.max(0, hi - lo);
  }
  /** True when another slot is on the same day and overlaps in time. */
  overlapsSlot(other) {
    return this.day === other.day && this.overlapMinutes(other.start, other.end) > 0;
  }
  book() {
    if (this.isBooked) throw new Error(`Slot ${this.id} is already booked.`);
    this.isBooked = true;
  }
  release() {
    this.isBooked = false;
  }
  get label() {
    return `${this.day} ${this.start}-${this.end}`;
  }
}

class Tutor extends User {
  constructor({ id, name, email, bio, hourlyRate, experienceYears, rating, teachingMode, isVerified = true }) {
    super(id, name, email);
    this.bio = bio;
    this.hourlyRate = hourlyRate; // BDT per hour
    this.experienceYears = experienceYears;
    this.rating = rating; // 0-5 average
    this.teachingMode = teachingMode; // 'Online' | 'In-person' | 'Both'
    this.isVerified = isVerified;
    this.proficiency = new Map(); // subjectId -> 1..5
    this.slots = [];
  }
  addSubject(subjectId, level) {
    this.proficiency.set(subjectId, level);
  }
  teaches(subjectId) {
    return this.proficiency.has(subjectId);
  }
  getProficiency(subjectId) {
    return this.proficiency.get(subjectId) || 0;
  }
  addSlot(slot) {
    this.slots.push(slot);
  }
  getFreeSlots() {
    return this.slots.filter((s) => !s.isBooked);
  }
}

class StudentRequirement {
  constructor({ studentId, subjectId, maxBudget, mode = 'Any', days = [], windowStart = '', windowEnd = '', minRating = 0 }) {
    this.studentId = studentId;
    this.subjectId = subjectId;
    this.maxBudget = Number(maxBudget);
    this.mode = mode; // 'Any' | 'Online' | 'In-person'
    this.days = days;
    this.windowStart = windowStart;
    this.windowEnd = windowEnd;
    this.minRating = Number(minRating) || 0;
  }
  hasWindow() {
    return Boolean(this.windowStart && this.windowEnd);
  }
  /** Returns a list of human-readable validation errors (empty when valid). */
  validate() {
    const errors = [];
    if (!this.subjectId) errors.push('Please choose a subject.');
    if (!Number.isFinite(this.maxBudget) || this.maxBudget <= 0) errors.push('Budget must be a positive number (BDT per hour).');
    else if (this.maxBudget > 10000) errors.push('Budget looks unrealistic (max 10,000 BDT/hour).');
    if (Boolean(this.windowStart) !== Boolean(this.windowEnd)) errors.push('Provide both a start and an end time, or leave both empty.');
    if (this.hasWindow() && toMinutes(this.windowStart) >= toMinutes(this.windowEnd)) errors.push('Time window must end after it starts.');
    if (this.minRating < 0 || this.minRating > 5) errors.push('Minimum rating must be between 0 and 5.');
    return errors;
  }
}
