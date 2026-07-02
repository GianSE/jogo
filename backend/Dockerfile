# --- build stage ---
FROM golang:1.24-alpine AS build
WORKDIR /src

# -mod=mod lets the build resolve/record deps without a committed go.sum yet.
ENV GOFLAGS=-mod=mod CGO_ENABLED=0

COPY go.mod ./
RUN go mod download all || true

COPY . .
RUN go build -o /out/server ./cmd/server

# --- runtime stage ---
FROM alpine:3.20
RUN adduser -D -u 10001 app
USER app
WORKDIR /app
COPY --from=build /out/server /app/server
EXPOSE 8080
ENTRYPOINT ["/app/server"]
