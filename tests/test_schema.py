"""Checks database/schema.sql with SQLite: loads cleanly and blocks double booking.
Run: python3 tests/test_schema.py"""
import pathlib, sqlite3, sys

sql = (pathlib.Path(__file__).parent.parent / "database" / "schema.sql").read_text()
db = sqlite3.connect(":memory:")
db.executescript(sql)
q = db.execute
q("INSERT INTO users(user_id,full_name,email,password_hash,role) VALUES (1,'S','s@x.edu','h','student'),(2,'T','t@x.edu','h','tutor'),(3,'S2','s2@x.edu','h','student')")
q("INSERT INTO students(student_id,user_id) VALUES (1,1),(2,3)")
q("INSERT INTO tutors(tutor_id,user_id,hourly_rate,teaching_mode) VALUES (1,2,600,'online')")
q("INSERT INTO subjects(subject_id,name) VALUES (1,'Data Structures')")
q("INSERT INTO tutor_subjects VALUES (1,1,5)")
q("INSERT INTO availability_slots(slot_id,tutor_id,day_of_week,start_time,end_time) VALUES (1,1,'Sat','18:00','20:00')")
results = []

def expect(name, fn, should_fail):
    try:
        fn(); ok = not should_fail
    except sqlite3.IntegrityError:
        ok = should_fail
    results.append(ok); print(("PASS  " if ok else "FAIL  ") + name)

ins = "INSERT INTO bookings(student_id,tutor_id,slot_id,subject_id,status) VALUES (?,1,1,1,?)"
expect("first active booking is accepted", lambda: q(ins, (1, "pending")), False)
expect("second active booking for the same slot is rejected", lambda: q(ins, (2, "confirmed")), True)
q("UPDATE bookings SET status='cancelled' WHERE booking_id=1")
expect("slot can be re-booked after cancellation", lambda: q(ins, (2, "pending")), False)
expect("invalid status is rejected", lambda: q("INSERT INTO bookings(student_id,tutor_id,slot_id,subject_id,status) VALUES (1,1,1,1,'bogus')"), True)
expect("slot with end before start is rejected", lambda: q("INSERT INTO availability_slots(tutor_id,day_of_week,start_time,end_time) VALUES (1,'Sun','20:00','18:00')"), True)
print(f"\n{sum(results)}/{len(results)} schema checks passed")
sys.exit(0 if all(results) else 1)
