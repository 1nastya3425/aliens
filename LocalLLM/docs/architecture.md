# Архитектура и дизайн системы

## Компоненты
- Orchestrator — главный контроллер.
- Filter — блокирует оффтоп и токсичные вопросы.
- Classifier — определяет категорию (Аутентификация, Оплата, Ошибки...).
- FAQ Search — поиск в базе знаний (Gemma-3B).
- LLM Answer — fallback на mistralai/mathstral-7b-v0.1.
- Logger — логирование обращений.
- Storage — JSON для истории и логов.

```mermaid
flowchart TD
    User --> Orchestrator
    Orchestrator --> Filter
    Orchestrator --> Classifier
    Orchestrator --> FAQ[FAQ Search (Gemma)]
    Orchestrator --> LLM[LLM (mistral)]
    Orchestrator --> Logger
    FAQ --> KnowledgeBase
    LLM --> Operator
