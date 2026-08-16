export const environment = {
  production: true,
  keycloak: {
    url: 'https://auth.videoconnect.click',
    realm: 'meeting-realm',
    clientId: 'meeting-client'
  },
  backendApiUrl: 'https://api.videoconnect.click',
  livekitUrl: 'wss://livekit.videoconnect.click', // wss qua port 443 do Nginx proxy vào LiveKit
  googleClientId: '31196052853-qokps763iu3glinq4sviht7q58n87bv7.apps.googleusercontent.com'
};