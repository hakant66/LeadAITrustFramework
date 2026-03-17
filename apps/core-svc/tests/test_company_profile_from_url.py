"""
Company Profile From URL Tests

Tests for Search → Scrape → Structure: URL normalization, domain extraction,
and profile_company_from_url with mocked search/scrape/Gemini.
"""

import os
import pytest
from unittest.mock import patch, MagicMock

from app.services.company_profile_from_url import (
    _normalize_url,
    _url_to_domain,
    _search_legal_pages,
    _scrape_url,
    _structure_with_gemini,
    profile_company_from_url,
    CompanyProfile,
)


# --- _normalize_url ---

def test_normalize_url_adds_https():
    assert _normalize_url("example.com") == "https://example.com"
    assert _normalize_url("  example.com  ") == "https://example.com"


def test_normalize_url_leaves_http_https():
    assert _normalize_url("https://example.com") == "https://example.com"
    assert _normalize_url("http://example.com") == "http://example.com"


def test_normalize_url_empty():
    assert _normalize_url("") == "https://"
    assert _normalize_url("   ") == "https://"


# --- _url_to_domain ---

def test_url_to_domain_extracts_netloc():
    assert _url_to_domain("https://www.acme.com/path") == "acme.com"
    assert _url_to_domain("https://acme.com") == "acme.com"


def test_url_to_domain_normalizes_first():
    assert _url_to_domain("acme.com") == "acme.com"


def test_url_to_domain_empty_invalid():
    assert _url_to_domain("") == ""


# --- _search_legal_pages ---

def test_search_legal_pages_no_api_key():
    """Without SERPER_API_KEY returns empty list."""
    with patch("app.services.company_profile_from_url.os.getenv", return_value=None):
        result = _search_legal_pages("example.com")
    assert result == []


def test_search_legal_pages_returns_urls_when_mocked():
    """With API key and mocked httpx returns links."""
    with patch("app.services.company_profile_from_url.os.getenv", return_value="test-key"):
        with patch("app.services.company_profile_from_url.httpx.Client") as mock_client:
            resp = MagicMock()
            resp.json.return_value = {
                "organic": [
                    {"link": "https://example.com/impressum"},
                    {"link": "https://example.com/legal"},
                ]
            }
            resp.raise_for_status = MagicMock()
            mock_client.return_value.__enter__.return_value.post.return_value = resp
            result = _search_legal_pages("example.com")
    assert len(result) <= 5
    assert len(result) >= 1
    assert "example.com" in result[0]


# --- _scrape_url ---

def test_scrape_url_fallback_strips_html():
    """Without Firecrawl API key, fallback HTTP strips script/style and tags."""
    real_getenv = os.getenv
    with patch("app.services.company_profile_from_url.os.getenv") as mock_getenv:
        mock_getenv.side_effect = lambda key, default=None: None if key == "FIRECRAWL_API_KEY" else real_getenv(key, default)
        with patch("app.services.company_profile_from_url.httpx.Client") as mock_client:
            resp = MagicMock()
            resp.text = (
                "<html><script>x</script><body><p>Company Name GmbH</p></body></html>"
            )
            resp.raise_for_status = MagicMock()
            mock_client.return_value.__enter__.return_value.get.return_value = resp
            result = _scrape_url("https://example.com")
    assert result is not None
    assert "Company Name GmbH" in result
    assert "<script>" not in result
    assert "<p>" not in result


def test_scrape_url_returns_none_on_failure():
    with patch("app.services.company_profile_from_url.httpx.Client") as mock_client:
        mock_client.return_value.__enter__.return_value.get.side_effect = Exception("Network error")
        result = _scrape_url("https://example.com")
    assert result is None


# --- _structure_with_gemini ---

def test_structure_with_gemini_no_api_key_returns_none():
    """When GEMINI_API_KEY and GOOGLE_API_KEY are unset, returns None (genai is lazy-imported)."""
    with patch("app.services.company_profile_from_url.os.getenv", return_value=None):
        result = _structure_with_gemini("Some text about Acme Corp")
    assert result is None


def test_structure_with_gemini_import_error_returns_none():
    """When google.generativeai is not installed, returns None."""
    import builtins
    real_import = builtins.__import__

    def fake_import(name, *args, **kwargs):
        if name == "google.generativeai":
            raise ImportError("No module named 'google.generativeai'")
        return real_import(name, *args, **kwargs)

    with patch("app.services.company_profile_from_url.os.getenv", return_value="fake-key"):
        with patch("builtins.__import__", side_effect=fake_import):
            result = _structure_with_gemini("Text")
    assert result is None


# --- profile_company_from_url ---

def test_profile_company_from_url_invalid_url_returns_error():
    result = profile_company_from_url("")
    assert result.get("_error") == "Invalid URL"


def test_profile_company_from_url_invalid_domain_returns_error():
    result = profile_company_from_url("http://")
    assert "_error" in result


@patch("app.services.company_profile_from_url._structure_text")
@patch("app.services.company_profile_from_url._scrape_url")
@patch("app.services.company_profile_from_url._search_legal_pages")
def test_profile_company_from_url_no_scraped_content_returns_error(
    mock_search, mock_scrape, mock_structure_text
):
    mock_search.return_value = []
    mock_scrape.return_value = None
    result = profile_company_from_url("https://example.com")
    assert result.get("_error") == "Could not scrape content from URL"
    mock_structure_text.assert_not_called()


@patch("app.services.company_profile_from_url._structure_text")
@patch("app.services.company_profile_from_url._scrape_url")
@patch("app.services.company_profile_from_url._search_legal_pages")
def test_profile_company_from_url_no_gemini_result_returns_error(
    mock_search, mock_scrape, mock_structure_text
):
    """When structure step returns (None, error), response includes _error."""
    mock_search.return_value = []
    mock_scrape.return_value = "Some company text here."
    mock_structure_text.return_value = (None, "Extraction failed")
    result = profile_company_from_url("https://example.com")
    assert "_error" in result
    assert "unavailable" in result["_error"].lower() or "OPENAI" in result["_error"] or "GEMINI" in result["_error"] or "Extraction failed" in result["_error"]


@patch("app.services.company_profile_from_url._structure_text")
@patch("app.services.company_profile_from_url._scrape_url")
@patch("app.services.company_profile_from_url._search_legal_pages")
def test_profile_company_from_url_success_returns_camelCase(
    mock_search, mock_scrape, mock_structure_text
):
    mock_search.return_value = []
    mock_scrape.return_value = "Acme GmbH is a company in Germany."
    mock_structure_text.return_value = (
        CompanyProfile(
            legal_name="Acme GmbH",
            legal_form="GmbH",
            hq_country="Germany",
            registration_number="HRB 123",
            employee_count_tier="50-249",
            sectors=["Finance"],  # Use canonical sector
            regions=["Germany", "France"],  # Use canonical countries (EU normalizes out)
        ),
        None,  # no error
    )
    result = profile_company_from_url("https://acme.com")
    assert "_error" not in result
    assert result["fullLegalName"] == "Acme GmbH"
    assert result["headquartersCountry"] == "Germany"
    assert result["legalForm"] == "GmbH"
    assert result["website"] == "https://acme.com"
    assert result["sectors"] == ["Finance"]  # Normalized from Finance (canonical)
    # Germany is HQ so it's added to regions; France is normalized
    assert "Germany" in result["regionsOfOperation"]
    assert "France" in result["regionsOfOperation"]
