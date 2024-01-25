FROM golang:1.21-alpine

WORKDIR /app
COPY go.mod go.sum /app/
RUN go mod download

COPY . /app
RUN go build -o main ./
CMD ["/app/main"]