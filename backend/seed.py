from sqlalchemy.orm import Session
from database import engine, SessionLocal, Base
import models
import auth
import analytics
import datetime

def seed_database():
    print("Resetting database...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # Create core staff users
        admin_pass = auth.get_password_hash("admin123")
        teacher_pass = auth.get_password_hash("teacher123")
        advisor_pass = auth.get_password_hash("advisor123")

        teacher_user = models.User(name="Teacher User 1", email="teacher@dashboard.com", hashed_password=teacher_pass, role="Teacher")
        teacher_user2 = models.User(name="Teacher User 2", email="teacher2@dashboard.com", hashed_password=teacher_pass, role="Teacher")
        advisor_user = models.User(name="Academic Advisor User", email="advisor@dashboard.com", hashed_password=advisor_pass, role="AcademicAdvisor")
        admin_user = models.User(name="Admin User", email="admin@dashboard.com", hashed_password=admin_pass, role="Admin")

        db.add_all([admin_user, teacher_user, teacher_user2, advisor_user])
        db.commit()
        db.refresh(teacher_user)
        db.refresh(teacher_user2)

        # Create subjects for Semester 3
        subjects_data = [
            {"name": "Mathematics", "semester": 3, "teacher_id": teacher_user.id},
            {"name": "Physics", "semester": 3, "teacher_id": teacher_user.id},
            {"name": "English", "semester": 3, "teacher_id": teacher_user2.id},
            {"name": "Chemistry", "semester": 3, "teacher_id": None}, # Unassigned for testing
        ]

        created_subjects = []
        for s in subjects_data:
            subj = models.Subject(name=s["name"], semester=s["semester"], teacher_id=s["teacher_id"])
            db.add(subj)
            created_subjects.append(subj)
        db.commit()

        # Refresh subjects to get IDs
        for s in created_subjects:
            db.refresh(s)

        # Student login credentials
        student_pass = auth.get_password_hash("student123")

        # Seed 5 students
        students_data = [
            {"student_id_str": "STU001", "name": "John Doe", "email": "student1@dashboard.com", "semester": 3, "attendance": 88.5, "engagement": 7.5},
            {"student_id_str": "STU002", "name": "Jane Smith", "email": "student2@dashboard.com", "semester": 3, "attendance": 94.0, "engagement": 8.5},
            {"student_id_str": "STU003", "name": "Alex Martinez", "email": "student3@dashboard.com", "semester": 3, "attendance": 68.0, "engagement": 3.8}, # At Risk
            {"student_id_str": "STU004", "name": "Sarah Jenkins", "email": "student4@dashboard.com", "semester": 3, "attendance": 81.2, "engagement": 6.2},
            {"student_id_str": "STU005", "name": "Emily Watson", "email": "student5@dashboard.com", "semester": 3, "attendance": 96.5, "engagement": 9.2},
        ]

        created_students = []
        for s in students_data:
            # Create user account for student login
            u = models.User(name=s["name"], email=s["email"], hashed_password=student_pass, role="Student")
            db.add(u)
            
            # Create student profile
            stud = models.Student(
                student_id_str=s["student_id_str"],
                name=s["name"],
                email=s["email"],
                semester=s["semester"],
                attendance=s["attendance"],
                engagement_score=s["engagement"]
            )
            db.add(stud)
            created_students.append(stud)
        
        db.commit()

        # Refresh students to get IDs
        for s in created_students:
            db.refresh(s)

        # Set up student enrollments:
        # John (STU001), Jane (STU002), Alex (STU003) enroll in Mathematics and Physics
        enrollments = []
        for student in created_students[:3]:
            enrollments.append(models.StudentSubjectEnrollment(student_id=student.id, subject_id=created_subjects[0].id)) # Math
            enrollments.append(models.StudentSubjectEnrollment(student_id=student.id, subject_id=created_subjects[1].id)) # Physics

        # Sarah (STU004) and Emily (STU005) enroll in Physics and English
        for student in created_students[3:]:
            enrollments.append(models.StudentSubjectEnrollment(student_id=student.id, subject_id=created_subjects[1].id)) # Physics
            enrollments.append(models.StudentSubjectEnrollment(student_id=student.id, subject_id=created_subjects[2].id)) # English

        db.add_all(enrollments)
        db.commit()

        # Seed historical attendance records for the last 5 days
        today = datetime.date.today()
        attendance_dates = [today - datetime.timedelta(days=i) for i in range(1, 6)]
        
        attendance_records = []
        # Mathematics: STU001 (John), STU002 (Jane), STU003 (Alex)
        math_id = created_subjects[0].id
        for date in attendance_dates:
            # John: Present all days
            attendance_records.append(models.AttendanceRecord(student_id=created_students[0].id, subject_id=math_id, date=date, status="Present"))
            # Jane: Present all days
            attendance_records.append(models.AttendanceRecord(student_id=created_students[1].id, subject_id=math_id, date=date, status="Present"))
            # Alex: Absent on 2 days, Present on 3 days
            status = "Absent" if date in attendance_dates[:2] else "Present"
            attendance_records.append(models.AttendanceRecord(student_id=created_students[2].id, subject_id=math_id, date=date, status=status))

        # Physics: STU001, STU002, STU003, STU004, STU005
        phys_id = created_subjects[1].id
        for date in attendance_dates:
            attendance_records.append(models.AttendanceRecord(student_id=created_students[0].id, subject_id=phys_id, date=date, status="Present"))
            attendance_records.append(models.AttendanceRecord(student_id=created_students[1].id, subject_id=phys_id, date=date, status="Present"))
            # Alex: Absent 1 day
            status = "Absent" if date == attendance_dates[0] else "Present"
            attendance_records.append(models.AttendanceRecord(student_id=created_students[2].id, subject_id=phys_id, date=date, status=status))
            # Sarah: Present 4 days, Absent 1 day
            status = "Absent" if date == attendance_dates[1] else "Present"
            attendance_records.append(models.AttendanceRecord(student_id=created_students[3].id, subject_id=phys_id, date=date, status=status))
            # Emily: Present all days
            attendance_records.append(models.AttendanceRecord(student_id=created_students[4].id, subject_id=phys_id, date=date, status="Present"))

        # English: STU004, STU005
        eng_id = created_subjects[2].id
        for date in attendance_dates:
            attendance_records.append(models.AttendanceRecord(student_id=created_students[3].id, subject_id=eng_id, date=date, status="Present"))
            attendance_records.append(models.AttendanceRecord(student_id=created_students[4].id, subject_id=eng_id, date=date, status="Present"))

        db.add_all(attendance_records)
        db.commit()

        # Performance Records data setup (Math, Physics, English)
        records_data = []
        for sem in [1, 2]:
            records_data.append(models.PerformanceRecord(student_id=created_students[0].id, subject="Mathematics", grade=74.0, semester=sem, attendance=88.0))
            records_data.append(models.PerformanceRecord(student_id=created_students[0].id, subject="Physics", grade=76.0, semester=sem, attendance=89.0))
            
            records_data.append(models.PerformanceRecord(student_id=created_students[1].id, subject="Mathematics", grade=72.0 if sem==1 else 80.0, semester=sem, attendance=94.0))
            records_data.append(models.PerformanceRecord(student_id=created_students[1].id, subject="Physics", grade=74.0 if sem==1 else 82.0, semester=sem, attendance=93.5))

            records_data.append(models.PerformanceRecord(student_id=created_students[2].id, subject="Mathematics", grade=65.0 if sem==1 else 58.0, semester=sem, attendance=68.0))
            records_data.append(models.PerformanceRecord(student_id=created_students[2].id, subject="Physics", grade=63.0 if sem==1 else 56.0, semester=sem, attendance=67.0))

            records_data.append(models.PerformanceRecord(student_id=created_students[3].id, subject="Physics", grade=79.0, semester=sem, attendance=81.0))
            records_data.append(models.PerformanceRecord(student_id=created_students[3].id, subject="English", grade=81.0, semester=sem, attendance=82.0))

            records_data.append(models.PerformanceRecord(student_id=created_students[4].id, subject="Physics", grade=96.0, semester=sem, attendance=96.0))
            records_data.append(models.PerformanceRecord(student_id=created_students[4].id, subject="English", grade=97.0, semester=sem, attendance=97.0))

        # Add Sem 3 Performance Records for currently enrolled subjects
        # John (STU001): Math (75), Physics (77)
        records_data.append(models.PerformanceRecord(student_id=created_students[0].id, subject="Mathematics", grade=75.0, semester=3, attendance=100.0))
        records_data.append(models.PerformanceRecord(student_id=created_students[0].id, subject="Physics", grade=77.0, semester=3, attendance=100.0))

        # Jane (STU002): Math (90), Physics (92)
        records_data.append(models.PerformanceRecord(student_id=created_students[1].id, subject="Mathematics", grade=90.0, semester=3, attendance=100.0))
        records_data.append(models.PerformanceRecord(student_id=created_students[1].id, subject="Physics", grade=92.0, semester=3, attendance=100.0))

        # Alex (STU003): Math (49), Physics (47)
        records_data.append(models.PerformanceRecord(student_id=created_students[2].id, subject="Mathematics", grade=49.0, semester=3, attendance=60.0))
        records_data.append(models.PerformanceRecord(student_id=created_students[2].id, subject="Physics", grade=47.0, semester=3, attendance=80.0))

        # Sarah (STU004): Physics (80), English (82)
        records_data.append(models.PerformanceRecord(student_id=created_students[3].id, subject="Physics", grade=80.0, semester=3, attendance=80.0))
        records_data.append(models.PerformanceRecord(student_id=created_students[3].id, subject="English", grade=82.0, semester=3, attendance=100.0))

        # Emily (STU005): Physics (95), English (97)
        records_data.append(models.PerformanceRecord(student_id=created_students[4].id, subject="Physics", grade=95.0, semester=3, attendance=100.0))
        records_data.append(models.PerformanceRecord(student_id=created_students[4].id, subject="English", grade=97.0, semester=3, attendance=100.0))

        db.add_all(records_data)
        db.commit()

        # Recalculate student overall metrics from seeded records & attendance logs
        for student in created_students:
            s_records = db.query(models.PerformanceRecord).filter(models.PerformanceRecord.student_id == student.id).all()
            db_att_records = db.query(models.AttendanceRecord).filter(models.AttendanceRecord.student_id == student.id).all()
            
            avg_grade, avg_att, trend = analytics.analyze_performance(s_records)
            
            # Recalculate attendance with daily logs
            overall_att = analytics.calculate_overall_attendance(db_att_records, s_records)
            student.attendance = overall_att
            
            risk_score, risk_level = analytics.calculate_risk(overall_att, avg_grade, student.engagement_score)
            
            analysis = models.PerformanceAnalysis(
                student_id=student.id,
                trend_data=trend,
                risk_score=risk_score,
                risk_level=risk_level
            )
            db.add(analysis)

        # Seed recommendations
        db.add_all([
            models.Recommendation(
                student_id=created_students[2].id, # Alex
                message="Schedule urgent advising session. Math and Physics grades are critically low. Daily attendance has dropped below 70%.",
                priority="High",
                created_date=datetime.datetime.utcnow() - datetime.timedelta(days=2)
            ),
            models.Recommendation(
                student_id=created_students[1].id, # Jane
                message="Excellent academic trajectory. Nominated for peer tutoring leader program.",
                priority="Low",
                created_date=datetime.datetime.utcnow()
            )
        ])
        
        db.commit()
        print("Database seeded successfully!")
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
