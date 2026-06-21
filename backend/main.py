import os
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
import pandas as pd
import io

import models
import schemas
import auth
import analytics
import reports
from database import engine, get_db, Base

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Student Performance Analytics API", version="1.0.0")

@app.on_event("startup")
def startup_event():
    # Seed the database if no users exist
    from database import SessionLocal
    import models
    from seed import seed_database
    
    db = SessionLocal()
    user_count = 0
    try:
        user_count = db.query(models.User).count()
    except Exception as e:
        print(f"Error checking user count, assuming database is empty: {e}")
        user_count = 0
    finally:
        db.close() # CRITICAL: Close the session to release locks before seeding!
        
    if user_count == 0:
        print("No users found in database. Seeding initial data...")
        seed_database()
    else:
        print(f"Database already contains {user_count} users. Skipping auto-seeding.")



# CORS middleware for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Storage path for generated PDF reports
STORAGE_DIR = "/app/storage"
os.makedirs(STORAGE_DIR, exist_ok=True)

# Mock system configurations in memory
system_config = schemas.SystemConfig()

GRADE_POINTS = {
    "A+": 98.0,
    "A": 95.0,
    "A-": 90.0,
    "B+": 87.0,
    "B": 84.0,
    "B-": 80.0,
    "C+": 77.0,
    "C": 74.0,
    "C-": 70.0,
    "D+": 67.0,
    "D": 64.0,
    "D-": 60.0,
    "F": 0.0,
}

def parse_grade(value):
    raw = str(value).strip().upper()
    if raw in GRADE_POINTS:
        return GRADE_POINTS[raw], f"Letter grade '{raw}' converted to {GRADE_POINTS[raw]}."

    grade = float(raw)
    if not (0.0 <= grade <= 100.0):
        clamped = max(0.0, min(100.0, grade))
        return clamped, f"Grade '{grade}' out of range 0-100. Clamped to {clamped}."
    return grade, None

def parse_engagement_score(value):
    score = float(value)
    if 10.0 < score <= 100.0:
        converted = round(score / 10.0, 2)
        return converted, f"Engagement score '{score}' treated as percentage and converted to {converted}/10."
    if not (0.0 <= score <= 10.0):
        clamped = max(0.0, min(10.0, score))
        return clamped, f"Engagement score '{score}' out of range 0-10. Clamped to {clamped}."
    return score, None

# Auth Endpoints
@app.post("/api/auth/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = auth.create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/auth/me", response_model=schemas.UserResponse)
def get_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

# Admin Endpoints: Users CRUD
@app.get("/api/users", response_model=List[schemas.UserResponse])
def get_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.RoleChecker(["Admin"]))
):
    return db.query(models.User).all()

