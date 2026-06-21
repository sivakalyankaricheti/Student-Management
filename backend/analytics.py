from typing import List
import models

def calculate_risk(attendance: float, avg_grade: float, engagement: float) -> tuple[float, str]:
    """
    Computes a risk score (0-100) and risk level (Low, Medium, High).
    """
    # Simple deterministic risk rules
    # Critical flags: Very low attendance or very low grades trigger High Risk
    if attendance < 75.0 or avg_grade < 55.0:
        level = "High"
    elif attendance < 85.0 or avg_grade < 70.0 or engagement < 5.0:
        level = "Medium"
    else:
        level = "Low"

    # Compute continuous risk score
    # High risk score is driven by poor attendance, grades, and low engagement
    attendance_penalty = max(0.0, 100.0 - attendance) * 0.4      # max 40 pts
    grade_penalty = max(0.0, 100.0 - avg_grade) * 0.4            # max 40 pts
    engagement_penalty = max(0.0, 10.0 - engagement) * 2.0        # max 20 pts

    score = min(100.0, max(0.0, attendance_penalty + grade_penalty + engagement_penalty))
    return round(score, 1), level

def analyze_performance(records: List[models.PerformanceRecord]) -> tuple[float, float, str]:
    """
    Analyzes performance records:
    - Calculates overall average grade
    - Calculates overall average attendance
    - Decides trend direction (Improving, Stable, Declining)
    """
    if not records:
        return 0.0, 0.0, "Stable"

    avg_grade = sum(r.grade for r in records) / len(records)
    avg_attendance = sum(r.attendance for r in records) / len(records)

    # Determine trend based on grades across semesters
    semesters = sorted(list(set(r.semester for r in records)))
    if len(semesters) < 2:
        trend = "Stable"
    else:
        # Calculate average grade per semester
        sem_averages = []
        for sem in semesters:
            sem_records = [r for r in records if r.semester == sem]
            sem_avg = sum(r.grade for r in sem_records) / len(sem_records)
            sem_averages.append(sem_avg)

        # Look at the difference between latest and earliest semesters
        diff = sem_averages[-1] - sem_averages[0]
        if diff > 3.0:
            trend = "Improving"
        elif diff < -3.0:
            trend = "Declining"
        else:
            trend = "Stable"

    return round(avg_grade, 1), round(avg_attendance, 1), trend

def calculate_overall_attendance(db_attendance_records: List, perf_records: List[models.PerformanceRecord]) -> float:
    if db_attendance_records:
        present = sum(1 for r in db_attendance_records if r.status == "Present")
        return round((present / len(db_attendance_records)) * 100.0, 1)
    elif perf_records:
        return round(sum(r.attendance for r in perf_records) / len(perf_records), 1)
    return 0.0
