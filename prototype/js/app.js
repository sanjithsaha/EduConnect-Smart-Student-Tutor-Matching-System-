/** EduConnect prototype - UI controller (wires the model classes to the DOM). */
'use strict';

(function () {
  const { subjects, students, tutors, seedBookings } = EduConnectData.build();
  const storage = (() => { try { return window.localStorage; } catch (e) { return null; } })();
  const manager = new BookingManager(tutors, { storage, seed: seedBookings });
  const matcher = new TutorMatcher();

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const WORKDAYS = DAYS.filter((d) => d !== 'Fri');
  const WEIGHT_LABELS = { subject: 'Subject expertise', availability: 'Availability', budget: 'Budget', rating: 'Rating', mode: 'Teaching mode', experience: 'Experience' };

  const state = { studentId: students[0].id, requirement: null, results: [], pending: null };
  const currentStudent = () => students.find((s) => s.id === state.studentId);
  const subjectById = (id) => subjects.find((s) => s.id === id);
  const tutorById = (id) => tutors.find((t) => t.id === id);

  // ---------- setup ----------
  function initForm() {
    $('studentSelect').innerHTML = students.map((s) => `<option value="${s.id}">${esc(s.name)} (${esc(s.department)}, ${esc(s.academicLevel)})</option>`).join('');
    $('subject').innerHTML = '<option value="">Select a subject...</option>' + subjects.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
    $('dayBoxes').innerHTML = WORKDAYS.map((d) => `<label class="chk"><input type="checkbox" name="day" value="${d}"> ${d}</label>`).join('');
    $('weightBoxes').innerHTML = Object.keys(matcher.weights).map((k) =>
      `<label>${WEIGHT_LABELS[k]} <output id="w-${k}-out">${matcher.weights[k]}</output>
        <input type="range" min="0" max="50" value="${matcher.weights[k]}" data-weight="${k}"></label>`).join('');
  }

  function readRequirement() {
    return currentStudent().createRequirement({
      subjectId: $('subject').value,
      maxBudget: $('budget').value,
      mode: $('mode').value,
      minRating: $('minRating').value,
      windowStart: $('winStart').value,
      windowEnd: $('winEnd').value,
      days: [...document.querySelectorAll('input[name="day"]:checked')].map((c) => c.value),
    });
  }

  // ---------- rendering ----------
  function toast(message, isError = false) {
    const t = $('toast');
    t.textContent = message;
    t.className = `toast ${isError ? 'toast-err' : 'toast-ok'}`;
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { t.hidden = true; }, 4500);
  }

  function slotChip(slot, tutor, matching) {
    if (slot.isBooked) return `<span class="slot booked" title="Already booked">${esc(slot.label)} - booked</span>`;
    const cls = matching.has(slot.id) ? 'slot free match' : 'slot free';
    return `<button type="button" class="${cls}" data-tutor="${tutor.id}" data-slot="${slot.id}" title="${matching.has(slot.id) ? 'Fits your requested time' : 'Free slot'}">${esc(slot.label)}</button>`;
  }

  function renderResults() {
    const { results, requirement } = state;
    if (!requirement) return;
    const subj = subjectById(requirement.subjectId);
    $('resMeta').textContent = results.length
      ? `${results.length} verified tutor(s) teach ${subj.name}. Highlighted slots fit your requested days and time window.`
      : `No verified tutor teaches ${subj.name} in the sample data.`;
    $('results').innerHTML = results.map((r, i) => {
      const t = r.tutor;
      const matching = new Set(r.matchingSlots.map((s) => s.id));
      const rows = r.breakdown.map((c) => `<tr><td>${esc(c.label)}</td><td>${((100 * c.weight) / Object.values(matcher.weights).reduce((a, b) => a + b, 0)).toFixed(0)}%</td><td>${(c.value * 100).toFixed(0)}%</td><td>${c.points.toFixed(1)}</td></tr>`).join('');
      return `<article class="tutor">
        <div class="tutor-head">
          <div class="rank">#${i + 1}</div>
          <div class="tutor-info"><h3>${esc(t.name)}</h3>
            <p class="muted">${esc(t.bio)}</p>
            <p class="meta"><span>${t.hourlyRate} BDT/h</span><span>&#9733; ${t.rating.toFixed(1)}</span><span>${esc(t.teachingMode)}</span><span>${t.experienceYears} yr exp.</span><span>${esc(subj.name)}: ${t.getProficiency(subj.id)}/5</span></p></div>
          <div class="score" aria-label="Compatibility score ${r.score.toFixed(0)} out of 100"><strong>${r.score.toFixed(0)}</strong><small>/100</small></div>
        </div>
        <div class="bar" aria-hidden="true"><span style="width:${r.score.toFixed(1)}%"></span></div>
        <p class="summary">${esc(r.summary)}</p>
        <details><summary>Why this score?</summary>
          <div class="table-wrap"><table><thead><tr><th>Factor</th><th>Weight</th><th>Fit</th><th>Points</th></tr></thead><tbody>${rows}</tbody></table></div>
          <ul class="explain">${r.explanation.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>
        </details>
        <div class="slots"><span class="muted">Availability:</span> ${t.slots.map((s) => slotChip(s, t, matching)).join('')}</div>
      </article>`;
    }).join('');
  }

  const STATUS_CLASS = { Pending: 'st-pending', Confirmed: 'st-confirmed', Completed: 'st-completed', Cancelled: 'st-cancelled' };

  function renderBookings() {
    const list = manager.getByStudent(state.studentId);
    if (!list.length) { $('bookings').innerHTML = '<p class="muted">No bookings yet for this student.</p>'; return; }
    $('bookings').innerHTML = `<div class="table-wrap"><table class="bk"><thead><tr><th>ID</th><th>Tutor</th><th>Subject</th><th>Slot</th><th>Status</th><th>Actions</th></tr></thead><tbody>${list.map((b) => {
      const t = tutorById(b.tutorId); const s = manager.findSlot(b.slotId);
      const btn = (to, label, cls = '') => `<button type="button" class="btn small ${cls}" data-bk="${b.id}" data-to="${to}">${label}</button>`;
      let actions = '';
      if (b.status === BookingStatus.PENDING) actions = btn(BookingStatus.CONFIRMED, 'Tutor accepts') + btn(BookingStatus.CANCELLED, 'Cancel', 'danger');
      else if (b.status === BookingStatus.CONFIRMED) actions = btn(BookingStatus.COMPLETED, 'Mark completed') + btn(BookingStatus.CANCELLED, 'Cancel', 'danger');
      else actions = '<span class="muted">-</span>';
      return `<tr><td>${b.id}</td><td>${esc(t.name)}</td><td>${esc(subjectById(b.subjectId).name)}</td><td>${esc(s.label)}</td><td><span class="status ${STATUS_CLASS[b.status]}">${b.status}</span></td><td class="act">${actions}</td></tr>`;
    }).join('')}</tbody></table></div>`;
  }

  function refresh() { renderResults(); renderBookings(); }

  // ---------- behaviour ----------
  function runMatch(event) {
    if (event) event.preventDefault();
    const req = readRequirement();
    const errors = req.validate();
    const box = $('formErrors');
    box.hidden = !errors.length;
    box.innerHTML = errors.map((e) => `<div>${esc(e)}</div>`).join('');
    if (errors.length) return;
    state.requirement = req;
    state.results = matcher.match(req, tutors);
    renderResults();
    $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function loadDemo() {
    $('studentSelect').value = 'S001'; state.studentId = 'S001';
    $('subject').value = 'SUB02'; $('budget').value = 650; $('mode').value = 'Online'; $('minRating').value = '4';
    $('winStart').value = '18:00'; $('winEnd').value = '20:00';
    document.querySelectorAll('input[name="day"]').forEach((c) => { c.checked = ['Sat', 'Mon'].includes(c.value); });
    runMatch();
    renderBookings();
  }

  function openDialog(tutorId, slotId) {
    const tutor = tutorById(tutorId); const slot = manager.findSlot(slotId); const subject = subjectById(state.requirement.subjectId);
    state.pending = { tutor, slot, subject };
    $('dlgBody').innerHTML = `<strong>${esc(currentStudent().name)}</strong> requests <strong>${esc(subject.name)}</strong> with <strong>${esc(tutor.name)}</strong><br>${esc(slot.label)} &middot; ${tutor.hourlyRate} BDT/h &middot; ${esc(tutor.teachingMode)}`;
    $('bookDialog').returnValue = '';
    $('bookDialog').showModal();
  }

  function confirmBooking() {
    const { tutor, slot, subject } = state.pending;
    const res = manager.createBooking({ student: currentStudent(), tutor, slot, subject });
    if (res.ok) toast(`Booking ${res.booking.id} created (Pending). The tutor must accept it.`);
    else toast(`Booking rejected: ${res.error}`, true);
    refresh();
  }

  function bind() {
    $('reqForm').addEventListener('submit', runMatch);
    $('demoBtn').addEventListener('click', loadDemo);
    $('studentSelect').addEventListener('change', (e) => { state.studentId = e.target.value; refresh(); });
    $('weightBoxes').addEventListener('input', (e) => {
      const key = e.target.dataset.weight; if (!key) return;
      $(`w-${key}-out`).textContent = e.target.value;
      const next = {}; document.querySelectorAll('[data-weight]').forEach((r) => { next[r.dataset.weight] = Number(r.value); });
      try { matcher.setWeights(next); $('formErrors').hidden = true; if (state.requirement) { state.results = matcher.match(state.requirement, tutors); renderResults(); } }
      catch (err) { $('formErrors').hidden = false; $('formErrors').textContent = err.message; }
    });
    $('results').addEventListener('click', (e) => { const b = e.target.closest('button[data-slot]'); if (b) openDialog(b.dataset.tutor, b.dataset.slot); });
    $('bookDialog').addEventListener('close', () => { if ($('bookDialog').returnValue === 'confirm') confirmBooking(); });
    $('bookings').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-bk]'); if (!b) return;
      const res = manager.updateStatus(b.dataset.bk, b.dataset.to);
      toast(res.ok ? `Booking ${b.dataset.bk} is now ${b.dataset.to}.` : res.error, !res.ok);
      refresh();
    });
    $('resetBtn').addEventListener('click', () => { manager.reset(); refresh(); toast('Demo data reset.'); });
  }

  initForm();
  bind();
  renderBookings();
})();