@app.post("/api/users", response_model=schemas.UserResponse)
def create_user(
    user_in: schemas.UserCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.RoleChecker(["Admin"]))
):
    existing = db.query(models.User).filter(models.User.email == user_in.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")
    
    hashed = auth.get_password_hash(user_in.password)
    user = models.User(
        name=user_in.name,
        email=user_in.email,
        hashed_password=hashed,
        role=user_in.role
    )
    db.add(user)

    if user_in.role == "Student":
        if not user_in.student_id_str:
            raise HTTPException(status_code=400, detail="Student ID is required for student accounts")

        existing_student_id = db.query(models.Student).filter(models.Student.student_id_str == user_in.student_id_str).first()
        if existing_student_id:
            raise HTTPException(status_code=400, detail="Student with this ID already exists")

        existing_student_email = db.query(models.Student).filter(models.Student.email == user_in.email).first()
        if existing_student_email:
            raise HTTPException(status_code=400, detail="Student profile with this email already exists")

        db.add(models.Student(
            student_id_str=user_in.student_id_str,
            name=user_in.name,
            email=user_in.email,
            semester=user_in.semester,
            attendance=user_in.attendance,
            engagement_score=user_in.engagement_score
        ))

    db.commit()
    db.refresh(user)
    return user

@app.put("/api/users/{user_id}", response_model=schemas.UserResponse)
def update_user(
    user_id: int,
    user_in: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.RoleChecker(["Admin"]))
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    email_owner = db.query(models.User).filter(
        models.User.email == user_in.email,
        models.User.id != user_id
    ).first()
    if email_owner:
        raise HTTPException(status_code=400, detail="User with this email already exists")

    previous_role = user.role
    previous_email = user.email

    user.name = user_in.name
    user.email = user_in.email
    user.role = user_in.role
    if user_in.password:
        user.hashed_password = auth.get_password_hash(user_in.password)

    student_profile = db.query(models.Student).filter(models.Student.email == previous_email).first()

    if user_in.role == "Student":
        if not user_in.student_id_str:
            raise HTTPException(status_code=400, detail="Student ID is required for student accounts")

        student_id_owner = db.query(models.Student).filter(
            models.Student.student_id_str == user_in.student_id_str
        ).first()
        if student_id_owner and (not student_profile or student_id_owner.id != student_profile.id):
            raise HTTPException(status_code=400, detail="Student with this ID already exists")

        email_owner = db.query(models.Student).filter(models.Student.email == user_in.email).first()
        if email_owner and (not student_profile or email_owner.id != student_profile.id):
            raise HTTPException(status_code=400, detail="Student profile with this email already exists")

        if not student_profile:
            student_profile = models.Student()
            db.add(student_profile)

        student_profile.student_id_str = user_in.student_id_str
        student_profile.name = user_in.name
        student_profile.email = user_in.email
        student_profile.semester = user_in.semester
        student_profile.attendance = user_in.attendance
        student_profile.engagement_score = user_in.engagement_score
    elif previous_role == "Student" and student_profile:
        student_profile.name = user_in.name
        student_profile.email = user_in.email

    db.commit()
    db.refresh(user)
    return user

@app.delete("/api/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.RoleChecker(["Admin"]))
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.email == current_user.email:
        raise HTTPException(status_code=400, detail="You cannot delete yourself")
    
    db.delete(user)
    db.commit()
    return {"detail": "User deleted successfully"}

# Configuration Settings Endpoints
@app.get("/api/config", response_model=schemas.SystemConfig)
def get_config(current_user: models.User = Depends(auth.get_current_user)):
    return system_config

@app.post("/api/config", response_model=schemas.SystemConfig)
def update_config(
    new_config: schemas.SystemConfig,
    current_user: models.User = Depends(auth.RoleChecker(["Admin"]))
):
    global system_config
    system_config = new_config
    return system_config

# CSV Upload and Cleaning Endpoint
@app.post("/api/students/upload")
async def upload_dataset(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.RoleChecker(["Admin", "Teacher", "AcademicAdvisor", "Student"]))
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed.")
    
    contents = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV file: {str(e)}")

    required_cols = {'student_id', 'name', 'email', 'semester', 'subject', 'grade', 'attendance', 'engagement_score'}
    csv_cols = {col.lower().replace(" ", "_") for col in df.columns}
    
    # Check if necessary columns are present (flexible matching)
    missing = required_cols - csv_cols
    if missing:
        raise HTTPException(
            status_code=400, 
            detail=f"CSV is missing columns: {', '.join(missing)}. Required: {', '.join(required_cols)}"
        )

    # Normalize column names
    df.columns = [c.lower().replace(" ", "_") for c in df.columns]

    errors = []
    total_records = len(df)
    imported_count = 0

    for idx, row in df.iterrows():
        row_num = idx + 2  # 1-indexed plus header row
        
        # 1. Check for missing values
        if pd.isna(row['student_id']) or pd.isna(row['name']) or pd.isna(row['email']) or pd.isna(row['subject']):
            errors.append(f"Row {row_num}: Missing required textual values (ID, Name, Email, or Subject). Row skipped.")
            continue
            
        student_id_str = str(row['student_id']).strip()
        name = str(row['name']).strip()
        email = str(row['email']).strip()
        subject = str(row['subject']).strip()

        if current_user.role == "Student" and email.lower() != current_user.email.lower():
            errors.append(f"Row {row_num}: Students can only upload records for their own email address. Row skipped.")
            continue
        
        # 2. Parse and Validate Semester
        try:
            semester = int(row['semester'])
            if semester <= 0:
                raise ValueError()
        except:
            errors.append(f"Row {row_num}: Invalid semester value '{row['semester']}'. Row skipped.")
            continue

        # 3. Parse and Validate Grade
        try:
            grade, grade_warning = parse_grade(row['grade'])
            if grade_warning:
                errors.append(f"Row {row_num}: {grade_warning}")
        except:
            errors.append(f"Row {row_num}: Invalid grade value '{row['grade']}'. Row skipped.")
            continue

        # 4. Parse and Validate Attendance
        try:
            attendance = float(row['attendance'])
            if not (0.0 <= attendance <= 100.0):
                errors.append(f"Row {row_num}: Attendance '{attendance}' out of range 0-100. Clamped to boundaries.")
                attendance = max(0.0, min(100.0, attendance))
        except:
            errors.append(f"Row {row_num}: Invalid attendance value '{row['attendance']}'. Row skipped.")
            continue

        # 5. Parse and Validate Engagement Score
        try:
            engagement_score, engagement_warning = parse_engagement_score(row['engagement_score'])
            if engagement_warning:
                errors.append(f"Row {row_num}: {engagement_warning}")
        except:
            errors.append(f"Row {row_num}: Invalid engagement score '{row['engagement_score']}'. Row skipped.")
            continue

        # Find or create student
        student = db.query(models.Student).filter(models.Student.student_id_str == student_id_str).first()
        if current_user.role == "Student":
            own_student = db.query(models.Student).filter(models.Student.email == current_user.email).first()
            if own_student and own_student.student_id_str != student_id_str:
                errors.append(f"Row {row_num}: Student ID does not match your existing profile. Row skipped.")
                continue
            if student and student.email.lower() != current_user.email.lower():
                errors.append(f"Row {row_num}: Student ID belongs to another profile. Row skipped.")
                continue

        if not student:
            student = models.Student(
                student_id_str=student_id_str,
                name=name,
                email=email,
                semester=semester,
                attendance=attendance,
                engagement_score=engagement_score
            )
            db.add(student)
            db.commit()
            db.refresh(student)
            
            # Also create corresponding Student User if not exists
            exists_user = db.query(models.User).filter(models.User.email == email).first()
            if not exists_user:
                stud_pass = auth.get_password_hash("student123")
                db.add(models.User(name=name, email=email, hashed_password=stud_pass, role="Student"))
                db.commit()
        else:
            # Update student overall metrics
            student.semester = max(student.semester, semester)
            # Aggregate stats will be recomputed anyway, but let's store latest state
            student.attendance = attendance
            student.engagement_score = engagement_score
            db.commit()

        # Add performance record
        perf_rec = models.PerformanceRecord(
            student_id=student.id,
            subject=subject,
            grade=grade,
            semester=semester,
            attendance=attendance
        )
        db.add(perf_rec)
        db.commit()
        imported_count += 1

    # Re-calculate analysis for all modified students
    active_students = db.query(models.Student).all()
    for s in active_students:
        s_records = db.query(models.PerformanceRecord).filter(models.PerformanceRecord.student_id == s.id).all()
        if not s_records:
            continue
            
        avg_grade, avg_att, trend = analytics.analyze_performance(s_records)
        s.attendance = avg_att
        
        # Calculate risk using configured boundaries if needed
        risk_score, risk_level = analytics.calculate_risk(avg_att, avg_grade, s.engagement_score)
        
        # Find or create analysis
        analysis = db.query(models.PerformanceAnalysis).filter(models.PerformanceAnalysis.student_id == s.id).first()
        if not analysis:
            analysis = models.PerformanceAnalysis(student_id=s.id)
            db.add(analysis)
            
        analysis.trend_data = trend
        analysis.risk_score = risk_score
        analysis.risk_level = risk_level
        db.commit()

    return {
        "message": "CSV processing completed",
        "total_rows": total_records,
        "successful_records": imported_count,
        "errors": errors
    }

# Dashboard and Student Listing Endpoints
@app.get("/api/students", response_model=List[schemas.StudentDetailResponse])
def get_students(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.RoleChecker(["Admin", "Teacher", "AcademicAdvisor"]))
):
    return db.query(models.Student).all()

@app.get("/api/students/{student_id}", response_model=schemas.StudentDetailResponse)
def get_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.RoleChecker(["Admin", "Teacher", "AcademicAdvisor"]))
):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return student

