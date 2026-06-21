from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Date
from sqlalchemy.orm import relationship
from database import Base
import datetime

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, nullable=False)  # Admin, Teacher, AcademicAdvisor, Student

class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    student_id_str = Column(String, unique=True, index=True, nullable=False)  # e.g., STU001
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    semester = Column(Integer, default=1)
    attendance = Column(Float, default=0.0)
    engagement_score = Column(Float, default=0.0)  # scale 0 to 10

    # Relationships
    performance_records = relationship("PerformanceRecord", back_populates="student", cascade="all, delete-orphan")
    performance_analysis = relationship("PerformanceAnalysis", uselist=False, back_populates="student", cascade="all, delete-orphan")
    recommendations = relationship("Recommendation", back_populates="student", cascade="all, delete-orphan")
    enrollments = relationship("StudentSubjectEnrollment", back_populates="student", cascade="all, delete-orphan")
    attendance_records = relationship("AttendanceRecord", back_populates="student", cascade="all, delete-orphan")

class PerformanceRecord(Base):
    __tablename__ = "performance_records"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    subject = Column(String, nullable=False)
    grade = Column(Float, nullable=False)
    semester = Column(Integer, nullable=False)
    attendance = Column(Float, nullable=False)

    student = relationship("Student", back_populates="performance_records")

class PerformanceAnalysis(Base):
    __tablename__ = "performance_analyses"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), unique=True, nullable=False)
    trend_data = Column(String, nullable=True)  # JSON or descriptive string of trends
    risk_score = Column(Float, default=0.0)      # scale 0 to 100
    risk_level = Column(String, default="Low")    # Low, Medium, High

    student = relationship("Student", back_populates="performance_analysis")

class Recommendation(Base):
    __tablename__ = "recommendations"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    message = Column(String, nullable=False)
    priority = Column(String, default="Medium")  # Low, Medium, High
    created_date = Column(DateTime, default=datetime.datetime.utcnow)

    student = relationship("Student", back_populates="recommendations")

class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String, nullable=False)         # CSV, PDF
    file_path = Column(String, nullable=False)
    generated_date = Column(DateTime, default=datetime.datetime.utcnow)

class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    semester = Column(Integer, nullable=False)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Relationships
    teacher = relationship("User")
    enrollments = relationship("StudentSubjectEnrollment", back_populates="subject", cascade="all, delete-orphan")
    attendance_records = relationship("AttendanceRecord", back_populates="subject", cascade="all, delete-orphan")

class StudentSubjectEnrollment(Base):
    __tablename__ = "student_subject_enrollments"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)

    # Relationships
    student = relationship("Student", back_populates="enrollments")
    subject = relationship("Subject", back_populates="enrollments")

class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    date = Column(Date, nullable=False)
    status = Column(String, nullable=False)  # Present, Absent

    # Relationships
    student = relationship("Student", back_populates="attendance_records")
    subject = relationship("Subject", back_populates="attendance_records")
