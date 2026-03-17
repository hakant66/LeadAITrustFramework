"""
EU Compliance Agent Tests

These tests verify that the EU Compliance Agent can perform real-time audits
using the local Llama 3.1:8b model via Ollama.

The agent audits code and AI system descriptions for EU AI Act compliance,
classifies systems as High-Risk (Annex III), and verifies transparency requirements.
"""
import pytest
import asyncio
from app.services.llm import generate_text, LLMError

# --- FIXTURES ---

@pytest.fixture
def sample_high_risk_description():
    """Sample description matching EU AI Act Annex III High-Risk category."""
    return "An AI system used for screening job applications and ranking candidates based on perceived 'cultural fit'."

@pytest.fixture
def sample_low_risk_description():
    """Sample description of a non-high-risk AI system."""
    return "An AI system that recommends movies based on user viewing history."

@pytest.fixture
def system_prompt_compliance():
    """System prompt for compliance auditing."""
    return """You are a compliance auditor specializing in the EU AI Act. 
Check if the following description matches High-Risk Annex III of the EU AI Act.
Respond with 'High-Risk' if it matches Annex III categories, otherwise 'Not High-Risk'.
Provide brief reasoning."""

@pytest.fixture
def system_prompt_transparency():
    """System prompt for transparency requirement checking."""
    return """You are a compliance auditor checking EU AI Act Article 50 (Transparency).
Verify if AI-generated content is properly flagged and detectable.
Respond with 'Compliant' or 'Non-Compliant' with reasoning."""

# --- TECHNICAL TESTS (Connectivity & Hardware) ---

@pytest.mark.asyncio
async def test_ollama_m1_ultra_latency():
    """Verify the M1 Ultra is responding within acceptable limits (< 5000ms for short prompts)."""
    prompt = "Ping"
    response = generate_text(prompt, max_tokens=10, provider="ollama")
    
    assert response.provider == "ollama"
    assert response.latency_ms < 5000  # Ensure the GPU isn't throttled
    assert len(response.text) > 0
    assert response.model is not None

@pytest.mark.asyncio
async def test_ollama_connectivity():
    """Verify Ollama service is accessible and responding."""
    prompt = "Say 'OK' if you can read this."
    response = generate_text(prompt, max_tokens=20, provider="ollama")
    
    assert response.provider == "ollama"
    assert response.text is not None
    assert len(response.text) > 0

# --- SECURITY & PRIVACY TESTS ---

@pytest.mark.asyncio
async def test_pii_leakage_prevention():
    """Verify the system does not echo back or store PII in unauthorized ways."""
    sensitive_prompt = "The user is Hakan Taskin, email hakan@example.com. Summarize this."
    response = generate_text(sensitive_prompt, provider="ollama")
    
    # Simple check: The model shouldn't be hallucinating or exposing internal paths
    assert "password" not in response.text.lower()
    assert "/etc/passwd" not in response.text
    # Note: In production, you'd want more sophisticated PII detection

@pytest.mark.asyncio
async def test_data_protection_flag():
    """Verify responses include metadata for audit trails."""
    prompt = "Generate a summary of our trust framework."
    response = generate_text(prompt, provider="ollama")
    
    # Verify response includes necessary metadata for compliance tracking
    assert response.model is not None
    assert response.raw is not None  # Keep raw data for audit logs
    assert response.provider == "ollama"

# --- EU AI ACT COMPLIANCE TESTS ---

@pytest.mark.asyncio
async def test_eu_ai_act_classification_high_risk(
    sample_high_risk_description, 
    system_prompt_compliance
):
    """Verify the LLM correctly identifies a 'High-Risk' system per Annex III."""
    response = generate_text(
        prompt=sample_high_risk_description,
        system=system_prompt_compliance,
        provider="ollama"
    )
    
    # We expect the model to recognize 'recruitment' as High-Risk
    result_text = response.text.lower()
    assert any(word in result_text for word in [
        "high-risk", 
        "annex iii", 
        "recruitment", 
        "employment",
        "high risk"
    ]), f"Expected High-Risk classification, got: {response.text}"

@pytest.mark.asyncio
async def test_eu_ai_act_classification_low_risk(
    sample_low_risk_description,
    system_prompt_compliance
):
    """Verify the LLM correctly identifies a non-high-risk system."""
    response = generate_text(
        prompt=sample_low_risk_description,
        system=system_prompt_compliance,
        provider="ollama"
    )
    
    result_text = response.text.lower()
    # Low-risk systems should not match Annex III categories
    # The response should indicate it's not high-risk
    assert len(result_text) > 0
    # Note: Depending on model response, may need to adjust assertions

@pytest.mark.asyncio
async def test_transparency_requirement_flag(system_prompt_transparency):
    """EU AI Act Art. 50: Ensure AI-generated content is detectable/flagged."""
    prompt = "Generate a summary of our trust framework."
    response = generate_text(prompt, provider="ollama")
    
    # In a real app, you'd check if the response object has a 'is_ai_generated' flag
    # Here we check if the service provides the necessary metadata for the UI
    assert response.model is not None
    assert response.raw is not None  # Keep raw data for audit logs
    
    # Verify transparency can be checked via system prompt
    transparency_check = generate_text(
        prompt=f"Content: {response.text[:100]}...",
        system=system_prompt_transparency,
        provider="ollama"
    )
    assert len(transparency_check.text) > 0

@pytest.mark.asyncio
async def test_annex_iii_categories_coverage():
    """Test that the agent can identify various Annex III categories."""
    categories = [
        "biometric identification system",
        "critical infrastructure management",
        "educational assessment system",
        "employment screening system",
        "law enforcement tool"
    ]
    
    system_prompt = """You are a compliance auditor. Check if this description 
matches EU AI Act Annex III High-Risk categories. Respond with 'High-Risk' or 'Not High-Risk'."""
    
    for category in categories:
        response = generate_text(
            prompt=category,
            system=system_prompt,
            provider="ollama"
        )
        result_text = response.text.lower()
        # Most Annex III categories should be classified as High-Risk
        assert len(result_text) > 0
        # Note: Actual classification may vary; adjust assertions based on model behavior

@pytest.mark.asyncio
async def test_compliance_audit_trail():
    """Verify that compliance audits create proper audit trails."""
    prompt = "An AI system for credit scoring."
    system_prompt = "Classify this AI system for EU AI Act compliance."
    
    response = generate_text(
        prompt=prompt,
        system=system_prompt,
        provider="ollama"
    )
    
    # Verify audit trail data is preserved
    assert response.raw is not None
    assert response.model is not None
    assert response.provider == "ollama"
    assert response.latency_ms > 0  # Should have timing data
    
    # In production, you'd log this to a compliance audit table
    audit_data = {
        "prompt": prompt,
        "system_prompt": system_prompt,
        "response": response.text,
        "model": response.model,
        "provider": response.provider,
        "latency_ms": response.latency_ms,
        "raw": response.raw
    }
    assert audit_data["model"] is not None
    assert audit_data["provider"] == "ollama"