# Student Role Dashboard Endpoint (Resolves profile using logged in user email)
@app.get("/api/student/dashboard", response_model=schemas.StudentDetailResponse)
def get_student_dashboard(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.RoleChecker(["Student"]))
):
    student = db.query(models.Student).filter(models.Student.email == current_user.email).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found for this user account.")
    return student

# Recommendations Endpoints
@app.post("/api/students/{student_id}/recommendations", response_model=schemas.RecommendationResponse)
def add_recommendation(
    student_id: int,
    rec_in: schemas.RecommendationCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.RoleChecker(["Teacher", "AcademicAdvisor"]))
):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
        
    rec = models.Recommendation(
        student_id=student_id,
        message=rec_in.message,
        priority=rec_in.priority
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec

# Report Download Endpoints
@app.get("/api/students/{student_id}/report")
def export_student_report(
    student_id: int,
    format: str = "pdf",  # pdf or csv
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.RoleChecker(["Admin", "Teacher", "AcademicAdvisor", "Student"]))
):
    # If Student role, verify they are downloading their own report
    if current_user.role == "Student":
        student = db.query(models.Student).filter(models.Student.email == current_user.email).first()
        if not student or student.id != student_id:
            raise HTTPException(status_code=403, detail="Not authorized to access reports for other students.")
    else:
        student = db.query(models.Student).filter(models.Student.id == student_id).first()
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")

    records = db.query(models.PerformanceRecord).filter(models.PerformanceRecord.student_id == student_id).all()
    analysis = db.query(models.PerformanceAnalysis).filter(models.PerformanceAnalysis.student_id == student_id).first()
    recs = db.query(models.Recommendation).filter(models.Recommendation.student_id == student_id).all()

    if format.lower() == "csv":
        csv_data = reports.generate_csv_report(student, records, analysis, recs)
        filename = f"report_{student.student_id_str}.csv"
        return Response(
            content=csv_data,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    elif format.lower() == "pdf":
        filename = f"report_{student.student_id_str}.pdf"
        file_path = os.path.join(STORAGE_DIR, filename)
        try:
            reports.generate_pdf_report(student, records, analysis, recs, file_path)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")
            
        # Log report in database
        db_report = models.Report(type="PDF", file_path=file_path)
        db.add(db_report)
        db.commit()
        
        return FileResponse(
            path=file_path,
            filename=filename,
            media_type="application/pdf"
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid format. Supported formats: pdf, csv")

# --- Enrollment & Attendance System Endpoints ---

# Admin: List all teacher accounts
@app.get("/api/teachers", response_model=List[schemas.UserResponse])
def get_teachers(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.RoleChecker(["Admin"]))
):
    return db.query(models.User).filter(models.User.role.in_(["Teacher", "AcademicAdvisor"])).all()

# Admin: List all subjects
@app.get("/api/subjects", response_model=List[schemas.SubjectResponse])
def get_subjects(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.RoleChecker(["Admin"]))
):
    return db.query(models.Subject).all()

