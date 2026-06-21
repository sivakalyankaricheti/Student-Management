import io
import csv
import os
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
import models

def generate_csv_report(student: models.Student, records: list[models.PerformanceRecord], analysis: models.PerformanceAnalysis, recs: list[models.Recommendation]) -> str:
    """
    Generates a CSV report summarizing student performance.
    """
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header Information
    writer.writerow(["STUDENT PERFORMANCE REPORT"])
    writer.writerow(["Generated Date", datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")])
    writer.writerow([])
    
    # Profile
    writer.writerow(["Student ID", student.student_id_str])
    writer.writerow(["Name", student.name])
    writer.writerow(["Email", student.email])
    writer.writerow(["Current Semester", student.semester])
    writer.writerow(["Overall Attendance (%)", student.attendance])
    writer.writerow(["Overall Engagement Score (0-10)", student.engagement_score])
    if analysis:
        writer.writerow(["Risk Score (0-100)", analysis.risk_score])
        writer.writerow(["Risk Level", analysis.risk_level])
        writer.writerow(["Performance Trend", analysis.trend_data])
    writer.writerow([])
    
    # Semester Records
    writer.writerow(["ACADEMIC RECORDS"])
    writer.writerow(["Semester", "Subject", "Grade", "Attendance (%)"])
    for record in records:
        writer.writerow([record.semester, record.subject, record.grade, record.attendance])
    writer.writerow([])
    
    # Advisor Recommendations
    writer.writerow(["ACADEMIC ADVISOR RECOMMENDATIONS"])
    writer.writerow(["Date Created", "Priority", "Recommendation Message"])
    for rec in recs:
        writer.writerow([rec.created_date.strftime("%Y-%m-%d"), rec.priority, rec.message])
        
    return output.getvalue()

def generate_pdf_report(student: models.Student, records: list[models.PerformanceRecord], analysis: models.PerformanceAnalysis, recs: list[models.Recommendation], output_path: str):
    """
    Generates a beautifully formatted PDF report using ReportLab.
    """
    doc = SimpleDocTemplate(output_path, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
    story = []
    
    styles = getSampleStyleSheet()
    
    # Custom Styles for premium look
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=colors.HexColor('#1E1B4B'), # Dark Indigo
        spaceAfter=15
    )
    
    section_heading = ParagraphStyle(
        'SectionHeader',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=colors.HexColor('#4338CA'), # Indigo-700
        spaceBefore=12,
        spaceAfter=8
    )
    
    normal_text = ParagraphStyle(
        'NormalText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#374151') # Slate-700
    )
    
    bold_text = ParagraphStyle(
        'BoldText',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#111827')
    )

    # Document Header
    story.append(Paragraph("Student Performance Analytics Report", title_style))
    story.append(Paragraph(f"Generated: {datetime.utcnow().strftime('%B %d, %Y at %H:%M UTC')}", normal_text))
    story.append(Spacer(1, 15))
    
    # Profile Information Table
    risk_text = "N/A"
    risk_color = '#374151'
    if analysis:
        risk_text = f"{analysis.risk_level} (Score: {analysis.risk_score})"
        if analysis.risk_level == "High":
            risk_color = '#DC2626' # Red
        elif analysis.risk_level == "Medium":
            risk_color = '#D97706' # Amber
        else:
            risk_color = '#059669' # Emerald

    profile_data = [
        [Paragraph("Student Details", bold_text), "", Paragraph("Performance Metrics", bold_text), ""],
        [Paragraph("Name:", normal_text), Paragraph(student.name, normal_text), Paragraph("Overall Attendance:", normal_text), Paragraph(f"{student.attendance}%", normal_text)],
        [Paragraph("ID:", normal_text), Paragraph(student.student_id_str, normal_text), Paragraph("Engagement Score:", normal_text), Paragraph(f"{student.engagement_score}/10", normal_text)],
        [Paragraph("Email:", normal_text), Paragraph(student.email, normal_text), Paragraph("Academic Risk Level:", normal_text), Paragraph(f"<font color='{risk_color}'><b>{risk_text}</b></font>", normal_text)],
        [Paragraph("Semester:", normal_text), Paragraph(str(student.semester), normal_text), Paragraph("Grade Trend:", normal_text), Paragraph(analysis.trend_data if analysis else "N/A", normal_text)],
    ]
    
    profile_table = Table(profile_data, colWidths=[1.2*inch, 2.3*inch, 1.6*inch, 2.4*inch])
    profile_table.setStyle(TableStyle([
        ('SPAN', (0, 0), (1, 0)),
        ('SPAN', (2, 0), (3, 0)),
        ('BACKGROUND', (0, 0), (1, 0), colors.HexColor('#F3F4F6')),
        ('BACKGROUND', (2, 0), (3, 0), colors.HexColor('#F3F4F6')),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LINEBELOW', (0, 0), (-1, 0), 1, colors.HexColor('#E5E7EB')),
        ('LINEBELOW', (0, 4), (-1, 4), 1, colors.HexColor('#E5E7EB')),
    ]))
    
    story.append(profile_table)
    story.append(Spacer(1, 20))
    
    # Semester Records Table
    story.append(Paragraph("Academic Records", section_heading))
    records_data = [[Paragraph("<b>Subject</b>", bold_text), Paragraph("<b>Semester</b>", bold_text), Paragraph("<b>Grade (%)</b>", bold_text), Paragraph("<b>Attendance (%)</b>", bold_text)]]
    for r in records:
        records_data.append([
            Paragraph(r.subject, normal_text),
            Paragraph(str(r.semester), normal_text),
            Paragraph(f"{r.grade}%", normal_text),
            Paragraph(f"{r.attendance}%", normal_text)
        ])
        
    records_table = Table(records_data, colWidths=[3.2*inch, 1.1*inch, 1.6*inch, 1.6*inch])
    records_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#EEF2FF')), # Indigo backdrop
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E0E7FF')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    
    story.append(records_table)
    story.append(Spacer(1, 20))
    
    # Recommendations
    story.append(Paragraph("Advisor Recommendations", section_heading))
    if not recs:
        story.append(Paragraph("No recommendations recorded for this student.", normal_text))
    else:
        for idx, rec in enumerate(recs, 1):
            prio_color = '#DC2626' if rec.priority == "High" else ('#D97706' if rec.priority == "Medium" else '#059669')
            rec_html = f"<b>{idx}. [{rec.created_date.strftime('%Y-%m-%d')}] <font color='{prio_color}'>{rec.priority} Priority</font>:</b> {rec.message}"
            story.append(Paragraph(rec_html, normal_text))
            story.append(Spacer(1, 8))
            
    doc.build(story)
