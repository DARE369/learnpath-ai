"""
Unit tests for ConceptGraphService — pure graph algorithms only (no Claude calls).
"""

import pytest
from services.concept_graph_service import ConceptGraphService


@pytest.fixture
def cg_service():
    return ConceptGraphService()


# ---------------------------------------------------------------------------
# build_concept_graph
# ---------------------------------------------------------------------------

def test_build_graph(cg_service):
    concepts_data = {
        "concepts": [
            {"name": "Atoms", "definition": "Smallest unit of matter", "prerequisites": []},
            {"name": "Molecules", "definition": "Atoms bonded together", "prerequisites": ["Atoms"]},
            {"name": "Reactions", "definition": "Molecules interacting", "prerequisites": ["Molecules"]},
        ]
    }
    graph = cg_service.build_concept_graph(concepts_data)

    assert "Atoms" in graph["graph"]
    assert "Molecules" in graph["graph"]
    assert "Reactions" in graph["graph"]
    assert graph["graph"]["Molecules"]["prerequisites"] == ["Atoms"]
    assert "Molecules" in graph["graph"]["Atoms"]["dependents"]


def test_build_graph_skips_empty_names(cg_service):
    concepts_data = {
        "concepts": [
            {"name": "", "definition": "no name", "prerequisites": []},
            {"name": "  ", "definition": "whitespace", "prerequisites": []},
            {"name": "Valid", "definition": "ok", "prerequisites": []},
        ]
    }
    graph = cg_service.build_concept_graph(concepts_data)
    assert list(graph["graph"].keys()) == ["Valid"]


def test_build_graph_unknown_prereqs_ignored(cg_service):
    """Prerequisites not in the concept list should not create graph entries."""
    concepts_data = {
        "concepts": [
            {"name": "Advanced Topic", "prerequisites": ["Ghost Concept"]},
        ]
    }
    graph = cg_service.build_concept_graph(concepts_data)
    assert "Ghost Concept" not in graph["graph"]
    assert "Advanced Topic" in graph["graph"]


# ---------------------------------------------------------------------------
# detect_cycles
# ---------------------------------------------------------------------------

def test_detect_cycles(cg_service):
    graph_with_cycle = {
        "graph": {
            "A": {"definition": "", "prerequisites": ["B"], "dependents": []},
            "B": {"definition": "", "prerequisites": ["A"], "dependents": []},
        }
    }
    has_cycles, cycles = cg_service.detect_cycles(graph_with_cycle)
    assert has_cycles is True
    assert len(cycles) > 0


def test_no_cycles(cg_service):
    graph_no_cycle = {
        "graph": {
            "A": {"definition": "", "prerequisites": [], "dependents": ["B"]},
            "B": {"definition": "", "prerequisites": ["A"], "dependents": ["C"]},
            "C": {"definition": "", "prerequisites": ["B"], "dependents": []},
        }
    }
    has_cycles, cycles = cg_service.detect_cycles(graph_no_cycle)
    assert has_cycles is False
    assert cycles == []


def test_detect_cycles_empty_graph(cg_service):
    has_cycles, cycles = cg_service.detect_cycles({"graph": {}})
    assert has_cycles is False


# ---------------------------------------------------------------------------
# topological_sort
# ---------------------------------------------------------------------------

def test_topological_sort(cg_service):
    graph = {
        "graph": {
            "Atoms": {"definition": "", "prerequisites": [], "dependents": ["Molecules"]},
            "Molecules": {"definition": "", "prerequisites": ["Atoms"], "dependents": ["Reactions"]},
            "Reactions": {"definition": "", "prerequisites": ["Molecules"], "dependents": []},
        }
    }
    sorted_concepts, is_valid = cg_service.topological_sort(graph)

    assert is_valid is True
    assert sorted_concepts.index("Atoms") < sorted_concepts.index("Molecules")
    assert sorted_concepts.index("Molecules") < sorted_concepts.index("Reactions")


def test_topological_sort_parallel_prereqs(cg_service):
    """Both A and B are prerequisites for C — both must come before C."""
    graph = {
        "graph": {
            "A": {"definition": "", "prerequisites": [], "dependents": ["C"]},
            "B": {"definition": "", "prerequisites": [], "dependents": ["C"]},
            "C": {"definition": "", "prerequisites": ["A", "B"], "dependents": []},
        }
    }
    sorted_concepts, is_valid = cg_service.topological_sort(graph)
    assert is_valid is True
    assert sorted_concepts.index("A") < sorted_concepts.index("C")
    assert sorted_concepts.index("B") < sorted_concepts.index("C")


def test_topological_sort_cyclic_graph_returns_partial(cg_service):
    """Cyclic graph: is_valid=False but all concepts are still returned."""
    graph = {
        "graph": {
            "X": {"definition": "", "prerequisites": ["Y"], "dependents": []},
            "Y": {"definition": "", "prerequisites": ["X"], "dependents": []},
        }
    }
    sorted_concepts, is_valid = cg_service.topological_sort(graph)
    assert is_valid is False
    assert len(sorted_concepts) == 2


# ---------------------------------------------------------------------------
# break_cycles
# ---------------------------------------------------------------------------

def test_break_cycles(cg_service):
    graph = {
        "graph": {
            "A": {"definition": "", "prerequisites": ["B"], "dependents": []},
            "B": {"definition": "", "prerequisites": ["A"], "dependents": []},
        }
    }
    cycles = [["A", "B", "A"]]
    result = cg_service.break_cycles(graph, cycles)
    # Edge B→A should be removed (cycle[-2]="B", cycle[-1]="A")
    assert "A" not in result["graph"]["B"]["prerequisites"]