# Admin: Create subject and allocate teacher
@app.post("/api/subjects", response_model=schemas.SubjectResponse)
def create_subject(
    subj_in: schemas.SubjectCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.RoleChecker(["Admin"]))
):
    # If teacher_id is provided, verify they are indeed a teacher
    if subj_in.teacher_id:
        teacher = db.query(models.User).filter(
            models.User.id == subj_in.teacher_id,
            models.User.role.in_(["Teacher", "AcademicAdvisor"])
        ).first()
        if not teacher:
            raise HTTPException(status_code=400, detail="Invalid teacher selected.")
            
    subject = models.Subject(
        name=subj_in.name,
        semester=subj_in.semester,
        teacher_id=subj_in.teacher_id
    )
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return subject

# Student: List available subjects for their semester (not enrolled)
@app.get("/api/student/available-subjects", response_model=List[schemas.SubjectResponse])
def get_available_subjects(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.RoleChecker(["Student"]))
):
    student = db.query(models.Student).filter(models.Student.email == current_user.email).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found.")
        
    enrolled_subject_ids = [e.subject_id for e in student.enrollments]
    
    return db.query(models.Subject).filter(
        models.Subject.semester == student.semester,
        ~models.Subject.id.in_(enrolled_subject_ids) if enrolled_subject_ids else True
    ).all()

# Student: List enrolled subjects
@app.get("/api/student/my-subjects", response_model=List[schemas.SubjectResponse])
def get_student_subjects(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.RoleChecker(["Student"]))
):
    student = db.query(models.Student).filter(models.Student.email == current_user.email).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found.")
        
    return [e.subject for e in student.enrollments]

