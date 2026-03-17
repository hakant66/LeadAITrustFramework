# Agent Quick Reference

## Agent Commands

| Agent | Trigger Phrase | Best For |
|-------|---------------|----------|
| 🎯 **The Coordinator** | "Act as The Coordinator" | Planning workflows & orchestrating agents |
| 🛠️ **The Coder** | "Act as The Coder" | Writing new code quickly |
| 🧹 **The Cleaner** | "Act as The Cleaner" | Refactoring & optimization |
| ✅ **The Verifier** | "Act as The Verifier" | Testing & validation |
| 🇪🇺 **The EU Compliance Agent** | "Act as The EU Compliance Agent" | EU AI Act compliance auditing |
| 🔍 **The Detective** | "Act as The Detective" | Debugging & root cause |

## Common Workflows

### New Feature (Coordinated)
```
1. "Act as The Coordinator - plan workflow for [feature description]"
2. Follow the Coordinator's plan:
   - "Act as The Coder - [step 1]"
   - "Act as The Cleaner - optimize this"
   - "Act as The Verifier - add tests"
   - "Act as The EU Compliance Agent - audit for EU AI Act compliance"
```

### Bug Fix
```
1. "Act as The Detective - [error description]"
2. "Act as The Coder - fix it"
3. "Act as The Verifier - prevent regression"
```

### Code Review
```
1. "Act as The Verifier - review this code"
2. "Act as The Cleaner - suggest improvements"
```

## Model Reference

- **Agent A (Llama)**: Fast, local, good for coding and compliance auditing
- **Agent B (Claude)**: Smart, thorough, good for refactoring/testing/debugging/coordination

## File Locations

- Agent definitions: `.cursor/AGENTS.md`
- Agent rules: `.cursor/rules/agent-*.mdc`
- Workflow guide: `.cursor/AGENT_WORKFLOW.md`
