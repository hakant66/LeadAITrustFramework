"""
LeadAI Company Profiling: Search → Scrape → Structure.

Step 1: Search for legal/Impressum pages (Serper).
Step 2: Scrape content (Firecrawl or fallback HTTP).
Step 3: Structure with OpenAI (from .env) or Gemini into CompanyProfile JSON.
"""
from __future__ import annotations

import json
import io
import logging
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin, urlparse

import httpx
from pydantic import BaseModel, Field
from pypdf import PdfReader

logger = logging.getLogger(__name__)

# Load .env so OPENAI_API_KEY, SERPER_API_KEY (and optional FIRECRAWL_API_KEY) are available
try:
    from dotenv import load_dotenv
    _env_path = Path(__file__).resolve().parent.parent.parent / ".env"
    if _env_path.exists():
        load_dotenv(_env_path)
    load_dotenv()  # also cwd / project root
except ImportError:
    pass

# Firecrawl and Gemini are lazy-imported where used to avoid startup warnings.


class CompanyProfile(BaseModel):
    """Schema for structured extraction (OpenAI or Gemini)."""

    legal_name: str = Field(description="Full legal name of the entity")
    legal_form: str = Field(default="", description="Legal form, e.g., LLC, GmbH, Anonim Şirket")
    hq_country: str = Field(description="Country of the main headquarters")
    registration_number: Optional[str] = Field(default=None, description="Company trade registry or VAT ID")
    employee_count_tier: str = Field(
        default="",
        description="One of: 1-9, 10-49, 50-249, 250-999, 1000+",
    )
    annual_turnover: Optional[str] = Field(default=None, description="Revenue/turnover e.g. €1M, $5M")
    market_role: Optional[str] = Field(default=None, description="One of: Provider, Deployer, Importer, Distributor")
    sectors: List[str] = Field(default_factory=list, description="Industry sectors (Finance, Health, etc.)")
    regions: List[str] = Field(default_factory=list, description="Countries or regions where they operate")
    # Key compliance personnel (from Impressum, Legal, Contact, DPO/Privacy pages)
    authorized_representative_name: Optional[str] = Field(default=None, description="EU legal contact / Authorized Representative name")
    authorized_representative_email: Optional[str] = Field(default=None, description="Authorized Representative email")
    authorized_representative_phone: Optional[str] = Field(default=None, description="Authorized Representative phone")
    ai_compliance_officer_name: Optional[str] = Field(default=None, description="AI Compliance Officer or DPO name")
    ai_compliance_officer_email: Optional[str] = Field(default=None, description="AI Compliance Officer or DPO email")
    executive_sponsor_name: Optional[str] = Field(default=None, description="Executive / C-level sponsor name")
    executive_sponsor_email: Optional[str] = Field(default=None, description="Executive sponsor email")


# Canonical values that match the entity form options (for normalization)
_CANONICAL_SECTORS = frozenset({
    "Automotive", "Biometrics", "Consumer Services", "Critical Infrastructure", "Cybersecurity",
    "Education", "Energy", "Finance", "Government & Public Service",
    "Healthcare", "Hiring", "Insurance", "Justice",
    "Law Enforcement", "Manufacturing", "Migration & Border Control", "Retail", "Transport", "Other",
})
_SECTOR_ALIASES = {
    "automotive": "Automotive", "auto": "Automotive", "vehicle": "Automotive",
    "biometrics": "Biometrics", "biometric": "Biometrics", "biometric identification": "Biometrics",
    "consumer services": "Consumer Services", "consumer": "Consumer Services", "consumer service": "Consumer Services",
    "health": "Healthcare", "healthcare": "Healthcare", "medical": "Healthcare",
    "finance": "Finance", "financial": "Finance", "banking": "Finance",
    "critical infrastructure": "Critical Infrastructure", "infrastructure": "Critical Infrastructure",
    "cybersecurity": "Cybersecurity", "cyber security": "Cybersecurity", "information security": "Cybersecurity", "infosec": "Cybersecurity",
    "education": "Education", "edtech": "Education",
    "transport": "Transport", "transportation": "Transport", "logistics": "Transport",
    "energy": "Energy", "utilities": "Energy",
    "government": "Government & Public Service", "public services": "Government & Public Service", "public sector": "Government & Public Service", "public service": "Government & Public Service",
    "hiring": "Hiring", "recruitment": "Hiring", "recruiting": "Hiring", "hr": "Hiring", "human resources": "Hiring",
    "insurance": "Insurance", "insurer": "Insurance",
    "justice": "Justice", "judicial": "Justice", "courts": "Justice",
    "law enforcement": "Law Enforcement", "police": "Law Enforcement", "policing": "Law Enforcement",
    "manufacturing": "Manufacturing", "manufacturer": "Manufacturing", "production": "Manufacturing", "industrial": "Manufacturing",
    "migration": "Migration & Border Control", "border control": "Migration & Border Control", "immigration": "Migration & Border Control", "border": "Migration & Border Control",
    "retail": "Retail", "retailing": "Retail", "retailer": "Retail",
    "other": "Other", "technology": "Other", "tech": "Other",
}
_CANONICAL_COUNTRIES = frozenset({
    "Global",  # Special region indicating worldwide operations
    "Austria", "Belgium", "Bulgaria", "Croatia", "Cyprus", "Czech Republic",
    "Denmark", "Estonia", "Finland", "France", "Germany", "Greece", "Hungary",
    "Ireland", "Italy", "Latvia", "Lithuania", "Luxembourg", "Malta", "Netherlands",
    "Poland", "Portugal", "Romania", "Slovakia", "Slovenia", "Spain", "Sweden",
    "Saudi Arabia", "United Arab Emirates", "Qatar", "Egypt", "Bahrain", "Israel", "Kuwait",
    "United States", "United Kingdom",
    "Turkey", "Switzerland", "Norway",
    "Canada", "Australia", "Japan", "China",  # Additional countries from the form
})
_COUNTRY_ALIASES = {
    "at": "Austria", "be": "Belgium", "bg": "Bulgaria", "hr": "Croatia", "cy": "Cyprus",
    "cz": "Czech Republic", "czechia": "Czech Republic", "dk": "Denmark", "ee": "Estonia",
    "fi": "Finland", "fr": "France", "de": "Germany", "gr": "Greece", "hu": "Hungary",
    "ie": "Ireland", "it": "Italy", "lv": "Latvia", "lt": "Lithuania", "lu": "Luxembourg",
    "mt": "Malta", "nl": "Netherlands", "pl": "Poland", "pt": "Portugal", "ro": "Romania",
    "sk": "Slovakia", "si": "Slovenia", "es": "Spain", "se": "Sweden",
    "saudi": "Saudi Arabia", "ksa": "Saudi Arabia", "uae": "United Arab Emirates",
    "us": "United States", "usa": "United States", "uk": "United Kingdom", "gb": "United Kingdom",
    "britain": "United Kingdom", "england": "United Kingdom",
    "turkey": "Turkey", "turkiye": "Turkey", "tr": "Turkey",
    "switzerland": "Switzerland", "ch": "Switzerland", "norway": "Norway", "no": "Norway",
}


