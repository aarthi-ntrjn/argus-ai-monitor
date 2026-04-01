import type { WebSocket } from 'ws';

interface WsEvent {
  type: string;
  timestamp: string;
  data: Record<string, unknown>;
}

const clients = new Set<WebSocket>();

export function addClient(ws: WebSocket): void {
  clients.add(ws);
  ws.on('close', () => removeClient(ws));
  ws.on('error', () => removeClient(ws));
}

export function removeClient(ws: WebSocket): void {
  clients.delete(ws);
}

export function broadcast(event: WsEvent): void {
  const message = JSON.stringify(event);
  for (const client of clients) {
    if (client.readyState === 1) {
      try {
        client.send(message);
      } catch {
        removeClient(client);
      }
    }
  }
}

export function getClientCount(): number {
  return clients.size;
}
