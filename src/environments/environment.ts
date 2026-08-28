export const environment = {
  production: false,
  keycloak: {
    url: 'http://localhost:8080',
    realm: 'meeting-realm',
    clientId: 'meeting-client'
  },
  backendApiUrl: 'http://localhost:8081',
  livekitUrl: 'ws://localhost:7880',
  googleClientId: '31196052853-qokps763iu3glinq4sviht7q58n87bv7.apps.googleusercontent.com',
  // URL gốc của media server (MinIO). Chỉ dùng khi backend trả về URL nội bộ (minio:9000).
  // Để rỗng ('') trên môi trường production khi backend đã trả về URL public chính xác.
  mediaBaseUrl: 'http://localhost:9000',
};
