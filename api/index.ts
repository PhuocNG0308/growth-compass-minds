import { getRequestListener } from '@hono/node-server';
import { app } from '../src/app.ts';

// Vercel's Node launcher invokes the default export as (req, res). Handing it a
// Web-standard (Request) => Response handler leaves the response unwritten and the
// request hangs until the gateway times out.
export default getRequestListener(app.fetch);
