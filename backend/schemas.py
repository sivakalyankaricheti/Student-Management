from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datetime import datetime, date

# Auth Schemas
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

# User Schemas
class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: str

class UserCreate(UserBase):
    password: str
    student_id_str: Optional[str] = None
    semester: int = 1
    attendance: float = 0.0
    engagement_score: float = 0.0

class UserUpdate(BaseModel):
    name: str
    email: EmailStr
    role: str
    password: Optional[str] = None
    student_id_str: Optional[str] = None
    semester: int = 1
    attendance: float = 0.0
    engagement_score: float = 0.0

class UserResponse(UserBase):
    id: int

    class Config:
        from_attributes = True

# Performance Record Schemas
class PerformanceRecordBase(BaseModel):
    subject: str
    grade: float
    semester: int
    attendance: float

class PerformanceRecordResponse(PerformanceRecordBase):
    id: int
    student_id: int

    class Config:
        from_attributes = True

# Performance Analysis Schemas
class PerformanceAnalysisResponse(BaseModel):
    id: int
    student_id: int
    trend_data: Optional[str] = None
    risk_score: float
    risk_level: str

    class Config:
        from_attributes = True

# Recommendation Schemas
class RecommendationCreate(BaseModel):
    message: str
    priority: str = "Medium" # Low, Medium, High

class RecommendationResponse(BaseModel):
    id: int
    student_id: int
    message: str
    priority: str
    created_date: datetime

    class Config:
        from_attributes = True

# Student Schemas
class StudentBase(BaseModel):
    student_id_str: str
    name: str
    email: EmailStr
    semester: int
    attendance: float
    engagement_score: float

class StudentCreate(StudentBase):
    pass

class StudentResponse(StudentBase):
    id: int

    class Config:
        from_attributes = True

class StudentDetailResponse(StudentResponse):
    performance_records: List[PerformanceRecordResponse] = []
    performance_analysis: Optional[PerformanceAnalysisResponse] = None
    recommendations: List[RecommendationResponse] = []

    class Config:
        from_attributes = True

# Configuration Schema
class SystemConfig(BaseModel):
    critical_attendance_threshold: float = 75.0
    critical_grade_threshold: float = 60.0

# Subject Schemas
class SubjectBase(BaseModel):
    name: str
    semester: int
    teacher_id: Optional[int] = None

class SubjectCreate(SubjectBase):
    pass

class SubjectResponse(SubjectBase):
    id: int
    teacher: Optional[UserResponse] = None

    class Config:
        from_attributes = True

# Student enrollment request
class StudentEnrollRequest(BaseModel):
    subject_id: int

# Attendance Schemas
class DailyAttendanceRecord(BaseModel):
    student_id: int
    status: str  # Present, Absent

class TeacherAttendancePost(BaseModel):
    subject_id: int
    date: date
    records: List[DailyAttendanceRecord]

class AttendanceRecordResponse(BaseModel):
    id: int
    student_id: int
    subject_id: int
    date: date
    status: str

    class Config:
        from_attributes = True
