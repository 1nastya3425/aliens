
# MCP-инструменты и сервера

## Оркестратор
- **Функция**: принимает обращение, запускает классификацию и выбирает стратегию ответа.
- **Вход**: JSON {text: string}
- **Выход**: JSON {category, action_plan}

## Классификатор (Simple)
- **Функция**: ключевые слова + эвристики.
- **Параметры**: {text: string}
- **Возвращает**: {category: string, operator: bool, allowed: bool}

## Поиск в FAQ
- **Функция**: поиск похожих вопросов в базе.
- **Параметры**: {text: string}
- **Возвращает**: {faq_id: int, similarity: float}

## Gemma FAQ LLM
- **Функция**: семантический поиск в FAQ.
- **Параметры**: {text: string, candidates: [faq]}
- **Возвращает**: {index: int, confidence: float}

## GPT-OSS Ответчик
- **Функция**: генерирует финальный ответ.
- **Параметры**: {text: string, system_prompt: string}
- **Возвращает**: {answer: string, confidence: float}

## Мобильное приложение (MobileApp)
- **Функция**: отвечает на запросы, связанные с функциональностью мобильного приложения банка (например, восстановление доступа через мобильное приложение).
- **Параметры**: {text: string, user_id: string}
- **Возвращает**: {status: string, message: string}

## Эскалация (Escalation)
- **Функция**: передача обращения оператору в случае, если автоматические механизмы не смогли обработать запрос.
- **Параметры**: {ticket_id: UUID, reason: string}
- **Возвращает**: {status: string, operator_id: string}
