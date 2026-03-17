# Multi-Agent Workflow Guide

## Quick Start

### Using Different Models

**For Llama 3.1:8b (Agent A - The Coder & EU Compliance Agent):**
- Currently, Cursor uses Claude by default
- To use Llama locally, you can:
  1. Use Ollama API directly in your code (already configured)
  2. Configure Cursor to use local models (if supported)
  3. Use the Docker environment's LLM service
- Best for: Fast code generation and privacy-preserving compliance audits

**For Claude 3.5 Sonnet (Agent B - Default):**
- This is Cursor's default model
- No special configuration needed
- Best for: The Cleaner, The Verifier, The Detective

## Typical Workflow

### 1. Feature Development Cycle (Coordinated)

```
Step 0: "Act as The Coordinator - plan a workflow for implementing user authentication"
   ↓
Step 1: "Act as The Coder - implement user authentication endpoint"
   ↓
Step 2: "Act as The Cleaner - refactor this to be more Pythonic and optimize for M1"
   ↓
Step 3: "Act as The Verifier - write comprehensive tests for this endpoint"
   ↓
Step 4: "Act as The EU Compliance Agent - audit this system for EU AI Act compliance"
   ↓
Step 5: If issues arise: "Act as The Detective - investigate why tests are failing"
```

### 2. Bug Fix Cycle

```
Step 1: "Act as The Detective - find the root cause of [error message]"
   ↓
Step 2: "Act as The Coder - fix the issue"
   ↓
Step 3: "Act as The Cleaner - ensure the fix follows best practices"
   ↓
Step 4: "Act as The Verifier - add tests to prevent regression"
```

### 3. Code Review Cycle

```
Step 1: "Act as The Verifier - review this code and write tests"
   ↓
Step 2: "Act as The Cleaner - suggest improvements for code quality"
   ↓
Step 3: "Act as The EU Compliance Agent - audit for EU AI Act compliance"
   ↓
Step 4: "Act as The Detective - check for potential bugs or edge cases"
```

## Agent Switching Examples

### Example 1: New Feature (Coordinated)
```
You: "Act as The Coordinator - plan a workflow for creating a new API endpoint POST /projects/{slug}/reports"

[Coordinator creates workflow plan with agent sequence]

You: "Act as The Coder - create a new API endpoint POST /projects/{slug}/reports"

[Cursor generates code]

You: "Now act as The Cleaner - optimize this for M1 and make it more Pythonic"

[Cursor refactors]

You: "Act as The Verifier - write tests for this endpoint"

[Cursor writes tests]

You: "Act as The EU Compliance Agent - audit this endpoint for EU AI Act compliance"

[Cursor audits using local Llama model]
```

### Example 2: Compliance Audit
```
You: "Act as The EU Compliance Agent - audit this AI system description: [description]"

[Cursor uses local Llama to classify and audit]

You: "Act as The Coder - implement compliance fixes based on the audit"

[Cursor implements fixes]

You: "Act as The Verifier - add compliance tests"
```

### Example 3: Bug Investigation
```
You: "Act as The Detective - why is this error happening: [paste error]"

[Cursor investigates]

You: "Act as The Coder - implement the fix"

[Cursor fixes]

You: "Act as The Verifier - add a test to prevent this bug"
```

## Model Selection Guide

### When to Use Llama 3.1:8b (Agent A)
- ✅ Fast code generation
- ✅ Simple implementations
- ✅ Local development (no API costs)
- ✅ Quick iterations
- ✅ Privacy-preserving compliance audits (EU Compliance Agent)
- ✅ Real-time compliance checking
- ❌ Complex refactoring
- ❌ Deep debugging
- ❌ Comprehensive testing

### When to Use Claude 3.5 Sonnet (Agent B - Default)
- ✅ Complex refactoring
- ✅ Thorough code reviews
- ✅ Deep debugging
- ✅ Comprehensive test writing
- ✅ Code quality improvements
- ✅ Workflow planning and coordination
- ❌ Very fast iterations (may be slower)

## Tips for Effective Multi-Agent Workflow

1. **Be Explicit**: Always mention which agent you want
2. **Maintain Context**: Agents remember conversation history
3. **Iterate**: Don't expect perfection in one pass
4. **Combine Agents**: Use multiple agents for complex tasks
5. **Use Checklists**: Reference AGENTS.md for agent capabilities

## Integration with Docker

All agents work with your Docker setup:

```bash
# View logs while debugging
docker compose logs -f core-svc

# Test changes
docker compose exec core-svc pytest

# Check LLM service
curl http://localhost:11434/api/tags  # Ollama models
```

## Troubleshooting

### Agent Not Responding Correctly
- Explicitly state: "Act as [Agent Name]"
- Reference the agent's role from AGENTS.md
- Check that the appropriate rule is active

### Model Selection Issues
- Cursor defaults to Claude 3.5 Sonnet
- For Llama, use Ollama API in code or Docker services
- Check `docker-compose.yml` for LLM configuration

### Context Loss
- Agents maintain context within a conversation
- Start new conversations for unrelated tasks
- Reference previous agent outputs explicitly
