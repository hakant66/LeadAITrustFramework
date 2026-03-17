from fpdf import FPDF

class PDF(FPDF):
    def header(self):
        # Header is set manually in the body
        pass

    def chapter_title(self, label):
        self.set_font('Arial', 'B', 12)
        self.set_fill_color(230, 230, 230) # Light gray
        self.cell(0, 8, label, 0, 1, 'L', True)
        self.ln(4)

    def sub_heading(self, text):
        self.set_font('Arial', 'B', 10)
        self.cell(0, 6, text, 0, 1, 'L')
        self.ln(1)

    def bullet_point(self, text):
        self.set_font('Arial', '', 10)
        self.cell(5) # indent
        self.multi_cell(0, 5, f"- {text}")
        self.ln(2)

def generate_provenance_pdf():
    pdf = PDF()
    pdf.add_page()
    
    # Custom Title
    pdf.set_font('Arial', 'B', 14)
    pdf.cell(0, 10, 'KPI Summary: Provenance & Licensing Coverage', 0, 1, 'C')
    pdf.ln(5)

    # 1. Core Objective
    pdf.chapter_title("1. Core Objective")
    pdf.set_font('Arial', '', 10)
    pdf.multi_cell(0, 5, "Mitigates legal and ethical risks by validating the lineage "
                         "and legal basis of all data. Prevents the use of stolen or "
                         "unlicensed data by requiring verified rights for every asset.")
    pdf.ln()

    # 2. KPI Details
    pdf.chapter_title("2. Key Performance Indicators (KPIs)")
    pdf.sub_heading("Definition & Scope")
    pdf.bullet_point("Share of datasets/models with documented source and license.")
    pdf.bullet_point("Scope: Training data, eval sets, and prompt libraries.")
    
    pdf.sub_heading("Calculation & Guardrail")
    pdf.bullet_point("Formula: (Verified Records / Total Records) * 100.")
    pdf.bullet_point("Guardrail: Pillar capped at 60 if coverage < 80%.")
    pdf.bullet_point("Example: '93% (metadata complete for 279 of 300 assets)'.")
    pdf.ln()

    # 3. Required Evidence
    pdf.chapter_title("3. Required Evidence")
    pdf.bullet_point("Inventory: Source, license terms, consent, retention rules.")
    pdf.bullet_point("Registry: Metadata records for all in-scope assets.")
    pdf.bullet_point("Legal Reviews: Verification of usage rights vs. intent.")
    pdf.ln()

    # 4. Roles & Timeline
    pdf.chapter_title("4. Ownership & Timeline")
    pdf.bullet_point("Owners: Data Steward, Legal (IP/DP), Model Owner.")
    pdf.bullet_point("Timeline: 2-6 weeks initial; rolling updates.")

    # Output
    pdf.output("Provenance_Licensing_Coverage_Summary.pdf")
    print("Generated: Provenance_Licensing_Coverage_Summary.pdf")

if __name__ == "__main__":
    generate_provenance_pdf()