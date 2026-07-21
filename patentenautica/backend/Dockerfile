FROM alpine:3.22

ARG PB_VERSION=0.39.8
ARG TARGETARCH

RUN apk add --no-cache ca-certificates unzip wget \
  && case "$TARGETARCH" in \
    amd64) PB_ARCH="linux_amd64" ;; \
    arm64) PB_ARCH="linux_arm64" ;; \
    *) echo "Unsupported architecture: $TARGETARCH" && exit 1 ;; \
  esac \
  && wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_${PB_ARCH}.zip" -O /tmp/pb.zip \
  && unzip /tmp/pb.zip -d /pb \
  && rm /tmp/pb.zip

COPY pb_migrations /pb/pb_migrations
COPY pb_hooks /pb/pb_hooks

WORKDIR /pb
EXPOSE 8090
VOLUME ["/pb/pb_data"]

CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8090", "--origins=https://engnata.eu,https://www.engnata.eu"]
