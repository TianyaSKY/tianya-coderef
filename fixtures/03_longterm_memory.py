"""代码引用夹具。

光标放在标出的那一行，应复制 fixtures/03_longterm_memory.py:17
"""


def remember(key: str, value: str) -> None:
    store[key] = value


store: dict[str, str] = {}


def recall(key: str) -> str:
    return store[key]

recall("topic")
