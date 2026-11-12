# pyright: strict
"""诊断引用夹具。只复制光标所在行上的红色错误。"""

from typing import overload


class BaseChatModel:
    pass


class SqliteSaver:
    pass


@overload
def create_agent(model: BaseChatModel, saver: SqliteSaver) -> str: ...


@overload
def create_agent(model: str, saver: str) -> str: ...


def create_agent(model: BaseChatModel | str, saver: SqliteSaver | str) -> str:
    return "agent"


# 这一行有两条红错：整段调用，以及 15。光标在行尾也两条都复制，调用在前。
create_agent(BaseChatModel(), 15)

# 另一行的红错。光标不在这里时不应复制。
create_agent(1, SqliteSaver())

# 调用错误从下一行开始，盖住整个调用。光标放在 SqliteSaver 那一行时，只复制这一条，行号是下一行。
create_agent(
    1,
    SqliteSaver(),
)
