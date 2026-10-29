/**
 * EduConnect prototype - weighted tutor matching.
 *
 * Score(tutor) = 100 * sum(w_i * c_i) / sum(w_i)
 * where each component c_i is in [0, 1]. A tutor must teach the requested
 * subject to be considered (hard filter); everything else is a soft score.
 */
'use strict';

class MatchResult {
  constructor({ tutor, score, breakdown, explanation, matchingSlots }) {
    this.tutor = tutor;
    this.score = score; // 0..100
    this.breakdown = breakdown; // [{key, label, weight, value, points, detail}]
    this.explanation = explanation; // string[]
    this.matchingSlots = matchingSlots; // free slots that satisfy the requested days/time
  }
  /** One-sentence summary naming the strongest and weakest factors. */
  get summary() {
    const ranked = [...this.breakdown].sort((a, b) => b.value - a.value);
    const best = ranked.slice(0, 2).map((b) => b.label.toLowerCase());
    const worst = ranked[ranked.length - 1];
    const weak = worst.value < 0.5 ? ` Weakest factor: ${worst.label.toLowerCase()}.` : '';
    return `Strongest on ${best.join(' and ')}.${weak}`;
  }
}

class TutorMatcher {
  constructor(weights = TutorMatcher.DEFAULT_WEIGHTS) {
    this.weights = { ...weights };
  }

  setWeights(weights) {
    const next = { ...this.weights, ...weights };
    const total = Object.values(next).reduce((a, b) => a + b, 0);
    if (!(total > 0)) throw new Error('At least one weight must be greater than zero.');
    this.weights = next;
  }

  /** Returns MatchResult[] sorted from best to worst. */
  match(requirement, tutors) {
    const candidates = tutors.filter((t) => t.isVerified && t.teaches(requirement.subjectId));
    const totalWeight = Object.values(this.weights).reduce((a, b) => a + b, 0);

    const results = candidates.map((tutor) => {
      const avail = this.scoreAvailability(tutor, requirement);
      const components = [
        { key: 'subject', label: 'Subject expertise', value: this.scoreSubject(tutor, requirement),
          detail: `proficiency ${tutor.getProficiency(requirement.subjectId)}/5` },
        { key: 'availability', label: 'Availability fit', value: avail.value, detail: avail.detail },
        { key: 'budget', label: 'Budget fit', value: this.scoreBudget(tutor, requirement),
          detail: `${tutor.hourlyRate} BDT/h vs budget ${requirement.maxBudget}` },
        { key: 'rating', label: 'Rating', value: this.scoreRating(tutor, requirement),
          detail: `${tutor.rating.toFixed(1)}/5` + (tutor.rating < requirement.minRating ? ` (below your minimum of ${requirement.minRating})` : '') },
        { key: 'mode', label: 'Teaching mode', value: this.scoreMode(tutor, requirement),
          detail: `tutor: ${tutor.teachingMode}, you: ${requirement.mode}` },
        { key: 'experience', label: 'Experience', value: this.scoreExperience(tutor),
          detail: `${tutor.experienceYears} yr` },
      ].map((c) => {
        const weight = this.weights[c.key];
        return { ...c, weight, points: (100 * weight * c.value) / totalWeight };
      });

      const score = components.reduce((sum, c) => sum + c.points, 0);
      const explanation = components.map(
        (c) => `${c.label}: ${c.detail} -> ${(c.value * 100).toFixed(0)}% x weight ${((100 * c.weight) / totalWeight).toFixed(0)}% = ${c.points.toFixed(1)} pts`
      );
      return new MatchResult({ tutor, score, breakdown: components, explanation, matchingSlots: avail.slots });
    });

    return results.sort((a, b) => b.score - a.score || b.tutor.rating - a.tutor.rating || a.tutor.hourlyRate - b.tutor.hourlyRate);
  }

  scoreSubject(tutor, req) {
    return tutor.getProficiency(req.subjectId) / 5;
  }

  /**
   * With a time window: best overlap (free slot on a requested day) divided by the
   * window length. Without one: min(1, free slots on requested days / 3).
   */
  scoreAvailability(tutor, req) {
    const free = tutor.getFreeSlots().filter((s) => !req.days.length || req.days.includes(s.day));
    if (!free.length) return { value: 0, slots: [], detail: 'no free slot on the requested days' };

    if (req.hasWindow()) {
      const windowLen = Number(toMinutes(req.windowEnd) - toMinutes(req.windowStart));
      let best = 0;
      const slots = [];
      free.forEach((s) => {
        const overlap = s.overlapMinutes(req.windowStart, req.windowEnd);
        if (overlap > 0) {
          slots.push(s);
          best = Math.max(best, overlap / windowLen);
        }
      });
      const detail = slots.length ? `${slots.length} free slot(s) cover ${(best * 100).toFixed(0)}% of your window` : 'no free slot inside your time window';
      return { value: best, slots, detail };
    }
    return { value: Math.min(1, free.length / 3), slots: free, detail: `${free.length} free slot(s) on requested days` };
  }

  /** Within budget: 0.7-1.0 (cheaper is slightly better). Over budget: decays from 0.7 to 0. */
  scoreBudget(tutor, req) {
    const { hourlyRate: rate } = tutor;
    const max = req.maxBudget;
    if (rate <= max) return 1 - 0.3 * (rate / max);
    return Math.max(0, 0.7 - (rate - max) / max);
  }

  scoreRating(tutor, req) {
    const base = tutor.rating / 5;
    return tutor.rating < req.minRating ? base * 0.5 : base;
  }

  scoreMode(tutor, req) {
    if (req.mode === 'Any' || tutor.teachingMode === 'Both' || tutor.teachingMode === req.mode) return 1;
    return 0;
  }

  scoreExperience(tutor) {
    return Math.min(tutor.experienceYears / 5, 1);
  }
}

TutorMatcher.DEFAULT_WEIGHTS = Object.freeze({
  subject: 30,
  availability: 25,
  budget: 15,
  rating: 15,
  mode: 10,
  experience: 5,
});
