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
