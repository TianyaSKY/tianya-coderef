# pyright: reportAssignmentType=error, reportUnusedImport=warning
"""同一行两条红错，外加一条不应复制的警告。"""

import sys

# 两条赋值错误，按起始列排序。未使用的 sys 是警告，不复制。
bad: int = "left"; also: str = 1
