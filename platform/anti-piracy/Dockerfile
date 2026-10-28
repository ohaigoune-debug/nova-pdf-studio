FROM python:3.12-slim
WORKDIR /opt/madrasadz
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY bot ./bot
CMD ["python", "-m", "bot.telegram_bot"]
