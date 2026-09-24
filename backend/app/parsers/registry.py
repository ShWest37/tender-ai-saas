"""
Реестр парсеров: platform_name → класс парсера.
Оркестратор (parser_tasks) строит экземпляры по активным ParserConfig.
"""
from app.parsers.base import BaseParser
from app.parsers.open_data import OpenDataParser
from app.parsers.platforms import (
    SberbankASTParser,
    RTSTenderParser,
    RoseltorgParser,
    TekTorgParser,
    GazprombankParser,
    NEPParser,
    EETPParser,
    AGZRTParser,
)

# Порядок = приоритет. zakupki_gov — рабочий адаптер открытых данных.
PARSER_REGISTRY: dict[str, type[BaseParser]] = {
    OpenDataParser.platform_name: OpenDataParser,
    SberbankASTParser.platform_name: SberbankASTParser,
    RTSTenderParser.platform_name: RTSTenderParser,
    RoseltorgParser.platform_name: RoseltorgParser,
    TekTorgParser.platform_name: TekTorgParser,
    GazprombankParser.platform_name: GazprombankParser,
    NEPParser.platform_name: NEPParser,
    EETPParser.platform_name: EETPParser,
    AGZRTParser.platform_name: AGZRTParser,
}


def build_parser(platform_name: str, api_url: str | None = None, api_key: str | None = None) -> BaseParser | None:
    """Создаёт парсер по имени площадки; None, если площадка неизвестна."""
    cls = PARSER_REGISTRY.get(platform_name)
    if cls is None:
        return None
    # OpenDataParser и заготовки принимают api_url/api_key
    try:
        return cls(api_url=api_url, api_key=api_key)
    except TypeError:
        return cls()