def _normalize_sectors(raw: List[str]) -> List[str]:
    """Map LLM sector output to exact form option values."""
    out: List[str] = []
    seen: set = set()
    for s in (raw or []):
        key = (s or "").strip()
        if not key:
            continue
        key_lower = key.lower()
        if key in _CANONICAL_SECTORS and key not in seen:
            out.append(key)
            seen.add(key)
        elif key_lower in _SECTOR_ALIASES:
            canonical = _SECTOR_ALIASES[key_lower]
            if canonical not in seen:
                out.append(canonical)
                seen.add(canonical)
        else:
            for alias, canonical in _SECTOR_ALIASES.items():
                if alias in key_lower or key_lower in alias:
                    if canonical not in seen:
                        out.append(canonical)
                        seen.add(canonical)
                    break
    return out


def _normalize_market_role(raw: Optional[str]) -> str:
    """Map LLM output to form dropdown: Provider, Deployer, Importer, Distributor."""
    if not raw or not (key := (raw or "").strip()):
        return ""
    key_lower = key.lower()
    for canonical in ("Provider", "Deployer", "Importer", "Distributor"):
        if canonical.lower() in key_lower or key_lower in canonical.lower():
            return canonical
    return ""


def _normalize_regions(raw: List[str]) -> List[str]:
    """Map LLM region/country output to exact form country names."""
    out: List[str] = []
    seen: set = set()
    for r in (raw or []):
        key = (r or "").strip()
        if not key:
            continue
        key_lower = key.lower()
        if key in _CANONICAL_COUNTRIES and key not in seen:
            out.append(key)
            seen.add(key)
        elif key_lower in _COUNTRY_ALIASES:
            canonical = _COUNTRY_ALIASES[key_lower]
            if canonical not in seen:
                out.append(canonical)
                seen.add(canonical)
        else:
            for alias, canonical in _COUNTRY_ALIASES.items():
                if alias in key_lower or key_lower in alias:
                    if canonical not in seen:
                        out.append(canonical)
                        seen.add(canonical)
                    break
    return out


def _normalize_url(url: str) -> str:
    url = (url or "").strip()
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    return url


def _url_to_domain(url: str) -> str:
    try:
        parsed = urlparse(_normalize_url(url))
        netloc = parsed.netloc or ""
        return netloc.lower().lstrip("www.")
    except Exception:
        return ""


def _score_candidate_url(url: str) -> int:
    """Prefer legal/privacy/about pages and PDFs over generic homepages."""
    normalized = _normalize_url(url).lower()
    score = 0
    if any(segment in normalized for segment in ("/about-us", "/about", "/company", "/contact")):
        score += 45
    if normalized.endswith(".pdf"):
        score += 8
    for needle, weight in (
        ("privacy", 6),
        ("legal", 6),
        ("notice", 3),
        ("impressum", 10),
        ("about", 8),
        ("company", 8),
        ("contact", 8),
        ("kvkk", 10),
    ):
        if needle in normalized:
            score += weight
    path = urlparse(normalized).path.strip("/")
    if not path:
        score -= 20
    return score


