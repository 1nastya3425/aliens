# Используем официальный образ Node.js на базе Alpine
FROM node:20-alpine

# Устанавливаем Python и необходимые зависимости
RUN apk update && \
    apk add --no-cache \
    python3 \
    py3-pip \
    python3-dev \
    build-base

# Создаем виртуальное окружение для Python
RUN python3 -m venv /venv

# Устанавливаем pip внутри виртуального окружения
RUN /venv/bin/pip install --upgrade pip

# Устанавливаем зависимости внутри виртуального окружения
RUN /venv/bin/pip install scikit-learn==1.6.1
RUN /venv/bin/pip install joblib numpy

# Рабочая директория внутри контейнера
WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости Node.js
RUN npm install --production

# Копируем весь проект
COPY . .

# Открываем порт (если сервер слушает 3000, поменяй при необходимости)
EXPOSE 3000

# Запуск приложения
CMD ["node", "server.js"]
