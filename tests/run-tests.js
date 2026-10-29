/**
 * Dependency-free unit tests for the prototype logic.
 * Run:  node tests/run-tests.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const dir = path.join(__dirname, '..', 'prototype', 'js');
const src = ['models.js', 'data.js', 'matcher.js', 'bookingManager.js']
  .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'))
  .join('\n');
const lib = new Function(
  `${src}\nreturn { BookingStatus, Student, Tutor, Subject, AvailabilitySlot, StudentRequirement, TutorMatcher, Booking, BookingManager, EduConnectData };`
)();
const { BookingStatus, StudentRequirement, TutorMatcher, BookingManager, EduConnectData } = lib;

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
function fresh(storage = memoryStorage()) {
  const data = EduConnectData.build();
  const manager = new BookingManager(data.tutors, { storage, seed: data.seedBookings });
  const by = (arr, id) => arr.find((x) => x.id === id);
  return { ...data, manager, storage, student: (id) => by(data.students, id), tutor: (id) => by(data.tutors, id), subject: (id) => by(data.subjects, id), slot: (id) => manager.findSlot(id) };
}
const nusratReq = (over = {}) =>
  new StudentRequirement({ studentId: 'S001', subjectId: 'SUB02', maxBudget: 650, mode: 'Online', days: ['Sat', 'Mon'], windowStart: '18:00', windowEnd: '20:00', minRating: 4, ...over });

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

// ---- models ----
test('slot overlap minutes and same-day overlap', () => {
  const { slot } = fresh();
  assert.strictEqual(slot('SL001').durationMinutes, 120);
  assert.strictEqual(slot('SL001').overlapMinutes('19:00', '21:00'), 60);
  assert.strictEqual(slot('SL001').overlapMinutes('20:00', '21:00'), 0);
  assert.ok(!slot('SL001').overlapsSlot(slot('SL002'))); // Sat vs Mon
});
test('requirement validation catches bad input', () => {
  assert.deepStrictEqual(nusratReq().validate(), []);
  assert.ok(nusratReq({ subjectId: '' }).validate().length);
  assert.ok(nusratReq({ maxBudget: -5 }).validate().length);
  assert.ok(nusratReq({ windowStart: '20:00', windowEnd: '18:00' }).validate().length);
  assert.ok(nusratReq({ windowEnd: '' }).validate().length);
});

// ---- matcher ----
test('only tutors who teach the subject are ranked', () => {
  const { tutors } = fresh();
  const res = new TutorMatcher().match(nusratReq(), tutors);
  assert.ok(res.length > 0);
  res.forEach((r) => assert.ok(r.tutor.teaches('SUB02')));
  assert.deepStrictEqual(res.map((r) => r.tutor.id).sort(), ['T001', 'T002', 'T006']);
});
test('scores are within 0..100 and sorted descending', () => {
  const res = new TutorMatcher().match(nusratReq(), fresh().tutors);
  res.forEach((r) => assert.ok(r.score >= 0 && r.score <= 100));
  for (let i = 1; i < res.length; i += 1) assert.ok(res[i - 1].score >= res[i].score);
});
test('best match for the demo requirement is Rahim Uddin (T001)', () => {
  const res = new TutorMatcher().match(nusratReq(), fresh().tutors);
  assert.strictEqual(res[0].tutor.id, 'T001');
  assert.strictEqual(res[0].breakdown.length, 6);
  assert.strictEqual(res[0].explanation.length, 6);
});
test('breakdown points add up to the total score', () => {
  const r = new TutorMatcher().match(nusratReq(), fresh().tutors)[0];
  assert.ok(Math.abs(r.breakdown.reduce((s, c) => s + c.points, 0) - r.score) < 1e-9);
});
test('availability is 0 when no free slot on requested days', () => {
  const t = fresh().tutor('T006'); // Sun/Tue/Thu only
  assert.strictEqual(new TutorMatcher().scoreAvailability(t, nusratReq()).value, 0);
});
test('budget score falls once the rate exceeds the budget', () => {
  const m = new TutorMatcher();
  const t = fresh().tutor('T006'); // 700 BDT/h
  assert.ok(m.scoreBudget(t, nusratReq({ maxBudget: 800 })) > m.scoreBudget(t, nusratReq({ maxBudget: 500 })));
  assert.ok(m.scoreBudget(t, nusratReq({ maxBudget: 100 })) >= 0);
});
test('mode mismatch scores 0, Both scores 1', () => {
  const m = new TutorMatcher();
  const { tutor } = fresh();
  assert.strictEqual(m.scoreMode(tutor('T003'), nusratReq({ mode: 'Online' })), 0); // in-person only
  assert.strictEqual(m.scoreMode(tutor('T002'), nusratReq({ mode: 'Online' })), 1); // both
});
test('custom weights change the ranking and reject all-zero weights', () => {
  const tutors = fresh().tutors;
  const m = new TutorMatcher();
  m.setWeights({ subject: 0, availability: 0, budget: 100, rating: 0, mode: 0, experience: 0 });
  const res = m.match(nusratReq({ days: [], windowStart: '', windowEnd: '' }), tutors);
  assert.strictEqual(res[0].tutor.id, 'T002'); // cheapest teacher of Data Structures
  assert.throws(() => new TutorMatcher().setWeights({ subject: 0, availability: 0, budget: 0, rating: 0, mode: 0, experience: 0 }));
});

// ---- bookings ----
test('successful booking marks the slot booked and starts as Pending', () => {
  const f = fresh();
  const r = f.manager.createBooking({ student: f.student('S001'), tutor: f.tutor('T001'), slot: f.slot('SL001'), subject: f.subject('SUB02') });
  assert.ok(r.ok);
  assert.strictEqual(r.booking.status, BookingStatus.PENDING);
  assert.ok(f.slot('SL001').isBooked);
});
test('a second student cannot book an already-booked slot', () => {
  const f = fresh();
  f.manager.createBooking({ student: f.student('S001'), tutor: f.tutor('T001'), slot: f.slot('SL001'), subject: f.subject('SUB02') });
  const r = f.manager.createBooking({ student: f.student('S002'), tutor: f.tutor('T001'), slot: f.slot('SL001'), subject: f.subject('SUB02') });
  assert.ok(!r.ok);
  assert.match(r.error, /taken/);
});
test('seeded booking blocks its slot', () => {
  const f = fresh();
  assert.ok(f.slot('SL004').isBooked);
  const r = f.manager.createBooking({ student: f.student('S001'), tutor: f.tutor('T002'), slot: f.slot('SL004'), subject: f.subject('SUB07') });
  assert.ok(!r.ok);
});
test('a student cannot hold two overlapping bookings', () => {
  const f = fresh();
  // T005 Mon 16:00-18:00 (SL014) vs T008 Mon 17:00-19:00 (SL022)
  assert.ok(f.manager.createBooking({ student: f.student('S001'), tutor: f.tutor('T005'), slot: f.slot('SL014'), subject: f.subject('SUB05') }).ok);
  const r = f.manager.createBooking({ student: f.student('S001'), tutor: f.tutor('T008'), slot: f.slot('SL022'), subject: f.subject('SUB08') });
  assert.ok(!r.ok);
  assert.match(r.error, /overlaps/);
});
test('a tutor not teaching the subject is rejected', () => {
  const f = fresh();
  const r = f.manager.createBooking({ student: f.student('S001'), tutor: f.tutor('T003'), slot: f.slot('SL007'), subject: f.subject('SUB02') });
  assert.ok(!r.ok);
});
test('cancelling releases the slot so it can be re-booked', () => {
  const f = fresh();
  const b = f.manager.createBooking({ student: f.student('S001'), tutor: f.tutor('T001'), slot: f.slot('SL001'), subject: f.subject('SUB02') }).booking;
  assert.ok(f.manager.updateStatus(b.id, BookingStatus.CANCELLED).ok);
  assert.ok(!f.slot('SL001').isBooked);
  assert.ok(f.manager.createBooking({ student: f.student('S002'), tutor: f.tutor('T001'), slot: f.slot('SL001'), subject: f.subject('SUB02') }).ok);
});
test('status lifecycle: Pending -> Confirmed -> Completed; illegal jumps rejected', () => {
  const f = fresh();
  const b = f.manager.createBooking({ student: f.student('S001'), tutor: f.tutor('T001'), slot: f.slot('SL001'), subject: f.subject('SUB02') }).booking;
  assert.ok(!f.manager.updateStatus(b.id, BookingStatus.COMPLETED).ok);
  assert.ok(f.manager.updateStatus(b.id, BookingStatus.CONFIRMED).ok);
  assert.ok(f.manager.updateStatus(b.id, BookingStatus.COMPLETED).ok);
  assert.ok(!f.manager.updateStatus(b.id, BookingStatus.CANCELLED).ok);
  assert.ok(!f.manager.updateStatus('B999', BookingStatus.CONFIRMED).ok);
});
test('bookings persist across a reload and re-block their slots', () => {
  const storage = memoryStorage();
  const a = fresh(storage);
  a.manager.createBooking({ student: a.student('S001'), tutor: a.tutor('T001'), slot: a.slot('SL001'), subject: a.subject('SUB02') });
  const b = fresh(storage);
  assert.strictEqual(b.manager.getByStudent('S001').length, 1);
  assert.ok(b.slot('SL001').isBooked);
});
test('reset restores seed data', () => {
  const f = fresh();
  f.manager.createBooking({ student: f.student('S001'), tutor: f.tutor('T001'), slot: f.slot('SL001'), subject: f.subject('SUB02') });
  f.manager.reset();
  assert.strictEqual(f.manager.bookings.length, 1);
  assert.ok(!f.slot('SL001').isBooked);
  assert.ok(f.slot('SL004').isBooked);
});

let failed = 0;
tests.forEach(([name, fn]) => {
  try {
    fn();
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`  FAIL  ${name}\n        ${err.message}`);
  }
});
console.log(`\n${tests.length - failed}/${tests.length} tests passed`);
process.exit(failed ? 1 : 0);
