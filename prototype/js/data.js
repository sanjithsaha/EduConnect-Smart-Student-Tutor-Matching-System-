/**
 * EduConnect prototype - synthetic sample data (all names, ratings and rates
 * are fictional and for demonstration only). Rates are BDT per hour.
 */
'use strict';

const EduConnectData = {
  build() {
    const subjects = [
      ['SUB01', 'Calculus I', 'Mathematics'],
      ['SUB02', 'Data Structures', 'Computer Science'],
      ['SUB03', 'Object-Oriented Programming', 'Computer Science'],
      ['SUB04', 'Database Systems', 'Computer Science'],
      ['SUB05', 'Digital Logic Design', 'Electronics'],
      ['SUB06', 'Physics I', 'Physics'],
      ['SUB07', 'Discrete Mathematics', 'Mathematics'],
      ['SUB08', 'English Composition', 'Language'],
    ].map(([id, name, category]) => new Subject({ id, name, category }));

    const students = [
      new Student({ id: 'S001', name: 'Nusrat Jahan', email: 'nusrat@example.edu', department: 'CSE', academicLevel: 'Year 2' }),
      new Student({ id: 'S002', name: 'Tanvir Hossain', email: 'tanvir@example.edu', department: 'EEE', academicLevel: 'Year 1' }),
    ];

    // [id, name, bio, rate, experienceYears, rating, mode, {subjectId: proficiency}, [[day, start, end], ...]]
    const tutorRows = [
      ['T001', 'Rahim Uddin', 'CSE graduate; competitive programming mentor.', 600, 3, 4.8, 'Online',
        { SUB02: 5, SUB03: 5, SUB04: 4 }, [['Sat', '18:00', '20:00'], ['Mon', '18:00', '20:00'], ['Wed', '19:00', '21:00']]],
      ['T002', 'Farzana Akter', 'Mathematics honours; patient step-by-step teaching.', 450, 2, 4.6, 'Both',
        { SUB02: 4, SUB07: 5, SUB01: 4 }, [['Sun', '16:00', '18:00'], ['Tue', '16:00', '18:00'], ['Thu', '17:00', '19:00']]],
      ['T003', 'Mahmudul Hasan', 'Physics lecturer with exam-oriented problem practice.', 800, 6, 4.9, 'In-person',
        { SUB01: 5, SUB06: 5, SUB07: 4 }, [['Sat', '10:00', '12:00'], ['Mon', '10:00', '12:00'], ['Wed', '15:00', '17:00']]],
      ['T004', 'Sabrina Islam', 'English and programming fundamentals tutor.', 350, 1, 4.2, 'Online',
        { SUB03: 4, SUB04: 3, SUB08: 5 }, [['Sun', '19:00', '21:00'], ['Tue', '19:00', '21:00'], ['Thu', '20:00', '22:00']]],
      ['T005', 'Arif Chowdhury', 'EEE graduate; circuits and digital design.', 500, 4, 4.5, 'Both',
        { SUB05: 5, SUB06: 4, SUB01: 3 }, [['Sat', '16:00', '18:00'], ['Mon', '16:00', '18:00'], ['Wed', '17:00', '19:00']]],
      ['T006', 'Tasnim Karim', 'Database and algorithms teaching assistant.', 700, 5, 4.7, 'Both',
        { SUB04: 5, SUB02: 4, SUB07: 3 }, [['Sun', '18:00', '20:00'], ['Tue', '18:00', '20:00'], ['Thu', '18:00', '20:00']]],
      ['T007', 'Imran Sarker', 'Undergraduate helper for first-year science courses.', 300, 1, 4.0, 'In-person',
        { SUB06: 3, SUB01: 3, SUB05: 3 }, [['Sat', '09:00', '11:00'], ['Sun', '09:00', '11:00'], ['Tue', '10:00', '12:00']]],
      ['T008', 'Shirin Sultana', 'Academic writing coach and discrete maths tutor.', 550, 3, 4.4, 'Online',
        { SUB08: 5, SUB07: 3 }, [['Mon', '17:00', '19:00'], ['Wed', '18:00', '20:00'], ['Thu', '16:00', '18:00']]],
    ];

    let slotCounter = 0;
    const tutors = tutorRows.map(([id, name, bio, hourlyRate, experienceYears, rating, teachingMode, subj, slots]) => {
      const tutor = new Tutor({
        id, name, bio, hourlyRate, experienceYears, rating, teachingMode,
        email: `${name.split(' ')[0].toLowerCase()}@example.edu`,
      });
      Object.entries(subj).forEach(([sid, level]) => tutor.addSubject(sid, level));
      slots.forEach(([day, start, end]) => {
        slotCounter += 1;
        tutor.addSlot(new AvailabilitySlot({ id: `SL${String(slotCounter).padStart(3, '0')}`, tutorId: id, day, start, end }));
      });
      return tutor;
    });

    // Pre-existing booking so the status display and conflict check have something to show.
    const seedBookings = [
      { id: 'B001', studentId: 'S002', tutorId: 'T002', slotId: 'SL004', subjectId: 'SUB07', status: BookingStatus.CONFIRMED, createdAt: '2026-10-20T09:30:00' },
    ];

    return { subjects, students, tutors, seedBookings };
  },
};
