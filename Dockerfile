FROM node:21.6.1-alpine AS build
WORKDIR /app/front
COPY front/package.json front/yarn.lock /app/front/
RUN yarn install
COPY front /app/front
RUN yarn build


FROM golang:1.21-alpine
WORKDIR /app
COPY go.mod go.sum /app/
RUN go mod download

COPY . /app
COPY --from=build /app/front/build /app/public
RUN go build -o main ./
CMD ["/app/main"]