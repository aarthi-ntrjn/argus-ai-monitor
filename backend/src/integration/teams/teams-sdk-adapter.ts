import type { FastifyInstance } from 'fastify';
import type { IHttpServerAdapter, HttpMethod, HttpRouteHandler } from '@microsoft/teams.apps';

export class FastifyTeamsAdapter implements IHttpServerAdapter {
  constructor(private readonly fastify: FastifyInstance) {}

  registerRoute(method: HttpMethod, path: string, handler: HttpRouteHandler): void {
    this.fastify.route({
      method,
      url: path,
      handler: async (req, reply) => {
        const result = await handler({
          body: req.body,
          headers: req.headers as Record<string, string | string[]>,
        });
        reply.status(result.status);
        if (result.body !== undefined) {
          reply.send(result.body);
        } else {
          reply.send();
        }
      },
    });
  }
}
