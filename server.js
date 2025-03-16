import express from "express";
import cors from "cors";
import { GlobalErrorHandlerMiddleware } from "./src/middlewares/globalErrorHandler.middleware.js";
import { routes } from "./src/routes.js";
import { puppeteerService } from "./src/services/puppeteer.service.js";
import { RequestLogger } from "./src/interceptors/requestLogger.interceptor.js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

puppeteerService.launch();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

app.use(RequestLogger);

routes(app);

app.use(GlobalErrorHandlerMiddleware);
