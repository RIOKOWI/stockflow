FROM golang:1.26-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/api ./cmd/api && \
    CGO_ENABLED=0 GOOS=linux go build -o /bin/migrate ./cmd/migrate

FROM alpine:3.21
RUN apk add --no-cache ca-certificates
COPY --from=builder /bin/api /bin/api
COPY --from=builder /bin/migrate /bin/migrate
EXPOSE 8080
CMD ["/bin/sh", "-c", "/bin/migrate && /bin/api"]
