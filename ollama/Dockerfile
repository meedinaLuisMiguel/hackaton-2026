FROM ollama/ollama:0.40.18-rc0

ARG MODEL=gemma3:4b

RUN ollama serve & \
    until ollama list >/dev/null 2>&1; do sleep 1; done; \
    ollama pull ${MODEL}

ENV OLLAMA_HOST=0.0.0.0:11434 \
    OLLAMA_KEEP_ALIVE=-1

EXPOSE 11434

CMD ["serve"]