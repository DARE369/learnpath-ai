"""
Learning path assembly and ranking.
Creates optimal video sequences for learning topics.
"""

import logging
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class PathService:
    def __init__(self):
        self.algorithm_version = "v1"
        self.min_path_length = 3
        self.max_path_length = 15
        self.min_avg_score = 70

    def rank_videos_by_score(self, videos: List[Dict]) -> List[Dict]:
        """Sort videos by EQS score descending, filtering below 65."""
        logger.info(f"Ranking {len(videos)} videos by EQS score")

        ranked = sorted(videos, key=lambda v: v.get("eqs_score", 0), reverse=True)
        filtered = [v for v in ranked if v.get("eqs_score", 0) >= 65]

        logger.info(f"Filtered to {len(filtered)} quality videos (score >= 65)")
        return filtered

    def order_by_prerequisites(
        self, videos: List[Dict], concept_graph: Dict
    ) -> List[Dict]:
        """Reorder videos so prerequisites come first, using concept graph ordering."""
        logger.info(f"Ordering {len(videos)} videos by prerequisites")

        ordered_concepts = concept_graph.get("ordered_concepts", [])
        video_by_concept: Dict[str, List[Dict]] = {}

        for video in videos:
            for concept in video.get("concepts", []):
                video_by_concept.setdefault(concept, []).append(video)

        seen: set = set()
        ordered_videos: List[Dict] = []

        for concept in ordered_concepts:
            for video in video_by_concept.get(concept, []):
                vid_id = video.get("video_id")
                if vid_id not in seen:
                    seen.add(vid_id)
                    ordered_videos.append(video)

        # Append remaining videos that had no matching concept
        for video in videos:
            if video.get("video_id") not in seen:
                ordered_videos.append(video)

        return ordered_videos

    def assemble_path(
        self,
        topic_id: str,
        videos: List[Dict],
        concept_graph: Optional[Dict] = None,
    ) -> Dict:
        """Rank, order, and trim videos into an optimal learning path."""
        logger.info(
            f"Assembling path for topic {topic_id} with {len(videos)} videos"
        )

        ranked = self.rank_videos_by_score(videos)

        if len(ranked) < self.min_path_length:
            logger.warning(
                f"Not enough quality videos ({len(ranked)} < {self.min_path_length})"
            )

        ordered = (
            self.order_by_prerequisites(ranked, concept_graph)
            if concept_graph
            else ranked
        )

        path_videos = ordered[: self.max_path_length]
        video_ids = [v["video_id"] for v in path_videos]
        scores = [v.get("eqs_score", 0) for v in path_videos]
        avg_score = round(sum(scores) / len(scores), 2) if scores else 0.0

        path = {
            "topic_id": str(topic_id),
            "video_sequence": video_ids,
            "algorithm_version": self.algorithm_version,
            "average_score": avg_score,
            "video_count": len(path_videos),
            "is_quality": avg_score >= self.min_avg_score,
            "generated_at": datetime.utcnow().isoformat(),
        }

        logger.info(
            f"Path assembled: {len(path_videos)} videos, avg score: {avg_score}"
        )
        return path

    def validate_path(self, path: Dict) -> Dict:
        """Check path length, quality, and duplicate videos."""
        validation: Dict[str, Any] = {
            "is_valid": True,
            "issues": [],
            "warnings": [],
        }

        video_count = path.get("video_count", 0)
        avg_score = path.get("average_score", 0)
        video_ids = path.get("video_sequence", [])

        if video_count < self.min_path_length:
            validation["issues"].append(
                f"Too few videos ({video_count} < {self.min_path_length})"
            )
            validation["is_valid"] = False

        if video_count > self.max_path_length:
            validation["warnings"].append(f"Path truncated to {self.max_path_length}")

        if avg_score < self.min_avg_score:
            validation["issues"].append(
                f"Low average quality (score {avg_score} < {self.min_avg_score})"
            )
            validation["is_valid"] = False

        if len(video_ids) != len(set(video_ids)):
            validation["issues"].append("Duplicate videos in path")
            validation["is_valid"] = False

        return validation

    def save_path_to_db(self, path: Dict) -> str:
        """
        Persist path to database.
        Stubbed for Stage 1 — LearningPath table is added in the persistence stage.
        Returns a generated path_id for the response.
        """
        path_id = str(uuid.uuid4())
        logger.info(
            f"[stub] Path {path_id} for topic {path.get('topic_id')} "
            f"({path.get('video_count')} videos, avg={path.get('average_score')}) "
            "— DB persistence deferred to persistence stage"
        )
        return path_id


path_service = PathService()
