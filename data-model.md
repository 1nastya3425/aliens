# Модель данных обращений

## Объекты

### Обращение (Ticket)
- `id`: UUID  
- `created_at`: datetime  
- `user_id`: string  
- `channel`: string (web / mobile / api)  
- `text`: string (оригинальный запрос пользователя)  
- `normalized_text`: string (нормализованный запрос)  
- `category`: enum {Аутентификация, Оплата, Ошибки, Технический вопрос, Другое}  
- `confidence`: float (0.0–1.0, уверенность классификатора)  
- `status`: enum {новое, в работе, передано оператору, закрыто}  

### Действие (Action)
- `id`: UUID  
- `ticket_id`: UUID  
- `type`: enum {FAQ, LLM, Escalation, ExternalCall}  
- `input`: string (данные для выполнения)  
- `output`: string (результат выполнения)  
- `timestamp`: datetime  

### Ответ (Answer)
- `id`: UUID  
- `ticket_id`: UUID  
- `source`: enum {FAQ, GPT-OSS, Gemma, Operator}  
- `text`: string (финальный ответ пользователю)  
- `confidence`: float  
- `created_at`: datetime
