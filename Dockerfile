FROM denoland/deno:1.37.0

ENV PORT=1993
ENV DENO_NO_PROMPT=1
EXPOSE $PORT
WORKDIR /app
USER deno

COPY deps.ts .
RUN deno cache deps.ts

COPY . .
RUN deno cache server.ts

CMD ["run", "--allow-net", "--allow-env=PORT", "--allow-read=public", "server.ts"]