def _same_registered_site(candidate_url: str, root_domain: str) -> bool:
    host = (urlparse(_normalize_url(candidate_url)).netloc or "").lower().lstrip("www.")
    return host == root_domain or host.endswith(f".{root_domain}")


def _build_candidate_urls(url: str, search_urls: List[str]) -> List[str]:
    """Prefer first-party about/contact pages before search results and penalize regional CDN docs."""
    normalized_url = _normalize_url(url)
    parsed = urlparse(normalized_url)
    root_domain = (parsed.netloc or "").lower().lstrip("www.")
    seed_candidates = [
        normalized_url,
        f"{parsed.scheme}://{parsed.netloc}/about-us",
        f"{parsed.scheme}://{parsed.netloc}/en/about-us",
        f"{parsed.scheme}://{parsed.netloc}/contact",
        f"{parsed.scheme}://{parsed.netloc}/en/contact",
        f"{parsed.scheme}://{parsed.netloc}/about",
        f"{parsed.scheme}://{parsed.netloc}/company",
    ]

    deduped: List[str] = []
    for candidate in [*seed_candidates, *search_urls]:
        if candidate and candidate not in deduped:
            deduped.append(candidate)

    def sort_key(candidate: str) -> tuple[int, int]:
        normalized = _normalize_url(candidate).lower()
        score = _score_candidate_url(candidate)
        if _same_registered_site(candidate, root_domain):
            score += 25
        if "/cdn." in normalized or normalized.startswith("https://cdn."):
            score -= 30
        if "/eu/" in normalized or "spain" in normalized:
            score -= 25
        if normalized.endswith(".pdf"):
            score -= 10
        return (score, -deduped.index(candidate))

    return sorted(deduped, key=sort_key, reverse=True)


def _search_legal_pages(domain: str) -> List[str]:
    """Step 1: Search for Impressum / Legal / Privacy Policy pages via Serper."""
    api_key = os.getenv("SERPER_API_KEY")
    if not api_key:
        return []

    query = f'site:{domain} "Impressum" OR "Legal" OR "Privacy Policy" OR "About us" OR "Company"'
    headers = {"X-API-KEY": api_key, "Content-Type": "application/json"}
    payload = {"q": query, "num": 5}

    try:
        with httpx.Client(timeout=15.0) as client:
            r = client.post(
                "https://google.serper.dev/search",
                json=payload,
                headers=headers,
            )
            r.raise_for_status()
            data = r.json()
    except Exception:
        return []

    urls: List[str] = []
    for item in (data.get("organic") or data.get("results") or []):
        link = item.get("link") if isinstance(item, dict) else None
        if link and link not in urls:
            urls.append(link)
    return urls[:5]


def _search_company_snippets(domain: str) -> List[str]:
    """Fetch organic search snippets to add company-level context when pages are challenge-protected."""
    api_key = os.getenv("SERPER_API_KEY")
    if not api_key:
        return []

    query = f'site:{domain} company OR "about us" OR "central bank" OR "electronic money"'
    headers = {"X-API-KEY": api_key, "Content-Type": "application/json"}
    payload = {"q": query, "num": 5}

    try:
        with httpx.Client(timeout=15.0) as client:
            r = client.post(
                "https://google.serper.dev/search",
                json=payload,
                headers=headers,
            )
            r.raise_for_status()
            data = r.json()
    except Exception:
        return []

    snippets: List[str] = []
    for item in (data.get("organic") or data.get("results") or []):
        if not isinstance(item, dict):
            continue
        title = (item.get("title") or "").strip()
        snippet = (item.get("snippet") or "").strip()
        if title or snippet:
            snippets.append(" - ".join(part for part in (title, snippet) if part))
    return snippets[:5]


def _looks_like_block_page(text: str) -> bool:
    lowered = (text or "").lower()
    block_markers = (
        "enable javascript and cookies to continue",
        "güvenlik kontrolünü tamamlayın",
        "bir adım daha kaldı",
        "security check",
        "access denied",
        "captcha",
        "cloudflare",
        "challenge",
    )
    return any(marker in lowered for marker in block_markers)


def _extract_tag_attrs(tag_html: str) -> Dict[str, str]:
    attrs: Dict[str, str] = {}
    for key, value in re.findall(r'([a-zA-Z:_-]+)\s*=\s*["\']([^"\']+)["\']', tag_html):
        attrs[key.lower()] = value
    return attrs


