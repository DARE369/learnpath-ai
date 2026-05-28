"""
Concept graph generation and ordering.
Maps prerequisites and ensures correct learning sequence.
"""

import json
import logging
import re
from typing import Dict, List, Optional, Tuple

import anthropic

from config import settings

logger = logging.getLogger(__name__)


class ConceptGraphService:
    def __init__(self):
        self.api_key = settings.CLAUDE_API_KEY
        self.model = "claude-opus-4-7"
        self.algorithm_version = "v1"

    def build_concept_extraction_prompt(self, summary: str, video_title: str) -> str:
        return f"""You are an expert educator analyzing educational content.

VIDEO: {video_title}

CONTENT SUMMARY:
{summary}

Extract learning concepts from this video:

Requirements:
1. Identify 3-8 main concepts taught
2. For each concept, identify 0-2 prerequisites (concepts that must be learned first)
3. Concepts should be: single noun phrases, measurable learning objectives
4. Prerequisites should be: existing concepts or empty list

Respond in this EXACT JSON format:
{{
  "concepts": [
    {{
      "name": "Concept Name",
      "definition": "Brief definition",
      "prerequisites": ["Prerequisite 1", "Prerequisite 2"]
    }}
  ],
  "topic": "Overall topic",
  "complexity": "beginner|intermediate|advanced"
}}"""

    async def extract_concepts(self, summary: str, video_title: str) -> Dict:
        if not self.api_key:
            raise ValueError("CLAUDE_API_KEY not configured")

        logger.info(f"Extracting concepts from: {video_title}")
        prompt = self.build_concept_extraction_prompt(summary, video_title)

        client = anthropic.AsyncAnthropic(api_key=self.api_key)
        message = await client.messages.create(
            model=self.model,
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}],
        )

        response_text = message.content[0].text

        json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
        if not json_match:
            raise ValueError("No JSON found in Claude response")

        result = json.loads(json_match.group())
        result["algorithm_version"] = self.algorithm_version
        return result

    def build_concept_graph(self, concepts_data: Dict) -> Dict:
        concepts = concepts_data.get("concepts", [])
        graph: Dict = {}
        all_concept_names: set = set()

        for concept in concepts:
            name = concept.get("name", "").strip()
            if not name:
                continue
            all_concept_names.add(name)
            graph[name] = {
                "definition": concept.get("definition", ""),
                "prerequisites": [p for p in concept.get("prerequisites", []) if p],
                "dependents": [],
            }

        # Build reverse relationships
        for concept_name, concept_data in graph.items():
            for prereq in concept_data["prerequisites"]:
                if prereq in graph:
                    graph[prereq]["dependents"].append(concept_name)

        return {
            "graph": graph,
            "concepts": list(all_concept_names),
            "topic": concepts_data.get("topic", "Unknown"),
        }

    def detect_cycles(self, graph: Dict) -> Tuple[bool, List[List[str]]]:
        """DFS-based cycle detection."""
        concepts = graph.get("graph", {})
        visited: set = set()
        rec_stack: set = set()
        cycles: List[List[str]] = []

        def dfs(node: str, path: List[str]) -> None:
            visited.add(node)
            rec_stack.add(node)
            path.append(node)

            for prereq in concepts[node].get("prerequisites", []):
                if prereq not in concepts:
                    continue
                if prereq not in visited:
                    dfs(prereq, path.copy())
                elif prereq in rec_stack:
                    cycle_start = path.index(prereq)
                    cycles.append(path[cycle_start:] + [prereq])

            rec_stack.discard(node)

        for concept in concepts:
            if concept not in visited:
                dfs(concept, [])

        return len(cycles) > 0, cycles

    def topological_sort(self, graph: Dict) -> Tuple[List[str], bool]:
        """Kahn's algorithm — prerequisites come before dependents."""
        concepts = graph.get("graph", {})
        in_degree = {c: 0 for c in concepts}

        for concept_name, concept_data in concepts.items():
            for prereq in concept_data.get("prerequisites", []):
                if prereq in in_degree:
                    in_degree[concept_name] += 1

        queue = sorted(c for c in concepts if in_degree[c] == 0)
        sorted_concepts: List[str] = []

        while queue:
            concept = queue.pop(0)
            sorted_concepts.append(concept)

            for dependent in concepts[concept].get("dependents", []):
                in_degree[dependent] -= 1
                if in_degree[dependent] == 0:
                    queue.append(dependent)
                    queue.sort()

        is_valid = len(sorted_concepts) == len(concepts)

        if not is_valid:
            remaining = [c for c in concepts if c not in sorted_concepts]
            logger.warning(
                f"Graph has cycles: sorted {len(sorted_concepts)}/{len(concepts)}, "
                f"appending remaining: {remaining}"
            )
            sorted_concepts.extend(remaining)

        return sorted_concepts, is_valid

    def break_cycles(self, graph: Dict, cycles: List[List[str]]) -> Dict:
        """Remove the last edge of each detected cycle."""
        logger.warning(f"Breaking {len(cycles)} cycle(s)")
        concepts = graph.get("graph", {})

        for cycle in cycles:
            if len(cycle) < 2:
                continue
            from_concept = cycle[-2]
            to_concept = cycle[-1]
            prereqs = concepts.get(from_concept, {}).get("prerequisites", [])
            if to_concept in prereqs:
                prereqs.remove(to_concept)
                logger.info(f"Removed prerequisite edge: {from_concept} → {to_concept}")

        return graph


concept_graph_service = ConceptGraphService()
