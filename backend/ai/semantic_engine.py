from .base import AIEngine


class SemanticEngine(AIEngine):
    def similarity(self, text_a, text_b):
        raise NotImplementedError("Semantic engine not yet configured.")
