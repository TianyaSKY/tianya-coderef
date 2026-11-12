# 含 # %% 的普通 .py。引用用文件行号，不用单元格坐标。

def setup() -> None:
    return None


# %%
def cell_body() -> str:
    return "cell"


# 光标放在下一行，应复制 fixtures/cells_percent.py:13
marker = cell_body()