def _extract_logo_candidates_from_html(base_url: str, html: str) -> List[str]:
    candidates: List[str] = []
    for match in re.finditer(r"<meta\b[^>]*>", html, flags=re.IGNORECASE):
        attrs = _extract_tag_attrs(match.group(0))
        content = (attrs.get("content") or "").strip()
        property_name = (attrs.get("property") or attrs.get("name") or "").strip().lower()
        if content and property_name in {"og:image", "og:image:secure_url", "twitter:image", "twitter:image:src"}:
            resolved = urljoin(base_url, content)
            if not content.startswith("data:") and resolved not in candidates:
                candidates.append(resolved)

    for match in re.finditer(r"<link\b[^>]*>", html, flags=re.IGNORECASE):
        attrs = _extract_tag_attrs(match.group(0))
        rel = (attrs.get("rel") or "").lower()
        href = (attrs.get("href") or "").strip()
        if href and any(token in rel for token in ("apple-touch-icon", "mask-icon", "icon", "shortcut icon")):
            resolved = urljoin(base_url, href)
            if not href.startswith("data:") and resolved not in candidates:
                candidates.append(resolved)

    for match in re.finditer(r"<img\b[^>]*>", html, flags=re.IGNORECASE):
        attrs = _extract_tag_attrs(match.group(0))
        src = (attrs.get("src") or "").strip()
        hint = " ".join(filter(None, [attrs.get("class"), attrs.get("id"), attrs.get("alt")])).lower()
        if src and "logo" in hint:
            resolved = urljoin(base_url, src)
            if not src.startswith("data:") and resolved not in candidates:
                candidates.append(resolved)
    return candidates


def _score_logo_candidate(candidate_url: str, root_domain: str) -> int:
    normalized = _normalize_url(candidate_url).lower()
    parsed = urlparse(normalized)
    host = (parsed.netloc or "").lower().lstrip("www.")
    path = parsed.path.lower()
    score = 0
    if host == root_domain or host.endswith(f".{root_domain}"):
        score += 40
    if "logo" in path:
        score += 35
    if "brand" in path:
        score += 15
    if any(path.endswith(ext) for ext in (".svg", ".png", ".webp")):
        score += 12
    if "favicon" in path:
        score -= 10
    if any(part in path for part in ("/apple-touch-icon", "/mask-icon")):
        score -= 3
    if parsed.query:
        score -= 1
    return score


def _discover_logo_url(url: str) -> Optional[str]:
    base_url = _normalize_url(url)
    root_domain = _url_to_domain(base_url)
    try:
        with httpx.Client(timeout=15.0, follow_redirects=True) as client:
            response = client.get(
                base_url,
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/122.0.0.0 Safari/537.36"
                    ),
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.9",
                },
            )
    except Exception:
        return None

    content_type = (response.headers.get("content-type") or "").lower()
    if "text/html" not in content_type:
        return None
    html = response.text or ""
    if not html:
        return None

    candidates = _extract_logo_candidates_from_html(str(response.url), html)
    if not candidates:
        return None
    return max(candidates, key=lambda candidate: _score_logo_candidate(candidate, root_domain))


def _scrape_url(url: str) -> Optional[str]:
    """Step 2: Scrape URL to markdown/text. Prefer Firecrawl; fallback to HTTP."""
    url = _normalize_url(url)
    markdown: Optional[str] = None

    # Prefer Firecrawl (lazy import to avoid pydantic warning at startup)
    firecrawl_key = os.getenv("FIRECRAWL_API_KEY")
    if firecrawl_key:
        try:
            import warnings
            with warnings.catch_warnings(action="ignore"):
                from firecrawl import FirecrawlApp
            app = FirecrawlApp(api_key=firecrawl_key)
            result = app.scrape_url(url, params={"formats": ["markdown"]})
            if isinstance(result, dict):
                markdown = result.get("markdown") or result.get("content")
            elif hasattr(result, "markdown"):
                markdown = getattr(result, "markdown", None)
        except Exception:
            pass

    # Fallback: fetch HTML and strip tags for raw text
    if not markdown:
        try:
            with httpx.Client(timeout=15.0, follow_redirects=True) as client:
                r = client.get(
                    url,
                    headers={
                        "User-Agent": (
                            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                            "AppleWebKit/537.36 (KHTML, like Gecko) "
                            "Chrome/122.0.0.0 Safari/537.36"
                        ),
                        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                        "Accept-Language": "en-US,en;q=0.9",
                    },
                )
            content_type = (r.headers.get("content-type") or "").lower()
            is_pdf = url.lower().endswith(".pdf") or "application/pdf" in content_type
            if is_pdf:
                reader = PdfReader(io.BytesIO(r.content))
                pdf_text_parts = [
                    (page.extract_text() or "").strip()
                    for page in reader.pages
                ]
                markdown = "\n\n".join(part for part in pdf_text_parts if part).strip()[:20000]
            else:
                html = r.text
                if not html or len(html.strip()) < 200:
                    return None
                # Minimal strip: remove script/style, then tags
                html = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.DOTALL | re.IGNORECASE)
                html = re.sub(r"<style[^>]*>.*?</style>", "", html, flags=re.DOTALL | re.IGNORECASE)
                markdown = re.sub(r"<[^>]+>", " ", html)
                markdown = re.sub(r"\s+", " ", markdown).strip()[:20000]
                if _looks_like_block_page(markdown):
                    return None
        except Exception:
            return None

    return markdown


