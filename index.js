import express from "express";
import cors from "cors";
import { GlobalErrorHandlerMiddleware } from "./src/middlewares/globalErrorHandler.middleware.js";
import { routes } from "./src/routes.js";
import { puppeteerService } from "./src/services/puppeteer.service.js";
import { RequestLogger } from "./src/interceptors/requestLogger.interceptor.js";

const app = express();
const PORT = 5000;

puppeteerService.launch();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

app.use(RequestLogger);

routes(app);

app.use(GlobalErrorHandlerMiddleware);
