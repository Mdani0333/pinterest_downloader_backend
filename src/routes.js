import { PinterestRoutes } from "./pinterest/pinterest.routes.js";

const VERSION = "v1";
const API_PREFIX = `/api/${VERSION}`;

export function routes(app) {
  app.use(API_PREFIX + "/pinterest", PinterestRoutes);
}