_EXTRACTION_PROMPT = """
Act as a LeadAI Compliance Officer. Extract company details from the text below (Impressum, Legal, About, Contact, Privacy/DPO pages).
Return ONLY a flat JSON object (NOT nested) with these exact top-level keys (use empty string, null, or empty array if unknown):

{
  "legal_name": "string (full legal name of the company)",
  "legal_form": "string (e.g., LLC, GmbH, Ltd., A.Ş., Anonim Şirket)",
  "hq_country": "string (headquarters country; full name e.g. 'Germany', 'Turkey', 'United States')",
  "registration_number": "string or null — IMPORTANT: extract any company/trade registry number, VAT ID, tax number, LEI, or commercial register number",
  "employee_count_tier": "string, exactly one of '1-9', '10-49', '50-249', '250-999', '1000+' or ''",
  "annual_turnover": "string or null — IMPORTANT: Extract annual revenue/turnover if mentioned (look for 'revenue', 'turnover', 'sales', 'annual revenue', '€X million', '$X billion', etc.). Format as found (e.g. '€1M', '$5M', '10M EUR', '2.5 billion USD') or null if not found",
  "market_role": "string or null, one of 'Provider', 'Deployer', 'Importer', 'Distributor'",
  "sectors": ["array of strings. Use ONLY these exact values: 'Automotive', 'Biometrics', 'Consumer Services', 'Critical Infrastructure', 'Cybersecurity', 'Education', 'Energy', 'Finance', 'Government & Public Service', 'Healthcare', 'Hiring', 'Insurance', 'Justice', 'Law Enforcement', 'Manufacturing', 'Migration & Border Control', 'Retail', 'Transport', 'Other'. Infer from services, industries, 'we serve X', 'sector Y'; map Technology/Consulting to 'Other'. Pick all that apply."],
  "regions": ["array of full country names e.g. 'Global', 'United States', 'Germany', 'Turkey'. Use 'Global' if the company operates worldwide/internationally across multiple regions."],
  "authorized_representative_name": "string or null",
  "authorized_representative_email": "string or null",
  "authorized_representative_phone": "string or null",
  "ai_compliance_officer_name": "string or null",
  "ai_compliance_officer_email": "string or null",
  "executive_sponsor_name": "string or null",
  "executive_sponsor_email": "string or null"
}

CRITICAL: Return a FLAT JSON object with all keys at the top level. Do NOT nest keys under categories like "core_identity" or "size_and_role".
CRITICAL: If the sources mention multiple legal entities or regional affiliates, prefer the primary company operating the root website/domain the user entered. Do not switch to a country subsidiary unless the input URL itself points to that subsidiary.

Text:
"""


def _flatten_nested_profile(data: Dict[str, Any]) -> Dict[str, Any]:
    """Transform nested JSON structure to flat CompanyProfile structure."""
    flat: Dict[str, Any] = {}
    
    # Handle core_identity nested structure
    if "core_identity" in data:
        ci = data["core_identity"]
        # Normalize None to empty string for required string fields
        flat["legal_name"] = ci.get("legal_name") or ""
        flat["legal_form"] = ci.get("legal_form") or ""
        flat["hq_country"] = ci.get("hq_country") or ""
        flat["registration_number"] = ci.get("registration_number")
    
    # Handle size_and_role nested structure
    if "size_and_role" in data:
        sar = data["size_and_role"]
        # Normalize None to empty string for required string fields
        flat["employee_count_tier"] = sar.get("employee_count_tier") or ""
        flat["annual_turnover"] = sar.get("annual_turnover")
        flat["market_role"] = sar.get("market_role")
    
    # Handle scope nested structure
    if "scope" in data:
        scope = data["scope"]
        flat["sectors"] = scope.get("sectors", [])
        flat["regions"] = scope.get("regions", [])
    
    # Handle compliance_contacts nested structure
    if "compliance_contacts" in data:
        cc = data["compliance_contacts"]
        flat["authorized_representative_name"] = cc.get("authorized_representative_name")
        flat["authorized_representative_email"] = cc.get("authorized_representative_email")
        flat["authorized_representative_phone"] = cc.get("authorized_representative_phone")
        flat["ai_compliance_officer_name"] = cc.get("ai_compliance_officer_name")
        flat["ai_compliance_officer_email"] = cc.get("ai_compliance_officer_email")
        flat["executive_sponsor_name"] = cc.get("executive_sponsor_name")
        flat["executive_sponsor_email"] = cc.get("executive_sponsor_email")
    
    # If already flat structure, return as-is (merge with any nested values)
    for key in ["legal_name", "legal_form", "hq_country", "registration_number", 
                "employee_count_tier", "annual_turnover", "market_role",
                "sectors", "regions", "authorized_representative_name",
                "authorized_representative_email", "authorized_representative_phone",
                "ai_compliance_officer_name", "ai_compliance_officer_email",
                "executive_sponsor_name", "executive_sponsor_email"]:
        if key in data and key not in flat:
            value = data[key]
            # Normalize None to empty string for required string fields
            if value is None and key in ["legal_name", "legal_form", "hq_country", "employee_count_tier"]:
                value = ""
            flat[key] = value
    
    return flat


