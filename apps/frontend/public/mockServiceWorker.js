/* eslint-disable */
/* tslint:disable */

/**
 * Mock Service Worker (3.0.3).
 * Excluded from production builds.
 */

const INTEGRITY_CHECKSUM = '0123456789abcdef0123456789abcdef'
const IS_MOCKED_RESPONSE = Symbol('isMockedResponse')
const activeClientIds = new Set()

self.addEventListener('install', function () {
  self.skipWaiting()
})

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('message', async function (event) {
  const clientId = event.source.id
  if (!clientId) return

  const client = await self.clients.get(clientId)
  if (!client) return

  const allClients = await self.clients.matchAll({ type: 'window' })

  switch (event.data) {
    case 'KEEPALIVE_REQUEST': {
      sendToClient(client, { type: 'KEEPALIVE_RESPONSE' })
      break
    }
    case 'INTEGRITY_CHECK_REQUEST': {
      sendToClient(client, {
        type: 'INTEGRITY_CHECK_RESPONSE',
        packageVersion: '3.0.3',
        checksum: INTEGRITY_CHECKSUM,
      })
      break
    }
    case 'MOCK_ACTIVATE': {
      activeClientIds.add(clientId)
      sendToClient(client, { type: 'MOCKING_ENABLED' })
      break
    }
    case 'MOCK_DEACTIVATE': {
      activeClientIds.delete(clientId)
      break
    }
    case 'CLIENT_CLOSED': {
      activeClientIds.delete(clientId)
      break
    }
  }
})

self.addEventListener('fetch', function (event) {
  const { request } = event

  if (request.mode === 'navigate') {
    return
  }

  if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') {
    return
  }

  if (!activeClientIds.has(event.clientId)) {
    return
  }

  event.respondWith(handleRequest(event, request))
})

async function handleRequest(event, request) {
  const client = await self.clients.get(event.clientId)
  if (!client) {
    return fetch(request)
  }

  return fetch(request)
}

function sendToClient(client, message) {
  client.postMessage(message)
}

