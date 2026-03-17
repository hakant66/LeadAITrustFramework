#!/usr/bin/env python3
"""
Agent Coordinator - Helper script for multi-agent workflows

This script provides utilities for coordinating multi-agent workflows
in the LeadAI Trust Framework development process.

Note: This is a helper script. Actual agent switching happens in Cursor
by explicitly mentioning agent roles in conversations.
"""

import json
from pathlib import Path
from typing import Dict, List, Optional
from dataclasses import dataclass, asdict
from enum import Enum


class AgentRole(Enum):
    """Available agent roles"""
    COORDINATOR = "coordinator"
    CODER = "coder"
    CLEANER = "cleaner"
    VERIFIER = "verifier"
    EU_COMPLIANCE = "eu_compliance"
    DETECTIVE = "detective"


@dataclass
class AgentTask:
    """Represents a task for an agent"""
    agent: AgentRole
    description: str
    status: str = "pending"  # pending, in_progress, completed, failed
    output: Optional[str] = None
    notes: Optional[str] = None


@dataclass
class Workflow:
    """Represents a multi-agent workflow"""
    name: str
    tasks: List[AgentTask]
    status: str = "pending"


class AgentCoordinator:
    """Coordinates multi-agent workflows"""
    
    AGENTS = {
        AgentRole.COORDINATOR: {
            "name": "The Coordinator",
            "model": "Claude 3.5 Sonnet",
            "trigger": "Act as The Coordinator",
            "description": "Workflow orchestration and task planning"
        },
        AgentRole.CODER: {
            "name": "The Coder",
            "model": "Llama 3.1:8b (Ollama)",
            "trigger": "Act as The Coder",
            "description": "Fast code generation and implementation"
        },
        AgentRole.CLEANER: {
            "name": "The Cleaner",
            "model": "Claude 3.5 Sonnet",
            "trigger": "Act as The Cleaner",
            "description": "Refactoring and optimization"
        },
        AgentRole.VERIFIER: {
            "name": "The Verifier",
            "model": "Claude 3.5 Sonnet",
            "trigger": "Act as The Verifier",
            "description": "Testing and validation"
        },
        AgentRole.EU_COMPLIANCE: {
            "name": "The EU Compliance Agent",
            "model": "Llama 3.1:8b (Ollama)",
            "trigger": "Act as The EU Compliance Agent",
            "description": "EU AI Act compliance auditing"
        },
        AgentRole.DETECTIVE: {
            "name": "The Detective",
            "model": "Claude 3.5 Sonnet",
            "trigger": "Act as The Detective",
            "description": "Debugging and root cause analysis"
        }
    }
    
    def __init__(self, workflow_file: Optional[Path] = None):
        self.workflow_file = workflow_file or Path(".cursor/workflows.json")
        self.workflows: List[Workflow] = []
        self.load_workflows()
    
    def load_workflows(self):
        """Load saved workflows from file"""
        if self.workflow_file.exists():
            try:
                with open(self.workflow_file, 'r') as f:
                    data = json.load(f)
                    self.workflows = [
                        Workflow(
                            name=w['name'],
                            tasks=[AgentTask(**t) for t in w['tasks']],
                            status=w.get('status', 'pending')
                        )
                        for w in data.get('workflows', [])
                    ]
            except Exception as e:
                print(f"Error loading workflows: {e}")
                self.workflows = []
    
    def save_workflows(self):
        """Save workflows to file"""
        self.workflow_file.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "workflows": [
                {
                    "name": w.name,
                    "tasks": [asdict(t) for t in w.tasks],
                    "status": w.status
                }
                for w in self.workflows
            ]
        }
        with open(self.workflow_file, 'w') as f:
            json.dump(data, f, indent=2)
    
    def create_workflow(self, name: str, tasks: List[Dict]) -> Workflow:
        """Create a new workflow"""
        agent_tasks = [
            AgentTask(
                agent=AgentRole(t['agent']),
                description=t['description']
            )
            for t in tasks
        ]
        workflow = Workflow(name=name, tasks=agent_tasks)
        self.workflows.append(workflow)
        self.save_workflows()
        return workflow
    
    def list_agents(self):
        """List all available agents"""
        print("\nAvailable Agents:")
        print("=" * 60)
        for role, info in self.AGENTS.items():
            print(f"\n{info['name']} ({role.value})")
            print(f"  Model: {info['model']}")
            print(f"  Trigger: \"{info['trigger']}\"")
            print(f"  Description: {info['description']}")
        print()
    
    def generate_workflow_prompt(self, workflow: Workflow) -> str:
        """Generate a prompt for executing a workflow"""
        prompts = []
        for i, task in enumerate(workflow.tasks, 1):
            agent_info = self.AGENTS[task.agent]
            prompts.append(
                f"Step {i}: {agent_info['trigger']} - {task.description}"
            )
        return "\n".join(prompts)
    
    def show_workflow(self, workflow_name: str):
        """Display a workflow"""
        workflow = next((w for w in self.workflows if w.name == workflow_name), None)
        if not workflow:
            print(f"Workflow '{workflow_name}' not found")
            return
        
        print(f"\nWorkflow: {workflow.name}")
        print(f"Status: {workflow.status}")
        print("\nTasks:")
        for i, task in enumerate(workflow.tasks, 1):
            agent_info = self.AGENTS[task.agent]
            print(f"\n  {i}. {agent_info['name']}")
            print(f"     Description: {task.description}")
            print(f"     Status: {task.status}")
            if task.notes:
                print(f"     Notes: {task.notes}")
        
        print("\n" + "=" * 60)
        print("Copy this prompt to Cursor:")
        print("-" * 60)
        print(self.generate_workflow_prompt(workflow))
        print()


def main():
    """CLI interface for agent coordinator"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Agent Coordinator for multi-agent workflows")
    parser.add_argument("command", choices=["list", "create", "show", "prompt"],
                       help="Command to execute")
    parser.add_argument("--name", help="Workflow name")
    parser.add_argument("--tasks", help="JSON array of tasks")
    
    args = parser.parse_args()
    coordinator = AgentCoordinator()
    
    if args.command == "list":
        coordinator.list_agents()
        print("\nSaved Workflows:")
        for workflow in coordinator.workflows:
            print(f"  - {workflow.name} ({workflow.status})")
    
    elif args.command == "create":
        if not args.name or not args.tasks:
            print("Error: --name and --tasks required for create")
            return
        
        tasks = json.loads(args.tasks)
        workflow = coordinator.create_workflow(args.name, tasks)
        print(f"Created workflow: {workflow.name}")
        coordinator.show_workflow(workflow.name)
    
    elif args.command == "show":
        if not args.name:
            print("Error: --name required for show")
            return
        coordinator.show_workflow(args.name)
    
    elif args.command == "prompt":
        if not args.name:
            print("Error: --name required for prompt")
            return
        workflow = next((w for w in coordinator.workflows if w.name == args.name), None)
        if workflow:
            print(coordinator.generate_workflow_prompt(workflow))


if __name__ == "__main__":
    main()
