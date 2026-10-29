/**
 * EduConnect prototype - bookings and conflict prevention.
 * Mirrors Booking and BookingManager in diagrams/source/class.puml.
 *
 * Slots are modelled as recurring weekly slots (no calendar dates in the prototype).
 * PENDING and CONFIRMED bookings occupy a slot; COMPLETED and CANCELLED release it.
 */
'use strict';

class Booking {
  constructor({ id, studentId, tutorId, slotId, subjectId, status = BookingStatus.PENDING, createdAt = new Date().toISOString() }) {
    this.id = id;
    this.studentId = studentId;
    this.tutorId = tutorId;
    this.slotId = slotId;
    this.subjectId = subjectId;
    this.status = status;
    this.createdAt = createdAt;
  }
  get isActive() {
    return this.status === BookingStatus.PENDING || this.status === BookingStatus.CONFIRMED;
  }
  /** Allowed: Pending -> Confirmed | Cancelled; Confirmed -> Completed | Cancelled. */
  transitionTo(next) {
    const allowed = {
      [BookingStatus.PENDING]: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
      [BookingStatus.CONFIRMED]: [BookingStatus.COMPLETED, BookingStatus.CANCELLED],
      [BookingStatus.COMPLETED]: [],
      [BookingStatus.CANCELLED]: [],
    };
    if (!allowed[this.status].includes(next)) {
      throw new Error(`Cannot change a ${this.status} booking to ${next}.`);
    }
    this.status = next;
  }
}

class BookingManager {
  /**
   * @param {Tutor[]} tutors  tutors whose slots are managed
   * @param {object} [options] { storage, storageKey, seed }
   */
  constructor(tutors, { storage = null, storageKey = 'educonnect.bookings.v1', seed = [] } = {}) {
    this.tutors = tutors;
    this.storage = storage;
    this.storageKey = storageKey;
    this.bookings = [];
    this.seed = seed;
    this.load();
  }

  findTutor(id) {
    return this.tutors.find((t) => t.id === id);
  }
  findSlot(slotId) {
    for (const t of this.tutors) {
      const s = t.slots.find((x) => x.id === slotId);
      if (s) return s;
    }
    return undefined;
  }

  /** Describes the first conflict found, or returns null when the booking is allowed. */
  findConflict(studentId, tutor, slot) {
    if (!tutor || !slot || slot.tutorId !== tutor.id) return 'Selected slot does not belong to this tutor.';
    if (slot.isBooked) return 'This slot has just been taken by another booking.';
    for (const b of this.bookings.filter((x) => x.isActive)) {
      const other = this.findSlot(b.slotId);
      if (!other || !other.overlapsSlot(slot)) continue;
      if (b.tutorId === tutor.id) return `Tutor already has a booking that overlaps ${slot.label}.`;
      if (b.studentId === studentId) return `You already have a booking (${b.id}) that overlaps ${slot.label}.`;
    }
    return null;
  }

  /** @returns {{ok: boolean, booking?: Booking, error?: string}} */
  createBooking({ student, tutor, slot, subject }) {
    if (!tutor.teaches(subject.id)) return { ok: false, error: `${tutor.name} does not teach ${subject.name}.` };
    const conflict = this.findConflict(student.id, tutor, slot);
    if (conflict) return { ok: false, error: conflict };
    slot.book();
    const booking = new Booking({
      id: this.nextId(), studentId: student.id, tutorId: tutor.id, slotId: slot.id, subjectId: subject.id,
    });
    this.bookings.push(booking);
    this.save();
    return { ok: true, booking };
  }

  /** @returns {{ok: boolean, booking?: Booking, error?: string}} */
  updateStatus(bookingId, status) {
    const booking = this.bookings.find((b) => b.id === bookingId);
    if (!booking) return { ok: false, error: 'Booking not found.' };
    try {
      booking.transitionTo(status);
    } catch (err) {
      return { ok: false, error: err.message };
    }
    if (!booking.isActive) {
      const slot = this.findSlot(booking.slotId);
      if (slot) slot.release();
    }
    this.save();
    return { ok: true, booking };
  }

  getByStudent(studentId) {
    return this.bookings.filter((b) => b.studentId === studentId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  nextId() {
    const max = this.bookings.reduce((m, b) => Math.max(m, Number(b.id.slice(1))), 0);
    return `B${String(max + 1).padStart(3, '0')}`;
  }

  reset() {
    this.tutors.forEach((t) => t.slots.forEach((s) => s.release()));
    this.bookings = [];
    if (this.storage) this.storage.removeItem(this.storageKey);
    this.applyRecords(this.seed);
    this.save();
  }

  // ---- persistence (localStorage in the browser, injectable for tests) ----
  load() {
    let records = null;
    try {
      const raw = this.storage && this.storage.getItem(this.storageKey);
      if (raw) records = JSON.parse(raw);
    } catch (err) {
      records = null; // corrupted storage -> fall back to seed data
    }
    this.applyRecords(records || this.seed);
  }

  applyRecords(records) {
    this.bookings = records.map((r) => new Booking(r));
    this.bookings.filter((b) => b.isActive).forEach((b) => {
      const slot = this.findSlot(b.slotId);
      if (slot) slot.isBooked = true;
    });
  }

  save() {
    try {
      if (this.storage) this.storage.setItem(this.storageKey, JSON.stringify(this.bookings));
    } catch (err) {
      /* storage full or blocked: the prototype keeps working in memory */
    }
  }
}
