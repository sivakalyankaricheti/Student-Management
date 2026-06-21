import unittest
import analytics
import models

class TestAnalytics(unittest.TestCase):
    def test_calculate_risk_high(self):
        # Low attendance triggers high risk
        score, level = analytics.calculate_risk(attendance=70.0, avg_grade=80.0, engagement=8.0)
        self.assertEqual(level, "High")
        self.assertTrue(score > 20.0)

        # Low grades triggers high risk
        score, level = analytics.calculate_risk(attendance=95.0, avg_grade=50.0, engagement=8.0)
        self.assertEqual(level, "High")
        self.assertTrue(score > 20.0)

    def test_calculate_risk_medium(self):
        # Moderate attendance (e.g. 80%) triggers medium risk
        score, level = analytics.calculate_risk(attendance=80.0, avg_grade=80.0, engagement=8.0)
        self.assertEqual(level, "Medium")

        # Moderate grades (e.g. 65%) triggers medium risk
        score, level = analytics.calculate_risk(attendance=95.0, avg_grade=65.0, engagement=8.0)
        self.assertEqual(level, "Medium")

        # Low engagement (e.g. 3.0) triggers medium risk
        score, level = analytics.calculate_risk(attendance=95.0, avg_grade=85.0, engagement=3.0)
        self.assertEqual(level, "Medium")

    def test_calculate_risk_low(self):
        # High metrics -> Low risk
        score, level = analytics.calculate_risk(attendance=95.0, avg_grade=85.0, engagement=9.0)
        self.assertEqual(level, "Low")
        self.assertTrue(score < 25.0)

    def test_analyze_performance_empty(self):
        avg_grade, avg_att, trend = analytics.analyze_performance([])
        self.assertEqual(avg_grade, 0.0)
        self.assertEqual(avg_att, 0.0)
        self.assertEqual(trend, "Stable")

    def test_analyze_performance_trends(self):
        # Stable trend
        r1 = models.PerformanceRecord(semester=1, subject="Math", grade=70.0, attendance=90.0)
        r2 = models.PerformanceRecord(semester=2, subject="Math", grade=71.0, attendance=90.0)
        avg_grade, avg_att, trend = analytics.analyze_performance([r1, r2])
        self.assertEqual(trend, "Stable")

        # Improving trend (grade increase > 3)
        r3 = models.PerformanceRecord(semester=1, subject="Math", grade=70.0, attendance=90.0)
        r4 = models.PerformanceRecord(semester=2, subject="Math", grade=75.0, attendance=90.0)
        avg_grade, avg_att, trend = analytics.analyze_performance([r3, r4])
        self.assertEqual(trend, "Improving")

        # Declining trend (grade decrease < -3)
        r5 = models.PerformanceRecord(semester=1, subject="Math", grade=70.0, attendance=90.0)
        r6 = models.PerformanceRecord(semester=2, subject="Math", grade=65.0, attendance=90.0)
        avg_grade, avg_att, trend = analytics.analyze_performance([r5, r6])
        self.assertEqual(trend, "Declining")

    def test_calculate_overall_attendance(self):
        class MockAttRecord:
            def __init__(self, status):
                self.status = status

        rec_p = MockAttRecord("Present")
        rec_a = MockAttRecord("Absent")
        
        # 1. Daily records exist
        att = analytics.calculate_overall_attendance([rec_p, rec_p, rec_p, rec_p, rec_a], [])
        self.assertEqual(att, 80.0)

        # 2. Daily records empty, fall back to performance records
        r1 = models.PerformanceRecord(semester=1, subject="Math", grade=70.0, attendance=90.0)
        r2 = models.PerformanceRecord(semester=2, subject="Math", grade=71.0, attendance=92.0)
        att = analytics.calculate_overall_attendance([], [r1, r2])
        self.assertEqual(att, 91.0)

        # 3. Both empty
        att = analytics.calculate_overall_attendance([], [])
        self.assertEqual(att, 0.0)

if __name__ == "__main__":
    unittest.main()