# Student: Enroll in a subject
@app.post("/api/student/enroll")
def enroll_student(
    req: schemas.StudentEnrollRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.RoleChecker(["Student"]))
):
    student = db.query(models.Student).filter(models.Student.email == current_user.email).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found.")
        
    subject = db.query(models.Subject).filter(models.Subject.id == req.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found.")
        
    if subject.semester != student.semester:
        raise HTTPException(status_code=400, detail="Subject semester mismatch.")
        
    # Check if already enrolled
    existing = db.query(models.StudentSubjectEnrollment).filter(
        models.StudentSubjectEnrollment.student_id == student.id,
        models.StudentSubjectEnrollment.subject_id == subject.id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already enrolled in this subject.")
        
    enrollment = models.StudentSubjectEnrollment(
        student_id=student.id,
        subject_id=subject.id
    )
    db.add(enrollment)
    
    # Initialize a default PerformanceRecord so it displays in student metrics
    perf = db.query(models.PerformanceRecord).filter(
        models.PerformanceRecord.student_id == student.id,
        models.PerformanceRecord.subject == subject.name,
        models.PerformanceRecord.semester == student.semester
    ).first()
    if not perf:
        db.add(models.PerformanceRecord(
            student_id=student.id,
            subject=subject.name,
            grade=0.0,
            semester=student.semester,
            attendance=100.0
        ))
        
    db.commit()
    
    # Re-calculate overall analytics & risk
    recompute_student_risk(student.id, db)
    
    return {"message": f"Enrolled in {subject.name} successfully."}

# Teacher: Get assigned subjects
@app.get("/api/teacher/my-subjects", response_model=List[schemas.SubjectResponse])
def get_teacher_subjects(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.RoleChecker(["Teacher", "AcademicAdvisor"]))
):
    return db.query(models.Subject).filter(models.Subject.teacher_id == current_user.id).all()

# Teacher: List students in subject
@app.get("/api/teacher/subjects/{subject_id}/students", response_model=List[schemas.StudentResponse])
def get_subject_students(
    subject_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.RoleChecker(["Teacher", "AcademicAdvisor"]))
):
    # Verify subject exists
    subject = db.query(models.Subject).filter(models.Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found.")
        
    # Optional: Verify ownership if teacher
    if current_user.role == "Teacher" and subject.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized for this subject.")
        
    return db.query(models.Student).join(models.StudentSubjectEnrollment).filter(
        models.StudentSubjectEnrollment.subject_id == subject_id
    ).all()

# Teacher: Save daily attendance sheet
@app.post("/api/teacher/attendance")
def save_attendance(
    post_data: schemas.TeacherAttendancePost,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.RoleChecker(["Teacher", "AcademicAdvisor"]))
):
    subject = db.query(models.Subject).filter(models.Subject.id == post_data.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found.")
        
    if current_user.role == "Teacher" and subject.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to log attendance for this subject.")

    # Process and save attendance records
    for rec in post_data.records:
        # Check if record for this student, subject, and date already exists
        existing = db.query(models.AttendanceRecord).filter(
            models.AttendanceRecord.student_id == rec.student_id,
            models.AttendanceRecord.subject_id == post_data.subject_id,
            models.AttendanceRecord.date == post_data.date
        ).first()
        
        if existing:
            existing.status = rec.status
        else:
            db.add(models.AttendanceRecord(
                student_id=rec.student_id,
                subject_id=post_data.subject_id,
                date=post_data.date,
                status=rec.status
            ))
            
    db.commit()
    
    # Recalculate metrics for all affected students
    for rec in post_data.records:
        recompute_student_risk(rec.student_id, db)
        
    return {"message": "Attendance records saved successfully."}

def recompute_student_risk(student_id: int, db: Session):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        return
        
    perf_records = db.query(models.PerformanceRecord).filter(models.PerformanceRecord.student_id == student_id).all()
    db_att_records = db.query(models.AttendanceRecord).filter(models.AttendanceRecord.student_id == student_id).all()
    
    # Recalculate overall attendance rate
    overall_att = analytics.calculate_overall_attendance(db_att_records, perf_records)
    student.attendance = overall_att
    
    # Recalculate average grade and trend
    avg_grade, _, trend = analytics.analyze_performance(perf_records)
    
    # Recalculate risk
    risk_score, risk_level = analytics.calculate_risk(overall_att, avg_grade, student.engagement_score)
    
    analysis = db.query(models.PerformanceAnalysis).filter(models.PerformanceAnalysis.student_id == student_id).first()
    if not analysis:
        analysis = models.PerformanceAnalysis(student_id=student_id)
        db.add(analysis)
        
    analysis.trend_data = trend
    analysis.risk_score = risk_score
    analysis.risk_level = risk_level
    
    db.commit()

# Serve Frontend static files
from fastapi.staticfiles import StaticFiles

frontend_dist_path = "/app/frontend/dist"
if os.path.exists(frontend_dist_path):
    app.mount("/", StaticFiles(directory=frontend_dist_path, html=True), name="static")
elif os.path.exists("../frontend/dist"):
    app.mount("/", StaticFiles(directory="../frontend/dist", html=True), name="static")
