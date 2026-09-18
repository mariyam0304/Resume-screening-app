from .base import AIEngine
import re


class KeywordEngine(AIEngine):
    def similarity(self, text_a, text_b):
        a = set(re.findall(r'\w+', (text_a or '').lower()))
        b = set(re.findall(r'\w+', (text_b or '').lower()))
        if not a or not b:
            return 0.0
        return len(a & b) / len(a | b)