def _normalize_none_to_empty_strings(data: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize None values to empty strings for string fields that require strings."""
    # Fields that should be strings (not Optional[str])
    string_fields = ["legal_name", "legal_form", "hq_country", "employee_count_tier"]
    normalized = data.copy()
    for field in string_fields:
        if field in normalized and normalized[field] is None:
            normalized[field] = ""
    return normalized


def _parse_structured_out(out: str) -> tuple[Optional[CompanyProfile], Optional[str]]:
    """Parse JSON from model output (strip markdown code blocks if present). Returns (profile, error_message)."""
    if not out:
        return (None, "Empty response from LLM")
    original_out = out
    out = out.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    try:
        data = json.loads(out)
        # Flatten nested structure if present
        flat_data = _flatten_nested_profile(data)
        # Normalize None values to empty strings for required string fields
        flat_data = _normalize_none_to_empty_strings(flat_data)
        profile = CompanyProfile(**flat_data)
        return (profile, None)
    except json.JSONDecodeError as e:
        error_msg = f"Invalid JSON from LLM: {str(e)[:200]}"
        logger.warning("JSON parse error. Raw response (first 500 chars): %s", original_out[:500])
        return (None, error_msg)
    except Exception as e:
        error_msg = f"Profile validation error: {type(e).__name__}: {str(e)[:200]}"
        logger.warning("Profile validation failed. Raw response (first 500 chars): %s", original_out[:500])
        logger.warning("Parsed data (first 1000 chars): %s", json.dumps(data, indent=2)[:1000] if 'data' in locals() else "N/A")
        return (None, error_msg)


def _structure_with_openai(text: str) -> tuple[Optional[CompanyProfile], Optional[str]]:
    """Step 3: Use OpenAI to extract structured CompanyProfile from text. Returns (profile, error_message)."""
    api_key = (os.getenv("OPENAI_API_KEY") or "").strip()
    if not api_key:
        return (None, None)
    base_url = (os.getenv("OPENAI_BASE_URL") or "https://api.openai.com/v1").rstrip("/")
    model = os.getenv("OPENAI_MODEL") or "gpt-4o-mini"
    try:
        with httpx.Client(timeout=60.0) as client:
            r = client.post(
                f"{base_url}/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": "You extract structured company/entity data. Reply only with valid JSON."},
                        {"role": "user", "content": _EXTRACTION_PROMPT + text[:15000]},
                    ],
                    "response_format": {"type": "json_object"},
                },
            )
            r.raise_for_status()
            data = r.json()
        choice = (data.get("choices") or [{}])[0]
        out = (choice.get("message") or {}).get("content") or ""
        usage = None
        if isinstance(data.get("usage"), dict):
            usage = {
                "input": data["usage"].get("prompt_tokens"),
                "output": data["usage"].get("completion_tokens"),
                "total": data["usage"].get("total_tokens"),
            }

        try:
            from app.services.langfuse_tracing import log_llm_generation

            log_llm_generation(
                trace_name="company_profile_extract",
                model=model,
                provider="openai",
                prompt=_EXTRACTION_PROMPT + text[:15000],
                output=out,
                usage=usage,
                metadata={
                    "source": "company_profile_from_url",
                },
            )
        except Exception:
            pass
        if not out:
            return (None, "OpenAI returned empty response")
        profile, parse_error = _parse_structured_out(out)
        if profile:
            return (profile, None)
        return (None, parse_error or "OpenAI returned invalid profile structure")
    except httpx.HTTPStatusError as e:
        logger.warning("OpenAI API HTTP error: %s %s", e.response.status_code, e.response.text[:500])
        raise
    except Exception as e:
        logger.warning("OpenAI API request failed: %s", e, exc_info=True)
        raise


def _structure_with_gemini(text: str) -> tuple[Optional[CompanyProfile], Optional[str]]:
    """Step 3: Use Gemini to extract structured CompanyProfile from text (lazy import to avoid deprecation warning when using OpenAI)."""
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        return (None, None)
    try:
        import warnings
        with warnings.catch_warnings(action="ignore", category=FutureWarning):
            import google.generativeai as genai
    except ImportError:
        return (None, "Gemini library not installed (google-generativeai)")
    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")
        response = model.generate_content(_EXTRACTION_PROMPT + text[:15000])
        out = response.text if hasattr(response, "text") else ""
        if not out and getattr(response, "candidates", None):
            part = response.candidates[0].content.parts[0]
            out = getattr(part, "text", "") or str(part)
        if not out:
            return (None, "Gemini returned empty response")
        try:
            from app.services.langfuse_tracing import log_llm_generation

            log_llm_generation(
                trace_name="company_profile_extract",
                model="gemini-1.5-flash",
                provider="gemini",
                prompt=_EXTRACTION_PROMPT + text[:15000],
                output=out,
                usage=None,
                metadata={
                    "source": "company_profile_from_url",
                },
            )
        except Exception:
            pass
        profile, parse_error = _parse_structured_out(out)
        if profile:
            return (profile, None)
        return (None, parse_error or "Gemini returned invalid JSON response")
    except Exception as e:
        error_msg = f"Gemini API: {type(e).__name__}: {str(e)[:200]}"
        logger.warning("Gemini API request failed: %s", e, exc_info=True)
        return (None, error_msg)


def check_llm_config() -> Dict[str, Any]:
    """
    Verify that at least one LLM provider (OpenAI or Gemini) is configured and reachable.
    Returns {"ok": True, "provider": "openai"|"gemini"} or {"ok": False, "error": "..."}.
    """
    api_key = (os.getenv("OPENAI_API_KEY") or "").strip()
    if api_key:
        base_url = (os.getenv("OPENAI_BASE_URL") or "https://api.openai.com/v1").rstrip("/")
        model = os.getenv("OPENAI_MODEL") or "gpt-4o-mini"
        try:
            with httpx.Client(timeout=15.0) as client:
                r = client.post(
                    f"{base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json={
                        "model": model,
                        "messages": [{"role": "user", "content": "Say OK"}],
                        "max_tokens": 5,
                    },
                )
                r.raise_for_status()
            return {"ok": True, "provider": "openai", "model": model}
        except httpx.HTTPStatusError as e:
            msg = f"OpenAI {e.response.status_code}"
            if e.response.status_code == 401:
                msg += " (invalid or expired API key)"
            else:
                try:
                    body = e.response.json()
                    err = body.get("error", {}) if isinstance(body, dict) else {}
                    err_msg = err.get("message", "") if isinstance(err, dict) else ""
                    if err_msg:
                        msg += f": {str(err_msg)[:150]}"
                except Exception:
                    pass
            return {"ok": False, "error": msg}
        except Exception as e:
            return {"ok": False, "error": f"OpenAI: {type(e).__name__} — {str(e)[:150]}"}

    api_key = (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or "").strip()
    if api_key:
        try:
            import warnings
            with warnings.catch_warnings(action="ignore", category=FutureWarning):
                import google.generativeai as genai
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel("gemini-1.5-flash")
            response = model.generate_content("Say OK")
            _ = response.text
            return {"ok": True, "provider": "gemini", "model": "gemini-1.5-flash"}
        except Exception as e:
            return {"ok": False, "error": f"Gemini: {type(e).__name__} — {str(e)[:150]}"}

    return {
        "ok": False,
        "error": "Set OPENAI_API_KEY or GEMINI_API_KEY in .env and restart core-svc.",
    }


def _structure_text(text: str) -> tuple[Optional[CompanyProfile], Optional[str]]:
    """Step 3: Use OpenAI if configured, else Gemini. Returns (profile, error_message)."""
    errors: List[str] = []
    
    # Try OpenAI first if configured
    if (os.getenv("OPENAI_API_KEY") or "").strip():
        try:
            profile, openai_error = _structure_with_openai(text)
            if profile is not None:
                return (profile, None)
            if openai_error:
                errors.append(openai_error)
            else:
                errors.append("OpenAI returned no valid profile")
        except httpx.HTTPStatusError as e:
            error_msg = f"OpenAI API: {e.response.status_code} {e.response.reason_phrase}"
            if e.response.status_code == 401:
                error_msg += " (invalid or expired API key)"
            elif e.response.status_code == 429:
                error_msg += " (rate limit exceeded)"
            elif e.response.status_code == 500:
                error_msg += " (OpenAI service error)"
            elif e.response.text:
                try:
                    body = e.response.json()
                    err = body.get("error", {}) if isinstance(body, dict) else {}
                    msg = err.get("message", err.get("code", "")) if isinstance(err, dict) else ""
                    if msg:
                        error_msg += f" — {str(msg)[:200]}"
                except Exception:
                    error_msg += f" — {e.response.text[:150]}"
            errors.append(error_msg)
        except httpx.TimeoutException:
            errors.append("OpenAI API: Request timeout (60s)")
        except Exception as e:
            errors.append(f"OpenAI API: {type(e).__name__}: {str(e)[:200]}")
    
    # Try Gemini as fallback
    gemini_api_key = (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or "").strip()
    if gemini_api_key:
        profile, gemini_error = _structure_with_gemini(text)
        if profile is not None:
            return (profile, None)
        if gemini_error:
            errors.append(gemini_error)
    elif not errors:
        errors.append("No LLM API keys configured (OPENAI_API_KEY or GEMINI_API_KEY required)")
    
    # Return combined error message
    combined_error = " | ".join(errors) if errors else "Structured extraction failed. Check logs."
    return (None, combined_error)


def profile_company_from_url(url: str) -> Dict[str, Any]:
    """
    Run Search → Scrape → Structure and return a dict suitable for the entity form.
    Keys match frontend EntityProfile (camelCase) and existing field names.
    """
    url = _normalize_url(url)
    domain = _url_to_domain(url)
    if not domain:
        return {"_error": "Invalid URL"}

    # Step 1: Discover legal pages
    search_urls = _search_legal_pages(domain)
    search_snippets = _search_company_snippets(domain)
    urls_to_scrape = _build_candidate_urls(url, search_urls)

    # Step 2: Scrape and concatenate content
    combined_text: List[str] = []
    first_party_candidates = [
        u for u in urls_to_scrape
        if _same_registered_site(u, domain) and not _normalize_url(u).lower().endswith(".pdf")
    ]
    fallback_candidates = [u for u in urls_to_scrape if u not in first_party_candidates]

    for u in first_party_candidates[:4]:
        content = _scrape_url(u)
        if content:
            combined_text.append(content)
            if len(combined_text) >= 2:
                break

    if not combined_text and not search_snippets:
        for u in fallback_candidates[:4]:
            content = _scrape_url(u)
            if content:
                combined_text.append(content)
                if len(combined_text) >= 2:
                    break

    if not combined_text and not search_snippets:
        for u in urls_to_scrape[:6]:
            content = _scrape_url(u)
            if content:
                combined_text.append(content)
                if len(combined_text) >= 2:
                    break
    raw_parts: List[str] = []
    if search_snippets:
        raw_parts.append("Search snippets:\n" + "\n".join(search_snippets))
    raw_parts.extend(combined_text)
    raw_text = "\n\n".join(raw_parts) if raw_parts else None
    if not raw_text:
        return {"_error": "Could not scrape content from URL"}

    # Step 3: Structure with OpenAI (preferred) or Gemini
    profile, extract_error = _structure_text(raw_text)
    if not profile:
        openai_set = bool(os.getenv("OPENAI_API_KEY", "").strip())
        gemini_set = bool((os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or "").strip())
        if not openai_set and not gemini_set:
            return {
                "_error": "Structured extraction requires OPENAI_API_KEY or GEMINI_API_KEY. "
                "Set one of them in your .env (or docker-compose environment) and restart the core-svc.",
                "_code": "CONFIG_MISSING",
            }
        # Use the detailed error message from _structure_text, which includes specific API errors
        msg = extract_error or "Structured extraction failed. Check server logs for details."
        return {"_error": msg}

    # Normalize sectors and regions to exact form option values
    sectors = _normalize_sectors(profile.sectors or [])
    regions = _normalize_regions(profile.regions or [])

    # Normalize employee count to form dropdown values
    emp_raw = (profile.employee_count_tier or "").strip().lower()
    emp_tier = ""
    if emp_raw in ("1-9", "10-49", "50-249", "250-999", "1000+"):
        emp_tier = emp_raw
    elif "1" in emp_raw and "9" in emp_raw and "10" not in emp_raw:
        emp_tier = "1-9"
    elif "10" in emp_raw and "49" in emp_raw:
        emp_tier = "10-49"
    elif "50" in emp_raw or "249" in emp_raw:
        emp_tier = "50-249"
    elif "250" in emp_raw or "999" in emp_raw:
        emp_tier = "250-999"
    elif "1000" in emp_raw or "1000+" in emp_raw:
        emp_tier = "1000+"
    # If HQ country not in regions, add it so it appears in Regions of Operation
    hq_raw = (profile.hq_country or "").strip()
    normalized_hq_list = _normalize_regions([hq_raw]) if hq_raw else []
    hq = normalized_hq_list[0] if normalized_hq_list else hq_raw
    if hq and hq not in regions:
        regions = [hq, *regions]

    # Map to entity form shape (camelCase for frontend)
    out: Dict[str, Any] = {
        "fullLegalName": profile.legal_name or "",
        "legalForm": profile.legal_form or "",
        "companyRegistrationNumber": (profile.registration_number or "").strip() or "",
        "headquartersCountry": hq or hq_raw or "",
        "website": url,
        "employeeCount": emp_tier,
        "annualTurnover": (profile.annual_turnover or "").strip() or "",
        "marketRole": _normalize_market_role(profile.market_role),
        "sectors": sectors,
        "regionsOfOperation": regions,
    }
    discovered_logo_url = _discover_logo_url(url)
    if discovered_logo_url:
        out["logoUrl"] = discovered_logo_url
    # Compliance personnel (only include when non-empty so frontend can merge without overwriting with "")
    for key, val in (
        ("authorizedRepresentativeName", profile.authorized_representative_name),
        ("authorizedRepresentativeEmail", profile.authorized_representative_email),
        ("authorizedRepresentativePhone", profile.authorized_representative_phone),
        ("aiComplianceOfficerName", profile.ai_compliance_officer_name),
        ("aiComplianceOfficerEmail", profile.ai_compliance_officer_email),
        ("executiveSponsorName", profile.executive_sponsor_name),
        ("executiveSponsorEmail", profile.executive_sponsor_email),
    ):
        if val and (v := (val or "").strip()):
            out[key] = v
    return out
