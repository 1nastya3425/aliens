import joblib
import sys
import numpy as np

# Определение кастомного токенизатора
def custom_tokenizer(text):
    return text.lower().split()

# Загрузка модели и векторизатора
model = joblib.load('/app/agent/model/model.pkl')  # Путь к модели в папке /app/model/
vectorizer = joblib.load('/app/agent/model/vectorizer.pkl')  # Путь к векторизатору в папке /app/model/

# Функция предсказания
def predict(text):
    text_vectorized = vectorizer.transform([text])  # Преобразуем текст в вектор
    prediction = model.predict(text_vectorized)  # Получаем предсказание
    return prediction[0]

# Пример использования (получаем текст через аргументы командной строки)
if __name__ == "__main__":
    input_text = sys.argv[1]  # Текст передается как аргумент
    prediction = predict(input_text)  # Получаем предсказание
    
    # Явно указываем кодировку при выводе
    sys.stdout.buffer.write((prediction + '\n').encode('utf-8'))
