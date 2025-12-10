from fpdf import FPDF

# 1. Define the custom class
class PDF(FPDF):
    def header(self):
        self.set_font('Arial', 'B', 14)
        self.cell(0, 10, 'Summary: Drift Monitor Coverage & CRA Alignment', 0, 1, 'C')
        self.ln(5)

    def chapter_title(self, num, label):
        self.set_font('Arial', 'B', 12)
        self.set_fill_color(200, 220, 255) # Light blue background
        self.cell(0, 6, f"{num}. {label}", 0, 1, 'L', True)
        self.ln(4)

    def chapter_body(self, body):
        self.set_font('Arial', '', 11)
        self.multi_cell(0, 5, body)
        self.ln()

    def bullet_point(self, text):
        self.set_font('Arial', '', 11)
        self.cell(5) # Indent
        self.multi_cell(0, 5, f"- {text}")
        self.ln(2)

# 2. Instantiate the CUSTOM class (This was the fix)
pdf = PDF() 

pdf.add_page()
pdf.set_auto_page_break(auto=True, margin=15)

# 3. Add Content
# Section 1
pdf.chapter_title(1, "Concept Alignment: CRA vs. Industry Terms")
pdf.bullet_point("Terminology: 'CRA' usually means EU Cyber Resilience Act in industry.")
pdf.bullet_point("Best Practice: Aligns with 'Continuous Control Monitoring' (CCM).")
pdf.bullet_point("Function: Ensures compliance over time by monitoring drift.")

# Section 2
pdf.chapter_title(2, "Drift Monitor Coverage (Industry Definition)")
pdf.chapter_body("A standard MLOps metric measuring the % of models watched for drift.")
pdf.bullet_point("Data Drift: Input data changes (e.g., demographics).")
pdf.bullet_point("Model Drift: Input-output relationship changes.")

# Section 3
pdf.chapter_title(3, "Alignment with ISO 42001")
pdf.bullet_point("Clause 9.1: Mandates monitoring of AI performance.")
pdf.bullet_point("Clause 10.1: Requires remediation of nonconformities.")

# Section 4
pdf.chapter_title(4, "Standard Calculation")
pdf.chapter_body("Metric = (Models with Active Monitoring / Total Models) * 100")

# Section 5
pdf.chapter_title(5, "Comparison Table")
pdf.set_font('Courier', '', 10)
# Simple ASCII table for layout safety
pdf.multi_cell(0, 5, "KPI Name:      Drift Monitor Coverage  |  Model Monitoring Coverage\n"
                     "Category:      CRA Pillar              |  MLOps / MRM\n"
                     "Standard:      ISO 42001 L2+           |  ISO 42001 Clause 9.1\n"
                     "Goal:          Score >= 80%            |  Detect 'silent failure'")

# 4. Output the file
pdf.output("Drift_Monitor_Coverage_Summary.pdf")
print("PDF generated successfully: Drift_Monitor_Coverage_Summary.pdf")