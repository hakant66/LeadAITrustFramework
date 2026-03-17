import pandas as pd

# Define the 38 Controls and Domains
data = [
    # A.2 Policies
    ("A.2.2", "AI Policy", "Yes", "Risk treatment: Establishes top-level governance mandate.", "Implemented", "LeadAI Risk Policy v1.0"),
    ("A.2.3", "Alignment with other policies", "Yes", "Ensures AI policy does not conflict with InfoSec (ISO 27001).", "Implemented", "Policy Mapping Matrix"),
    ("A.2.4", "Review of the AI policy", "Yes", "Policy must evolve with regulatory changes (EU AI Act).", "Scheduled", "Annual Management Review Minutes"),
    
    # A.3 Internal Org
    ("A.3.2", "Roles and responsibilities", "Yes", "Assigns accountability for AI risks (e.g., PCL role).", "Implemented", "RACI Matrix; Job Description (PCL)"),
    ("A.3.3", "Reporting of concerns", "Yes", "Allows staff to flag ethical/safety issues without retaliation.", "Implemented", "Whistleblowing Portal; Incident Log"),

    # A.4 Resources
    ("A.4.2", "Resource documentation", "Yes", "Inventory of all assets required for the AI system.", "Implemented", "Asset Inventory (Jira)"),
    ("A.4.3", "Data resources", "Yes", "Critical for tracking training data lineage.", "Implemented", "Data Catalog (Collibra/Excel)"),
    ("A.4.4", "Tooling resources", "Yes", "Managing ML frameworks (e.g., PyTorch) and versions.", "Implemented", "MLOps SBOM"),
    ("A.4.5", "System & computing resources", "Yes", "Managing GPU/Cloud infrastructure risks.", "Implemented", "Cloud Architecture Diagram"),
    ("A.4.6", "Human resources", "Yes", "Ensuring AI team has required competency/training.", "Implemented", "Training Records; HR Competency Matrix"),

    # A.5 Impact
    ("A.5.2", "Impact assessment process", "Yes", "Methodology for grading impact on users (High/Med/Low).", "Implemented", "AI Impact Assessment (AIIA) Procedure"),
    ("A.5.3", "Documentation of assessments", "Yes", "Record of specific assessments per model.", "Implemented", "AIIA Reports"),
    ("A.5.4", "Impact on individuals", "Yes", "Assessing fairness, bias, and automated decision rights.", "Implemented", "Bias Testing Reports"),
    ("A.5.5", "Societal impacts", "Yes", "Assessing broader harm (e.g., misinformation).", "Partial", "Ethics Committee Meeting Minutes"),

    # A.6 Lifecycle
    ("A.6.1.2", "Responsible development objectives", "Yes", "Defining fairness/accuracy goals before coding.", "Implemented", "Product Requirements Document (PRD)"),
    ("A.6.1.3", "Design and development process", "Yes", "Standard lifecycle phases (Design -> Train -> Test).", "Implemented", "SDLC / MLOps Policy"),
    ("A.6.2.2", "System requirements", "Yes", "Specifying technical boundaries and performance targets.", "Implemented", "Model Cards; Technical Specs"),
    ("A.6.2.3", "Design documentation", "Yes", "Documenting model architecture and hyperparameters.", "Implemented", "Design Specs"),
    ("A.6.2.4", "Verification and validation", "Yes", "Testing model against requirements (V&V).", "Implemented", "Validation Report; XAI Test Results"),
    ("A.6.2.5", "Deployment", "Yes", "Controlled release to production (Phase Gates).", "Implemented", "Release Sign-off Logs"),
    ("A.6.2.6", "Operation and monitoring", "Yes", "Continuous monitoring for drift/errors.", "Implemented", "Drift Dashboard (Evidently)"),
    ("A.6.2.7", "Technical documentation", "Yes", "Compliance with EU AI Act Annex IV.", "Implemented", "Tech Docs Bundle"),
    ("A.6.2.8", "Event logs", "Yes", "Recording inputs/outputs for traceability.", "Implemented", "Immutable Audit Logs"),

    # A.7 Data
    ("A.7.2", "Data management", "Yes", "Processes for storage, retention, and deletion.", "Implemented", "Data Handling Policy"),
    ("A.7.3", "Data Acquisition", "Yes", "Rules for selecting data sources (provenance).", "Implemented", "Data Source Registry"),
    ("A.7.4", "Data Quality", "Yes", "Checks for accuracy, completeness, and balance.", "Implemented", "Data Quality Reports"),
    ("A.7.5", "Data Provenance", "Yes", "Tracking legal lineage of data (Copyright/IP).", "Implemented", "Provenance KPI Scorecard"),
    ("A.7.6", "Data Preparation", "Yes", "Documenting cleaning, labeling, and preprocessing.", "Implemented", "Data Pipeline Code"),

    # A.8 Info for Interested Parties
    ("A.8.2", "System documentation for users", "Yes", "Instructions for end-users (transparency).", "Implemented", "User Manual; Trust Factsheet"),
    ("A.8.3", "External reporting", "Yes", "Channel for public to report issues.", "Implemented", "Public Support Portal"),
    ("A.8.4", "Communication of incidents", "Yes", "Plan to notify users/regulators of failures.", "Implemented", "Incident Response Plan"),
    ("A.8.5", "Information sharing", "Yes", "Sharing data with partners/regulators as required.", "Implemented", "Data Sharing Agreements"),

    # A.9 Use of AI
    ("A.9.2", "Responsible use processes", "Yes", "Ensuring system is not misused (e.g., dual use).", "Implemented", "Acceptable Use Policy (AUP)"),
    ("A.9.3", "Objectives for responsible use", "Yes", "KPIs for ongoing ethical performance.", "Implemented", "Quarterly Ethics Review"),
    ("A.9.4", "Intended use", "Yes", "Defining/limiting the 'Operational Design Domain'.", "Implemented", "Model Card ('Intended Use' section)"),

    # A.10 Third Party
    ("A.10.2", "Allocating responsibilities", "Yes", "Defining who does what (Vendor vs. Us).", "Implemented", "RACI Matrix (External)"),
    ("A.10.3", "Supplier management", "Yes", "Assessing risks of AI vendors/APIs.", "Implemented", "Vendor Trust Assessments (VTA)"),
    ("A.10.4", "Customer management", "Yes", "Ensuring customers use the AI responsibly.", "Implemented", "Customer Contracts / ToS")
]

# Create DataFrame
df = pd.DataFrame(data, columns=["Control ID", "Control Name", "Applicability", "Justification (Example)", "Implementation Status", "Evidence / Reference"])

# Export to Excel
filename = "ISO42001_SoA_Template.xlsx"
df.to_excel(filename, index=False)

print(f"File created: {filename}")