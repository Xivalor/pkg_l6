# Используем официальный образ nginx
FROM nginx:alpine

# Удаляем стандартный index.html
RUN rm /usr/share/nginx/html/*

# Копируем файлы проекта в директорию веб-сервера
COPY . /usr/share/nginx/html/

# Экспонируем порт
EXPOSE 80

# Запускаем nginx в фореграундном режиме
CMD ["nginx", "-g", "daemon off;"]
